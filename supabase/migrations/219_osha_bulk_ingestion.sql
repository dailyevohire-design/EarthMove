-- supabase/migrations/222_osha_bulk_ingestion.sql
--
-- Applied to production via Supabase MCP on 2026-05-06 with label
-- '219_osha_bulk_ingestion' (registered version 20260506125949).
-- This file is committed for repo-level documentation only — DO NOT
-- run `supabase db push`. Per the EarthMove workflow, schema changes
-- apply via MCP only and migration files are documentation.
--
-- Replaces the live HTML-scrape osha_score path with a local DB lookup
-- backed by weekly DOL bulk-CSV ingestion. pg_trgm operator class lives
-- in the `extensions` schema on Supabase, qualified accordingly.

CREATE TABLE IF NOT EXISTS public.osha_establishments (
  estab_id          text PRIMARY KEY,
  name_raw          text NOT NULL,
  name_norm         text NOT NULL,
  street            text,
  city              text,
  state             text,
  zip               text,
  naics             text,
  sic               text,
  ownership         text,
  ingested_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_osha_estab_name_norm_trgm
  ON public.osha_establishments USING gin (name_norm extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_osha_estab_state_naics
  ON public.osha_establishments (state, naics);
CREATE INDEX IF NOT EXISTS idx_osha_estab_naics_construction
  ON public.osha_establishments (state, name_norm)
  WHERE naics LIKE '23%';

CREATE TABLE IF NOT EXISTS public.osha_inspections (
  activity_nr       text PRIMARY KEY,
  estab_id          text NOT NULL,
  reporting_id      text,
  state_flag        text,
  open_date         date,
  close_case_date   date,
  case_mod_date     date,
  insp_scope        text,
  insp_type         text,
  adv_notice        text,
  open_conf         text,
  close_conf        text,
  union_status      text,
  safety_hlth       text,
  migrant           text,
  mail_street       text,
  mail_city         text,
  mail_state        text,
  mail_zip          text,
  ingested_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_osha_insp_estab_date
  ON public.osha_inspections (estab_id, open_date DESC);
CREATE INDEX IF NOT EXISTS idx_osha_insp_open_date
  ON public.osha_inspections (open_date DESC);

CREATE TABLE IF NOT EXISTS public.osha_violations (
  activity_nr       text NOT NULL,
  citation_id       text NOT NULL,
  std_alpha         text,
  std_lookup        text,
  issuance_date     date,
  abate_date        date,
  current_penalty   numeric(12,2),
  initial_penalty   numeric(12,2),
  contest_date      date,
  final_order_date  date,
  nr_instances      integer,
  nr_exposed        integer,
  rec               text,
  gravity           integer,
  emphasis          text,
  hazcat            text,
  fta_insp_nr       text,
  viol_type         text,
  ingested_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_nr, citation_id)
);
CREATE INDEX IF NOT EXISTS idx_osha_viol_activity
  ON public.osha_violations (activity_nr);
CREATE INDEX IF NOT EXISTS idx_osha_viol_severity
  ON public.osha_violations (viol_type)
  WHERE viol_type IN ('S','W','R');
CREATE INDEX IF NOT EXISTS idx_osha_viol_issuance
  ON public.osha_violations (issuance_date DESC);

CREATE TABLE IF NOT EXISTS public.osha_ingestion_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  status            text NOT NULL DEFAULT 'running',
  source_url        text NOT NULL,
  rows_inspections  integer NOT NULL DEFAULT 0,
  rows_violations   integer NOT NULL DEFAULT 0,
  rows_establishments integer NOT NULL DEFAULT 0,
  high_water_mark   date,
  error_message     text,
  notes             text
);
CREATE INDEX IF NOT EXISTS idx_osha_ingest_completed
  ON public.osha_ingestion_runs (completed_at DESC NULLS FIRST);

ALTER TABLE public.osha_establishments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.osha_inspections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.osha_violations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.osha_ingestion_runs    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS osha_estab_service_only ON public.osha_establishments;
CREATE POLICY osha_estab_service_only ON public.osha_establishments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS osha_insp_service_only ON public.osha_inspections;
CREATE POLICY osha_insp_service_only ON public.osha_inspections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS osha_viol_service_only ON public.osha_violations;
CREATE POLICY osha_viol_service_only ON public.osha_violations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS osha_ingest_service_only ON public.osha_ingestion_runs;
CREATE POLICY osha_ingest_service_only ON public.osha_ingestion_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.osha_lookup_findings(
  p_name_norm  text,
  p_state      text DEFAULT NULL,
  p_lookback_years integer DEFAULT 5
) RETURNS TABLE (
  estab_id              text,
  name_match            text,
  match_similarity      numeric,
  inspection_count      integer,
  serious_count         integer,
  willful_count         integer,
  repeat_count          integer,
  other_count           integer,
  total_current_penalty numeric,
  most_recent_date      date,
  most_severe_type      text,
  activity_nrs          text[],
  citation_ids          text[]
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH matched_estabs AS (
    SELECT e.estab_id, e.name_raw, e.state,
           extensions.similarity(e.name_norm, p_name_norm) AS sim
    FROM public.osha_establishments e
    WHERE e.name_norm operator(extensions.%) p_name_norm
      AND (p_state IS NULL OR e.state = p_state)
      AND (e.naics LIKE '23%' OR e.naics IS NULL)
      AND extensions.similarity(e.name_norm, p_name_norm) > 0.45
  ),
  scoped_inspections AS (
    SELECT i.activity_nr, i.estab_id, i.open_date, m.name_raw, m.sim
    FROM matched_estabs m
    JOIN public.osha_inspections i ON i.estab_id = m.estab_id
    WHERE i.open_date >= (now() - (p_lookback_years || ' years')::interval)::date
  ),
  agg AS (
    SELECT
      si.estab_id,
      MAX(si.name_raw) AS name_match,
      MAX(si.sim)::numeric AS match_similarity,
      COUNT(DISTINCT si.activity_nr)::integer AS inspection_count,
      COUNT(*) FILTER (WHERE v.viol_type = 'S')::integer AS serious_count,
      COUNT(*) FILTER (WHERE v.viol_type = 'W')::integer AS willful_count,
      COUNT(*) FILTER (WHERE v.viol_type = 'R')::integer AS repeat_count,
      COUNT(*) FILTER (WHERE v.viol_type IN ('O','U'))::integer AS other_count,
      COALESCE(SUM(v.current_penalty), 0)::numeric AS total_current_penalty,
      MAX(si.open_date) AS most_recent_date,
      CASE
        WHEN COUNT(*) FILTER (WHERE v.viol_type = 'W') > 0 THEN 'W'
        WHEN COUNT(*) FILTER (WHERE v.viol_type = 'R') > 0 THEN 'R'
        WHEN COUNT(*) FILTER (WHERE v.viol_type = 'S') > 0 THEN 'S'
        WHEN COUNT(*) FILTER (WHERE v.viol_type IS NOT NULL) > 0 THEN 'O'
        ELSE NULL
      END AS most_severe_type,
      array_agg(DISTINCT si.activity_nr) AS activity_nrs,
      array_agg(DISTINCT v.citation_id) FILTER (WHERE v.citation_id IS NOT NULL) AS citation_ids
    FROM scoped_inspections si
    LEFT JOIN public.osha_violations v ON v.activity_nr = si.activity_nr
    GROUP BY si.estab_id
  )
  SELECT * FROM agg ORDER BY match_similarity DESC, inspection_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.osha_lookup_findings(text, text, integer) TO service_role;

-- Registry config for osha_est_search is owned by migration 220
-- (data.dol.gov pivot). 219 stays data-layer-only so the two migrations
-- stack cleanly without conflicting UPDATEs.
