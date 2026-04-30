import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScraperEvidence } from './types';

export interface PersistEvidenceInput {
  jobId: string;
  contractorId?: string | null;
  evidence: ScraperEvidence;
  supabase: SupabaseClient;
}

export interface PersistEvidenceResult {
  evidenceId: string;
  sequenceNumber: number;
  chainHash: string;
  prevHash: string | null;
  inserted: boolean;
}

function canonicalJson(obj: Record<string, unknown>): string {
  // Stable-key sort one level deep is sufficient for our chain hash because
  // ScraperEvidence is flat at top level and extracted_facts shape is
  // controlled by each scraper. If a scraper emits a non-deterministic
  // JSON shape inside extracted_facts, that scraper has a bug.
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => JSON.stringify(k) + ':' + JSON.stringify((obj as any)[k]));
  return '{' + parts.join(',') + '}';
}

function chainHashFor(evidence: ScraperEvidence): string {
  // chain_hash is a content fingerprint over the immutable evidence fields.
  // The "chain" is carried by prev_hash, which points to the predecessor row's
  // chain_hash. Tampering is detectable by re-deriving each row's chain_hash
  // from its content and verifying prev_hash links match the seq predecessor.
  // We deliberately do NOT mix prev into chain_hash so that retrying the same
  // scraper output for a job is idempotent via the (job_id, chain_hash) index.
  const canonical = canonicalJson({
    source_key: evidence.source_key,
    finding_type: evidence.finding_type,
    confidence: evidence.confidence,
    finding_summary: evidence.finding_summary,
    extracted_facts: evidence.extracted_facts,
    response_sha256: evidence.response_sha256,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Persist a ScraperEvidence row for a given job. Writes are:
 *   - content-hashed: chain_hash = sha256(canonical_evidence_json) of the
 *     scraper output's findings fields. Pure fingerprint, NOT bound to
 *     prev_hash or job_id at the hash level.
 *   - chain-linked via prev_hash pointing at the predecessor row's
 *     chain_hash. Sequence integrity is verified by walking prev_hash
 *     pointers, not by recomputing chain_hash inputs.
 *   - sequence-numbered (max+1 per job).
 *   - idempotent: rerun with same content returns existing row via the
 *     (job_id, chain_hash) unique index.
 *
 * Tamper detection: re-derive each row's chain_hash from its content fields,
 * then walk prev_hash links and confirm each one matches its sequence
 * predecessor. Future hardening (true chain hash with prev binding) tracked
 * for Tranche C.
 *
 * This function MUST be called with a service_role Supabase client. The
 * trust_evidence table has no INSERT policy for non-service roles.
 *
 * Concurrency: callers should serialize per-job (e.g., per-job Inngest step,
 * advisory lock, or single-worker fan-in). Two concurrent inserts could race
 * on sequence_number; the unique index will reject one. Caller must retry
 * the rejected one with refreshed sequence.
 */
export async function persistEvidence(input: PersistEvidenceInput): Promise<PersistEvidenceResult> {
  const { jobId, contractorId, evidence, supabase } = input;

  // 1. Read tail of chain
  const { data: tailRows, error: tailErr } = await supabase
    .from('trust_evidence')
    .select('chain_hash, sequence_number')
    .eq('job_id', jobId)
    .order('sequence_number', { ascending: false })
    .limit(1);
  if (tailErr) throw new Error(`persistEvidence: read tail failed: ${tailErr.message}`);

  const prevHash: string | null = tailRows?.[0]?.chain_hash ?? null;
  const nextSeq: number = tailRows?.[0]?.sequence_number !== undefined
    ? (tailRows[0].sequence_number as number) + 1
    : 0;
  const chainHash = chainHashFor(evidence);

  // 2. Idempotency check via (job_id, chain_hash) unique index
  const { data: existing, error: existingErr } = await supabase
    .from('trust_evidence')
    .select('id, sequence_number, prev_hash')
    .eq('job_id', jobId)
    .eq('chain_hash', chainHash)
    .maybeSingle();
  if (existingErr && existingErr.code !== 'PGRST116') {
    throw new Error(`persistEvidence: idempotency check failed: ${existingErr.message}`);
  }
  if (existing) {
    return {
      evidenceId: existing.id as string,
      sequenceNumber: existing.sequence_number as number,
      chainHash,
      prevHash: (existing.prev_hash as string | null) ?? null,
      inserted: false,
    };
  }

  // 3. Insert
  const { data: inserted, error: insErr } = await supabase
    .from('trust_evidence')
    .insert({
      job_id: jobId,
      contractor_id: contractorId ?? null,
      source_key: evidence.source_key,
      sequence_number: nextSeq,
      finding_type: evidence.finding_type,
      confidence: evidence.confidence,
      finding_summary: evidence.finding_summary,
      extracted_facts: evidence.extracted_facts,
      query_sent: evidence.query_sent,
      response_sha256: evidence.response_sha256,
      response_snippet: evidence.response_snippet,
      prev_hash: prevHash,
      chain_hash: chainHash,
      duration_ms: evidence.duration_ms,
      cost_cents: evidence.cost_cents,
    })
    .select('id')
    .single();
  if (insErr) throw new Error(`persistEvidence: insert failed: ${insErr.message}`);

  return {
    evidenceId: inserted.id as string,
    sequenceNumber: nextSeq,
    chainHash,
    prevHash,
    inserted: true,
  };
}
