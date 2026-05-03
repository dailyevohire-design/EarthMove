import { describe, it, expect, beforeEach } from 'vitest';
import { persistEvidence } from '../persist-evidence';
import type { ScraperEvidence } from '../types';

/**
 * In-memory mock of supabase.rpc('append_trust_evidence', ...) that simulates
 * the production RPC's contract:
 *  - prev-bound chain_hash via sha256(prev||'|'||sha||'|'||seq||'|'||job||'|'||type)
 *  - per-(job_id) sequence counter
 *  - idempotency on (job_id, source_key, response_sha256)
 *  - returns trust_evidence row
 */
import { createHash } from 'node:crypto';

class FakeSupabase {
  rows: Array<Record<string, unknown>> = [];
  rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];

  rpc(name: string, params: Record<string, unknown>) {
    this.rpcCalls.push({ name, params });
    if (name === 'extract_officers_from_evidence') {
      // Tier 3 #1 commit 2: post-append officer-graph hook. Mock as silent
      // no-op (no officers in extracted_facts) — matches expected production
      // path for sources that don't emit extracted_facts.officers[].
      return Promise.resolve({
        data: {
          evidence_id: params.p_evidence_id,
          status: 'no_officers',
          officers_processed: 0,
          officer_ids: [],
        },
        error: null,
      });
    }
    if (name !== 'append_trust_evidence') {
      return Promise.resolve({ data: null, error: { message: `unexpected rpc: ${name}` } });
    }
    const jobId = params.p_job_id as string;
    const sourceKey = params.p_source_key as string;
    const responseSha = (params.p_response_sha256 as string | null) ?? null;
    const findingType = params.p_finding_type as string;

    // Idempotency: (job_id, source_key, response_sha256) — but NULL sha is
    // not idempotent (matches Postgres unique-with-NULLs semantics).
    if (responseSha != null) {
      const existing = this.rows.find(
        (r) =>
          r.job_id === jobId &&
          r.source_key === sourceKey &&
          r.response_sha256 === responseSha,
      );
      if (existing) return Promise.resolve({ data: existing, error: null });
    }

    // Compute next sequence + prev_hash for this job
    const jobRows = this.rows
      .filter((r) => r.job_id === jobId)
      .sort((a, b) => (a.sequence_number as number) - (b.sequence_number as number));
    const seq = jobRows.length;
    const prev = jobRows.length > 0 ? (jobRows[jobRows.length - 1].chain_hash as string) : null;

    const hashInput = `${prev ?? ''}|${responseSha ?? ''}|${seq}|${jobId}|${findingType}`;
    const chainHash = createHash('sha256').update(hashInput).digest('hex');

    const row = {
      id: `ev_${this.rows.length + 1}`,
      job_id: jobId,
      contractor_id: params.p_contractor_id ?? null,
      source_key: sourceKey,
      sequence_number: seq,
      finding_type: findingType,
      confidence: params.p_confidence,
      finding_summary: params.p_finding_summary,
      extracted_facts: params.p_extracted_facts ?? {},
      query_sent: params.p_query_sent ?? null,
      response_sha256: responseSha,
      response_snippet: params.p_response_snippet ?? null,
      prev_hash: prev,
      chain_hash: chainHash,
      duration_ms: params.p_duration_ms ?? null,
      cost_cents: params.p_cost_cents ?? 0,
    };
    this.rows.push(row);
    return Promise.resolve({ data: row, error: null });
  }

  // unused but required by the SupabaseClient type signature in production code
  from(_t: string) { throw new Error('FakeSupabase.from() unused after refactor'); }
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

