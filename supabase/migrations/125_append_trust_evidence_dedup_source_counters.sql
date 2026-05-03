-- Migration 125: Fix append_trust_evidence counter increment for multi-finding scrapers
--
-- Problem: append_trust_evidence increments sources_completed (or sources_failed)
-- on EVERY call. Multi-finding scrapers (denver_pim, dallas_open_data, courtlistener)
-- emit 2-N evidence rows per scraper run, each calling append_trust_evidence.
-- This over-counts sources_completed and violates the trust_jobs_counter_sanity
-- CHECK constraint: (sources_completed + sources_failed) <= total_sources_planned
--
-- Fix: Only increment sources_completed/sources_failed on the FIRST evidence row
-- per (job_id, source_key). Subsequent rows from the same source still increment
-- evidence_count and total_cost_cents.
--
-- Discovered 2026-05-03 during pre-launch synth validation. Applied via MCP
-- before this file was committed.

CREATE OR REPLACE FUNCTION public.append_trust_evidence(
  p_job_id uuid,
  p_contractor_id uuid,
  p_source_key text,
  p_finding_type text,
  p_confidence text,
  p_finding_summary text,
  p_extracted_facts jsonb DEFAULT '{}'::jsonb,
  p_query_sent text DEFAULT NULL::text,
  p_response_sha256 text DEFAULT NULL::text,
  p_response_bucket text DEFAULT NULL::text,
  p_response_path text DEFAULT NULL::text,
  p_response_snippet text DEFAULT NULL::text,
  p_duration_ms integer DEFAULT NULL::integer,
  p_cost_cents numeric DEFAULT 0,
  p_source_errored boolean DEFAULT false
)
 RETURNS trust_evidence
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_prev_hash       TEXT;
  v_sequence        INT;
  v_chain_hash      TEXT;
  v_row             trust_evidence;
  v_existing        trust_evidence;
  v_is_first_row    BOOLEAN;
BEGIN
  PERFORM 1 FROM trust_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'trust_jobs row % not found', p_job_id;
  END IF;

  IF p_response_sha256 IS NOT NULL THEN
    SELECT * INTO v_existing FROM trust_evidence
    WHERE job_id = p_job_id
      AND source_key = p_source_key
      AND response_sha256 = p_response_sha256
    LIMIT 1;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM trust_evidence
    WHERE job_id = p_job_id AND source_key = p_source_key
  ) INTO v_is_first_row;

  SELECT chain_hash, sequence_number + 1
    INTO v_prev_hash, v_sequence
  FROM trust_evidence
  WHERE job_id = p_job_id
  ORDER BY sequence_number DESC LIMIT 1;

  IF v_sequence IS NULL THEN
    v_sequence := 0; v_prev_hash := NULL;
  END IF;

  v_chain_hash := compute_trust_evidence_chain_hash(
    v_prev_hash, p_response_sha256, v_sequence, p_job_id, p_finding_type);

  INSERT INTO trust_evidence (
    job_id, contractor_id, source_key, sequence_number,
    finding_type, confidence, finding_summary, extracted_facts,
    query_sent, response_sha256, response_storage_bucket, response_storage_path,
    response_snippet, prev_hash, chain_hash, duration_ms, cost_cents
  ) VALUES (
    p_job_id, p_contractor_id, p_source_key, v_sequence,
    p_finding_type, p_confidence, p_finding_summary, COALESCE(p_extracted_facts, '{}'::JSONB),
    p_query_sent, p_response_sha256, p_response_bucket, p_response_path,
    p_response_snippet, v_prev_hash, v_chain_hash, p_duration_ms, COALESCE(p_cost_cents, 0)
  )
  RETURNING * INTO v_row;

  UPDATE trust_jobs
  SET evidence_count = evidence_count + 1,
      sources_completed = CASE
        WHEN v_is_first_row AND NOT p_source_errored THEN sources_completed + 1
        ELSE sources_completed
      END,
      sources_failed = CASE
        WHEN v_is_first_row AND p_source_errored THEN sources_failed + 1
        ELSE sources_failed
      END,
      total_cost_cents = total_cost_cents + COALESCE(p_cost_cents, 0)
  WHERE id = p_job_id;

  RETURN v_row;
END;
$function$;
