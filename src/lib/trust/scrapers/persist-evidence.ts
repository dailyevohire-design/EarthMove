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
}

/**
 * Persist a ScraperEvidence row for a given job via the append_trust_evidence
 * RPC. The RPC is the single source of truth for prev-bound chain_hash
 * computation — it locks trust_jobs FOR UPDATE, reads predecessor chain_hash,
 * computes
 *   sha256(prev || '|' || response_sha || '|' || seq || '|' || job_id || '|' || finding_type)
 * via compute_trust_evidence_chain_hash, and inserts atomically.
 *
 * Idempotent on (job_id, source_key, response_sha256). Same scraper output
 * for the same job returns the existing row instead of creating a duplicate.
 *
 * MUST be called with a service_role Supabase client. trust_evidence has
 * no INSERT policy for non-service roles.
 *
 * Tier 1 #3 (2026-05-02): refactored from direct INSERT with TS-side
 * content-fingerprint chain_hash to RPC call. The RPC's prev-bound formula
 * is what verify_trust_evidence_chain audits against; the prior TS path
 * produced chain_hashes that would have failed the audit.
 */
export async function persistEvidence(input: PersistEvidenceInput): Promise<PersistEvidenceResult> {
  const { jobId, contractorId, evidence, supabase } = input;

  const { data, error } = await supabase.rpc('append_trust_evidence', {
    p_job_id:           jobId,
    p_contractor_id:    contractorId ?? null,
    p_source_key:       evidence.source_key,
    p_finding_type:     evidence.finding_type,
    p_confidence:       evidence.confidence,
    p_finding_summary:  evidence.finding_summary,
    p_extracted_facts:  evidence.extracted_facts ?? {},
    p_query_sent:       evidence.query_sent ?? null,
    p_response_sha256:  evidence.response_sha256 ?? null,
    p_response_snippet: evidence.response_snippet ?? null,
    p_duration_ms:      evidence.duration_ms ?? null,
    p_cost_cents:       evidence.cost_cents ?? 0,
    p_source_errored:   evidence.finding_type === 'source_error',
  });

  if (error) {
    throw new Error(`persistEvidence: append_trust_evidence RPC failed: ${error.message}`);
  }

  // RPC RETURNS trust_evidence — postgrest may surface as object or single-row array.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) {
    throw new Error('persistEvidence: RPC returned no row');
  }
  const evidenceId = row.id as string;

  // Tier 3 #1 commit 2: post-RPC officer-graph hook. Best-effort — failures
  // are logged and swallowed so officer extraction never blocks the evidence
  // write. The DB function returns { status, officers_processed, ... } and is
  // a no-op when extracted_facts.officers[] is missing/empty/malformed.
  try {
    const { data: extractResult, error: extractError } = await supabase
      .rpc('extract_officers_from_evidence', { p_evidence_id: evidenceId });
    if (extractError) {
      console.warn('[persist-evidence] officer extraction failed', {
        evidenceId,
        error: extractError.message,
        code: extractError.code,
      });
    } else if (
      extractResult
      && typeof extractResult === 'object'
      && typeof (extractResult as { officers_processed?: unknown }).officers_processed === 'number'
      && (extractResult as { officers_processed: number }).officers_processed > 0
    ) {
      const r = extractResult as { officers_processed: number; officers_skipped?: number };
      console.info('[persist-evidence] officers extracted', {
        evidenceId,
        officersProcessed: r.officers_processed,
        officersSkipped: r.officers_skipped,
      });
    }
    // status: 'no_officers' / 'evidence_not_found' / 'skipped_no_contractor' — silent, expected
  } catch (err) {
    console.warn('[persist-evidence] officer extraction threw', {
      evidenceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    evidenceId,
    sequenceNumber: row.sequence_number as number,
    chainHash:      row.chain_hash as string,
    prevHash:       (row.prev_hash as string | null) ?? null,
  };
}
