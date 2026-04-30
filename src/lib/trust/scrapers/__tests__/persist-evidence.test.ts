import { describe, it, expect, beforeEach } from 'vitest';
import { persistEvidence } from '../persist-evidence';
import type { ScraperEvidence } from '../types';

// In-memory mock of the supabase client surface persistEvidence touches.
// Mirrors PostgREST builder chain: from(t).select().eq().order().limit().eq().maybeSingle()
// .insert().select().single()
class FakeSupabase {
  rows: any[] = [];
  from(_table: string) { return this.builder(); }
  private builder() {
    let filters: Record<string, any> = {};
    let mode: 'select' | 'insert' = 'select';
    let pendingInsert: any = null;
    let limitN = Infinity;
    let orderField: string | null = null;
    let orderAsc = true;
    let pendingSingle = false;
    let pendingMaybeSingle = false;
    const self = this;
    const obj: any = {
      select(_cols?: string) { return obj; },
      insert(row: any) { mode = 'insert'; pendingInsert = row; return obj; },
      eq(field: string, value: any) { filters[field] = value; return obj; },
      order(field: string, opts?: { ascending: boolean }) { orderField = field; orderAsc = opts?.ascending ?? true; return obj; },
      limit(n: number) { limitN = n; return obj; },
      single() { pendingSingle = true; return run(); },
      maybeSingle() { pendingMaybeSingle = true; return run(); },
      then(onF: any, onR: any) { return run().then(onF, onR); },
    };
    function run() {
      if (mode === 'insert') {
        const id = 'ev_' + (self.rows.length + 1);
        const row = { id, ...pendingInsert };
        self.rows.push(row);
        if (pendingSingle) return Promise.resolve({ data: row, error: null });
        return Promise.resolve({ data: [row], error: null });
      }
      let result = self.rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
      if (orderField) {
        result = [...result].sort((a, b) => {
          const av = a[orderField as string]; const bv = b[orderField as string];
          if (av === bv) return 0;
          return (av < bv ? -1 : 1) * (orderAsc ? 1 : -1);
        });
      }
      result = result.slice(0, limitN);
      if (pendingMaybeSingle) return Promise.resolve({ data: result[0] ?? null, error: null });
      if (pendingSingle) return Promise.resolve({ data: result[0], error: null });
      return Promise.resolve({ data: result, error: null });
    }
    return obj;
  }
}

const SAMPLE_EVIDENCE: ScraperEvidence = {
  source_key: 'sam_gov_exclusions',
  finding_type: 'sanction_clear',
  confidence: 'verified_structured',
  finding_summary: 'No active exclusions',
  extracted_facts: { totalRecords: 0 },
  query_sent: 'q=ACME',
  response_sha256: 'a'.repeat(64),
  response_snippet: '{}',
  duration_ms: 142,
  cost_cents: 0,
};

describe('persistEvidence', () => {
  let supabase: FakeSupabase;
  beforeEach(() => { supabase = new FakeSupabase(); });

  it('first insert: prev_hash null, sequence 0', async () => {
    const r = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: supabase as any });
    expect(r.inserted).toBe(true);
    expect(r.sequenceNumber).toBe(0);
    expect(r.prevHash).toBeNull();
    expect(r.chainHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('second insert: prev_hash = first.chain_hash, sequence 1', async () => {
    const a = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: supabase as any });
    const second: ScraperEvidence = { ...SAMPLE_EVIDENCE, finding_summary: 'Different summary' };
    const b = await persistEvidence({ jobId: 'job1', evidence: second, supabase: supabase as any });
    expect(b.inserted).toBe(true);
    expect(b.sequenceNumber).toBe(1);
    expect(b.prevHash).toBe(a.chainHash);
    expect(b.chainHash).not.toBe(a.chainHash);
  });

  it('idempotent: same content returns existing row, no new insert', async () => {
    const a = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: supabase as any });
    const b = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: supabase as any });
    expect(b.inserted).toBe(false);
    expect(b.evidenceId).toBe(a.evidenceId);
    expect(supabase.rows).toHaveLength(1);
  });

  it('different jobs are independent chains', async () => {
    const a = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: supabase as any });
    const b = await persistEvidence({ jobId: 'job2', evidence: SAMPLE_EVIDENCE, supabase: supabase as any });
    expect(b.sequenceNumber).toBe(0);
    expect(b.prevHash).toBeNull();
    // Same content different chain head -> chain hash equal across jobs (because same prev=null + same canonical)
    expect(a.chainHash).toBe(b.chainHash);
    // But they are distinct rows
    expect(a.evidenceId).not.toBe(b.evidenceId);
  });
});
