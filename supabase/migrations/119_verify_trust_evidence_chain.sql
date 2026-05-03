-- 119_verify_trust_evidence_chain.sql
--
-- Tier 1 #3 — Tamper-detect chain audit function.
--
-- Adds verify_trust_evidence_chain(p_job_id) RETURNS jsonb that recomputes
-- every chain_hash via compute_trust_evidence_chain_hash and validates that
-- prev_hash points back to the predecessor's chain_hash (sequence-ordered).
--
-- Returns: { total: int, broken: int, broken_ids: uuid[] }
-- broken=0 proves the chain has not been tampered with since insertion.
--
-- Pre-existing DB facts (per claude.ai MCP recon):
--   compute_trust_evidence_chain_hash IS prev-bound:
--     sha256(prev || '|' || response_sha || '|' || seq || '|' || job_id || '|' || finding_type)
--   append_trust_evidence RPC threads prev_hash atomically.
--   trust_evidence_prevent_mutation trigger blocks UPDATE — DELETE+INSERT
--   is the only way to "modify" a row, which would break the chain.
--
-- Idempotent. Re-applying is a no-op.

CREATE OR REPLACE FUNCTION public.verify_trust_evidence_chain(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH ordered AS (
    SELECT
      id, sequence_number, finding_type, response_sha256,
      prev_hash, chain_hash,
      LAG(chain_hash) OVER (ORDER BY sequence_number) AS predecessor_chain
    FROM trust_evidence
    WHERE job_id = p_job_id
  ),
  annotated AS (
    SELECT
      id,
      (
        (sequence_number = 0 AND prev_hash IS NOT NULL)
        OR (sequence_number > 0 AND (prev_hash IS NULL OR prev_hash <> predecessor_chain))
        OR (chain_hash <> compute_trust_evidence_chain_hash(
              prev_hash, response_sha256, sequence_number, p_job_id, finding_type))
      ) AS is_broken
    FROM ordered
  )
  SELECT jsonb_build_object(
    'total',      count(*),
    'broken',     count(*) FILTER (WHERE is_broken),
    'broken_ids', COALESCE(array_agg(id) FILTER (WHERE is_broken), '{}'::uuid[])
  )
  FROM annotated;
$$;

COMMENT ON FUNCTION public.verify_trust_evidence_chain(uuid) IS
  'Tier 1 #3 audit: recomputes every chain_hash and validates prev pointers
   for a job. Returns { total, broken, broken_ids }. broken=0 proves the
   evidence chain has not been tampered with since insertion.';
