-- ============================================================
-- Migration 240: industry_baseline SQL twin + trigger
--
-- Problem: industry_baseline column on trust_reports is only written by
-- the TS-side computeIndustryBaseline() called from finalizeFreeTier
-- (orchestrator-v2.ts:621). Paid-tier rows never get it. Backfilled rows
-- (~314 score changes from mig 235/236/237) have stale percentile_rank
-- computed against the old trust_score. The TS percentile_rank algorithm
-- itself has a bug (TX score=35 against median=100 returned ~50%ile when
-- it should be ~5%ile).
--
-- Fix: SQL twin compute_industry_baseline(state_code, score) returns
-- the JSONB shape consumed by ScoreExplanationCard. BEFORE INSERT/UPDATE
-- trigger fires after integrity_v2 (alphabetic ordering: trust_reports_
-- integrity_v2 -> trust_reports_post_integrity_industry_baseline) so it
-- sees post-demote trust_score. Backfill all rows where industry_baseline
-- is stale.
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_industry_baseline(
  p_state_code text,
  p_trust_score smallint
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_baseline mv_state_score_baseline%ROWTYPE;
  v_total INT;
  v_lower INT;
  v_percentile NUMERIC(5,3);
BEGIN
  IF p_state_code IS NULL OR p_trust_score IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_baseline FROM mv_state_score_baseline WHERE state_code = p_state_code;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE trust_score < p_trust_score)
  INTO v_total, v_lower
  FROM trust_reports
  WHERE state_code = p_state_code
    AND trust_score IS NOT NULL
    AND data_integrity_status IN ('ok', 'partial')
    AND created_at > now() - interval '90 days';

  v_percentile := CASE WHEN v_total > 0
    THEN (v_lower::numeric / v_total::numeric)::numeric(5,3)
    ELSE NULL END;

  RETURN jsonb_build_object(
    'scope', 'state',
    'state_code', v_baseline.state_code,
    'median_score', v_baseline.median_score,
    'p25_score', v_baseline.p25_score,
    'p75_score', v_baseline.p75_score,
    'mean_score', v_baseline.mean_score,
    'sample_size', v_baseline.sample_size,
    'computed_at', now(),
    'percentile_rank', v_percentile
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_industry_baseline()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.trust_score IS NOT NULL AND NEW.state_code IS NOT NULL
     AND NEW.data_integrity_status IN ('ok', 'partial') THEN
    NEW.industry_baseline := compute_industry_baseline(NEW.state_code, NEW.trust_score);
  ELSE
    NEW.industry_baseline := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trust_reports_post_integrity_industry_baseline ON public.trust_reports;
CREATE TRIGGER trust_reports_post_integrity_industry_baseline
  BEFORE INSERT OR UPDATE OF trust_score, state_code, data_integrity_status
  ON public.trust_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_industry_baseline();

UPDATE trust_reports
SET trust_score = trust_score
WHERE trust_score IS NOT NULL
  AND state_code IS NOT NULL
  AND data_integrity_status IN ('ok', 'partial');
