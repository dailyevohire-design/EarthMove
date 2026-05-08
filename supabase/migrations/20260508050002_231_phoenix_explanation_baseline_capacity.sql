-- 231: phoenix detector + score explanation + industry baseline capacity.
-- Already applied via MCP; symmetric record. Idempotent.
--
-- Three additions:
--   1. trust_reports.related_entities jsonb — phoenix detector output
--      (cross-entity relationships: address_reuse, officer_match,
--       phoenix_signal). Patent claim 1.
--   2. trust_reports.score_breakdown jsonb — per-evidence score
--      adjustment trail powering the ScoreExplanationCard. Audit
--      surface for the trust score.
--   3. trust_reports.industry_baseline jsonb — per-state percentile +
--      median snapshot at compute time. Powered by mv_state_score_baseline.
--
-- Materialized view mv_state_score_baseline aggregates trust_reports by
-- state with a forensic-test-fixture exclusion (FTEST_* contractor names
-- skew the CA baseline by ~159 rows per memory).
--
-- Refresh schedule: nightly via pg_cron (DO block at end).

-- 1. Three new jsonb columns on trust_reports.
ALTER TABLE public.trust_reports
  ADD COLUMN IF NOT EXISTS related_entities jsonb,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS industry_baseline jsonb;

COMMENT ON COLUMN public.trust_reports.related_entities IS
  'Cross-entity fraud-network detector output (patent claim 1). Array of {entity_name, status, formation_date, dissolution_date, shared_indicator, relationship_type, source_url}.';
COMMENT ON COLUMN public.trust_reports.score_breakdown IS
  'Per-evidence score adjustment trail: {base_score, adjustments: [{reason, delta, source, evidence_id}], final_score}. Powers ScoreExplanationCard.';
COMMENT ON COLUMN public.trust_reports.industry_baseline IS
  'Per-state percentile snapshot at compute time: {state_code, median_score, p25_score, p75_score, mean_score, sample_size, percentile_rank, computed_at}.';

-- 2. mv_state_score_baseline — per-state aggregate, FTEST_* excluded.
DROP MATERIALIZED VIEW IF EXISTS public.mv_state_score_baseline;
CREATE MATERIALIZED VIEW public.mv_state_score_baseline AS
SELECT
  state_code,
  COUNT(*)::integer                                                        AS sample_size,
  ROUND(AVG(trust_score)::numeric, 2)                                      AS mean_score,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY trust_score)::integer       AS median_score,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY trust_score)::integer       AS p25_score,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY trust_score)::integer       AS p75_score,
  now()                                                                    AS computed_at
FROM public.trust_reports
WHERE trust_score IS NOT NULL
  AND state_code IS NOT NULL
  AND contractor_name NOT LIKE 'FTEST_%'
GROUP BY state_code
HAVING COUNT(*) >= 5; -- minimum sample for meaningful percentile

CREATE UNIQUE INDEX IF NOT EXISTS mv_state_score_baseline_state_code_idx
  ON public.mv_state_score_baseline (state_code);

GRANT SELECT ON public.mv_state_score_baseline TO authenticated, service_role;

-- 3. Schedule nightly refresh (concurrent so reads aren't blocked).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh-mv-state-score-baseline')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-mv-state-score-baseline');
    PERFORM cron.schedule(
      'refresh-mv-state-score-baseline',
      '15 4 * * *',
      $cmd$REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_state_score_baseline;$cmd$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'mv_state_score_baseline cron schedule skipped: %', SQLERRM;
END $$;