describe('persistEvidence — RPC-backed (post Tier 1 #3 refactor)', () => {
  let supabase: FakeSupabase;
  beforeEach(() => { supabase = new FakeSupabase(); });

  it('first insert: prev_hash null, sequence 0, RPC called with right params', async () => {
    const r = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: supabase as never });
    expect(r.sequenceNumber).toBe(0);
    expect(r.prevHash).toBeNull();
    expect(r.chainHash).toMatch(/^[a-f0-9]{64}$/);
    const appendCalls = supabase.rpcCalls.filter((c) => c.name === 'append_trust_evidence');
    expect(appendCalls).toHaveLength(1);
    expect(appendCalls[0].params).toMatchObject({
      p_job_id: 'job1',
      p_source_key: 'sam_gov_exclusions',
      p_finding_type: 'sanction_clear',
      p_confidence: 'verified_structured',
      p_response_sha256: 'a'.repeat(64),
      p_source_errored: false,
    });
    // Tier 3 #1 commit 2: post-append officer extraction hook fires every time.
    const extractCalls = supabase.rpcCalls.filter((c) => c.name === 'extract_officers_from_evidence');
    expect(extractCalls).toHaveLength(1);
    expect(extractCalls[0].params.p_evidence_id).toBe(r.evidenceId);
  });

  it('second insert: prev_hash = first.chainHash, sequence 1', async () => {
    const a = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: supabase as never });
    const second: ScraperEvidence = { ...SAMPLE_EVIDENCE, response_sha256: 'b'.repeat(64) };
    const b = await persistEvidence({ jobId: 'job1', evidence: second, supabase: supabase as never });
    expect(b.sequenceNumber).toBe(1);
    expect(b.prevHash).toBe(a.chainHash);
    expect(b.chainHash).not.toBe(a.chainHash);
  });

  it('idempotent: same (job, source_key, response_sha256) returns existing row', async () => {
    const a = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: supabase as never });
    const b = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: supabase as never });
    expect(b.evidenceId).toBe(a.evidenceId);
    expect(supabase.rows).toHaveLength(1);
    const appendCalls = supabase.rpcCalls.filter((c) => c.name === 'append_trust_evidence');
    expect(appendCalls).toHaveLength(2);
    // Officer-extraction hook runs after each append, including the idempotent one.
    const extractCalls = supabase.rpcCalls.filter((c) => c.name === 'extract_officers_from_evidence');
    expect(extractCalls).toHaveLength(2);
  });

  it('different jobs are independent chains, distinct chain_hashes', async () => {
    const a = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: supabase as never });
    const b = await persistEvidence({ jobId: 'job2', evidence: SAMPLE_EVIDENCE, supabase: supabase as never });
    expect(b.sequenceNumber).toBe(0);
    expect(b.prevHash).toBeNull();
    // Prev-bound formula includes job_id, so same content + different job → different chain_hash
    expect(a.chainHash).not.toBe(b.chainHash);
    expect(a.evidenceId).not.toBe(b.evidenceId);
  });

  it('source_error finding_type sets p_source_errored: true', async () => {
    const errEvidence: ScraperEvidence = {
      ...SAMPLE_EVIDENCE,
      finding_type: 'source_error',
      confidence: 'low_inference',
      finding_summary: 'Scraper failed',
      response_sha256: null,
    };
    await persistEvidence({ jobId: 'job1', evidence: errEvidence, supabase: supabase as never });
    expect(supabase.rpcCalls[0].params.p_source_errored).toBe(true);
    expect(supabase.rpcCalls[0].params.p_finding_type).toBe('source_error');
  });

  it('throws when RPC returns error', async () => {
    const failing = {
      rpc: () => Promise.resolve({ data: null, error: { message: 'mock_failure' } }),
      from: () => { throw new Error('unused'); },
    };
    await expect(persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: failing as never }))
      .rejects.toThrow(/append_trust_evidence RPC failed: mock_failure/);
  });

  it('hook failure does not block evidence write (Tier 3 #1)', async () => {
    // Custom mock: append succeeds, extract throws.
    const partialFailing = {
      _calls: [] as string[],
      rpc(name: string, _params: Record<string, unknown>) {
        void _params;
        this._calls.push(name);
        if (name === 'append_trust_evidence') {
          return Promise.resolve({
            data: {
              id: 'ev-1', sequence_number: 0,
              prev_hash: null, chain_hash: 'a'.repeat(64),
            },
            error: null,
          });
        }
        if (name === 'extract_officers_from_evidence') {
          return Promise.resolve({ data: null, error: { message: 'graph_unavailable', code: 'PG-MOCK' } });
        }
        return Promise.resolve({ data: null, error: { message: `unexpected: ${name}` } });
      },
    };
    const r = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: partialFailing as never });
    expect(r.evidenceId).toBe('ev-1');
    expect(partialFailing._calls).toEqual(['append_trust_evidence', 'extract_officers_from_evidence']);
  });

  it('hook throw does not block evidence write (Tier 3 #1)', async () => {
    // append succeeds, extract throws synchronously
    const throwingExtract = {
      rpc(name: string, _params: Record<string, unknown>) {
        if (name === 'append_trust_evidence') {
          return Promise.resolve({
            data: {
              id: 'ev-2', sequence_number: 0,
              prev_hash: null, chain_hash: 'b'.repeat(64),
            },
            error: null,
          });
        }
        // Simulate a thrown error from the supabase client itself.
        throw new Error('client_disconnect');
      },
    };
    const r = await persistEvidence({ jobId: 'job1', evidence: SAMPLE_EVIDENCE, supabase: throwingExtract as never });
    expect(r.evidenceId).toBe('ev-2');
  });
});
