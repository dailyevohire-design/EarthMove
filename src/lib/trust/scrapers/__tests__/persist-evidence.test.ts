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
    expect(supabase.rpcCalls).toHaveLength(1);
    expect(supabase.rpcCalls[0].name).toBe('append_trust_evidence');
    expect(supabase.rpcCalls[0].params).toMatchObject({
      p_job_id: 'job1',
      p_source_key: 'sam_gov_exclusions',
      p_finding_type: 'sanction_clear',
      p_confidence: 'verified_structured',
      p_response_sha256: 'a'.repeat(64),
      p_source_errored: false,
    });
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
    expect(supabase.rpcCalls).toHaveLength(2);
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
});
