-- 250_contractor_permits.sql
--
-- PROVENANCE NOTE
-- ----------------
-- This migration was applied to prod (gaawvpzzmotimblyesfp) out-of-band
-- via Supabase MCP before being committed to the repo. Captured here on
-- 2026-05-13 to restore repo↔prod symmetry. Table DDL was rebuilt from
-- information_schema + pg_indexes + pg_constraint; RPC body is a verbatim
-- pg_get_functiondef() copy of the live upsert_contractor_permit function.
--
-- WHAT IT ADDS
-- ------------
-- public.contractor_permits — single normalized table for all permit-data
-- ingest workers (Austin Open Data, future Phoenix/Denver/Dallas/Aurora/
-- Boulder/Fort Worth). One row per (source, source_permit_id).
-- contractor_id is nullable and resolved separately via a fuzzy-match
-- resolver (mig TBD — pg_trgm-based contractor_name_raw → contractors.id).
--
-- public.upsert_contractor_permit(...) — idempotent ingest RPC. Conflicts
-- on (source, source_permit_id) update permit_status, completed_date,
-- permit_value, raw_record, and ingested_at. contractor_id only
-- back-fills if the new row provides a non-NULL value (never overwrites
-- a previously-resolved contractor_id with NULL from a fresh raw fetch).
--
-- Both the CREATE TABLE and CREATE OR REPLACE FUNCTION are written
-- idempotently so applying this migration to prod is a clean no-op
-- (table already exists with the same shape; function body matches).

BEGIN;

CREATE TABLE IF NOT EXISTS public.contractor_permits (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id        uuid REFERENCES public.contractors(id) ON DELETE CASCADE,
  contractor_name_raw  text NOT NULL,
  source               text NOT NULL CHECK (source IN (
    'austin_open_data',
    'phoenix_open_data',
    'denver_cpd',
    'dallas_open_data',
    'fort_worth',
    'aurora',
    'boulder',
    'manual'
  )),
  source_permit_id     text NOT NULL,
  permit_type          text,
  permit_status        text,
  work_description     text,
  job_address          text,
  job_city             text,
  job_state            text,
  job_zip              text,
  job_county           text,
  job_lat              numeric,
  job_lng              numeric,
  issued_date          date,
  completed_date       date,
  permit_value         numeric,
  raw_record           jsonb,
  ingested_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_permit_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_contractor  ON public.contractor_permits (contractor_id);
CREATE INDEX IF NOT EXISTS idx_cp_issued      ON public.contractor_permits (issued_date DESC);
CREATE INDEX IF NOT EXISTS idx_cp_state_city  ON public.contractor_permits (job_state, job_city);
CREATE INDEX IF NOT EXISTS idx_cp_zip         ON public.contractor_permits (job_zip);

COMMENT ON TABLE public.contractor_permits IS
  'Normalized construction permit records ingested from municipal open-data sources. contractor_id is nullable; resolved separately by a fuzzy-match worker from contractor_name_raw. Read by compute_homeowner_alerts_v2 for the PERMIT_PORTFOLIO_MISMATCH signal and by future portfolio-claim cross-references.';

CREATE OR REPLACE FUNCTION public.upsert_contractor_permit(
  p_contractor_id uuid,
  p_contractor_raw text,
  p_source text,
  p_source_id text,
  p_permit_type text,
  p_status text,
  p_work_desc text,
  p_address text,
  p_city text,
  p_state text,
  p_zip text,
  p_county text,
  p_lat numeric,
  p_lng numeric,
  p_issued date,
  p_completed date,
  p_value numeric,
  p_raw jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE result_id uuid;
BEGIN
  INSERT INTO contractor_permits (
    contractor_id, contractor_name_raw, source, source_permit_id,
    permit_type, permit_status, work_description,
    job_address, job_city, job_state, job_zip, job_county, job_lat, job_lng,
    issued_date, completed_date, permit_value, raw_record
  ) VALUES (
    p_contractor_id, p_contractor_raw, p_source, p_source_id,
    p_permit_type, p_status, p_work_desc,
    p_address, p_city, p_state, p_zip, p_county, p_lat, p_lng,
    p_issued, p_completed, p_value, p_raw
  )
  ON CONFLICT (source, source_permit_id) DO UPDATE
    SET contractor_id  = COALESCE(EXCLUDED.contractor_id, contractor_permits.contractor_id),
        permit_status  = EXCLUDED.permit_status,
        completed_date = EXCLUDED.completed_date,
        permit_value   = EXCLUDED.permit_value,
        raw_record     = EXCLUDED.raw_record,
        ingested_at    = now()
  RETURNING id INTO result_id;
  RETURN result_id;
END $function$;

-- Default Supabase grants (anon/authenticated/service_role get EXECUTE on
-- public functions automatically). Explicit here for documentation only.
GRANT EXECUTE ON FUNCTION public.upsert_contractor_permit(
  uuid, text, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, date, date, numeric, jsonb
) TO authenticated, anon, service_role;

COMMIT;
