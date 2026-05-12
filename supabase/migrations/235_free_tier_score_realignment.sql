-- 235_free_tier_score_realignment.sql
--
-- Route free-tier scoring through the same weighted+capped SQL pipeline the
-- paid tier uses (calculate_contractor_trust_score), instead of the in-TS
-- additive buildScoreExplanation rules. Free-tier reports written since the
-- LLM removal on 2026-05-07 produced false LOW ratings on real bad actors
-- because uncapped per-finding deltas + missing positive Δ for active
-- entities pinned scores at the rails (0 or 100).
--
-- This migration introduces two SQL helpers used by the runtime (TS calls
-- score_free_tier_inline from finalizeFreeTier) and re-scores the 16 free-
-- tier rows from 2026-05-07 → 2026-05-12 in place.
--
-- Refs: dailyevohire/EarthMove src/lib/trust/orchestrator-v2.ts:finalizeFreeTier

-- A. score_free_tier_inline — wraps calculate_contractor_trust_score +
--    inserts a contractor_trust_scores history row. Free-tier mirror of
--    score_and_finalize_trust_report's intermediate insert. report_id is
--    backfilled by the orchestrator after the trust_reports INSERT.
CREATE OR REPLACE FUNCTION public.score_free_tier_inline(p_job_id uuid)
RETURNS contractor_trust_scores
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_computed contractor_trust_scores;
  v_inserted contractor_trust_scores;
BEGIN
  v_computed := calculate_contractor_trust_score(p_job_id);

  INSERT INTO contractor_trust_scores (
    contractor_id, job_id, report_id, score_version,
    composite_score, grade, risk_level,
    license_score, business_entity_score, legal_score, osha_score,
    bbb_score, phoenix_score, age_score,
    effective_weights, sanction_hit, license_suspended, state_has_license_board,
    evidence_count, structured_hit_rate, inputs_snapshot
  ) VALUES (
    v_computed.contractor_id, v_computed.job_id, NULL, v_computed.score_version,
    v_computed.composite_score, v_computed.grade, v_computed.risk_level,
    v_computed.license_score, v_computed.business_entity_score, v_computed.legal_score, v_computed.osha_score,
    v_computed.bbb_score, v_computed.phoenix_score, v_computed.age_score,
    v_computed.effective_weights, v_computed.sanction_hit, v_computed.license_suspended, v_computed.state_has_license_board,
    v_computed.evidence_count, v_computed.structured_hit_rate, v_computed.inputs_snapshot
  )
  RETURNING * INTO v_inserted;

  RETURN v_inserted;
END;
$function$;

-- B. trust_inputs_to_score_breakdown — pure jsonb helper. Mirrors the TS
--    projectInputsSnapshotToBreakdown helper so backfilled rows have the
--    same score_breakdown shape as runtime-generated rows.
CREATE OR REPLACE FUNCTION public.trust_inputs_to_score_breakdown(
  p_inputs   jsonb,
  p_composite numeric,
  p_weights  jsonb
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
  WITH cats AS (
    SELECT * FROM (VALUES
      ('license',  'license_score',  'license'),
      ('business', 'business_score', 'business'),
      ('legal',    'legal_score',    'legal'),
      ('osha',     'osha_score',     'osha'),
      ('bbb',      'bbb_score',      'bbb'),
      ('phoenix',  'phoenix_score',  'phoenix'),
      ('age',      'age_score',      'age'),
      ('permits',  'permit_score',   'permits')
    ) AS t(cat, score_key, weight_key)
  ),
  cat_adj AS (
    SELECT jsonb_build_object(
      'reason',      cat || ' sub-score ' || (p_inputs->>score_key) || '/100 × weight ' || (p_weights->>weight_key),
      'delta',       round( (p_inputs->>score_key)::numeric * (p_weights->>weight_key)::numeric ),
      'source',      cat,
      'evidence_id', NULL
    ) AS adj
    FROM cats
    WHERE (p_inputs->>score_key) IS NOT NULL
      AND (p_weights->>weight_key) IS NOT NULL
      AND (p_weights->>weight_key)::numeric > 0
  ),
  damp_adj AS (
    SELECT jsonb_build_object(
      'reason',      'Weakest-category dampener (×' || (p_inputs->>'dampener_applied') || ')',
      'delta',       0,
      'source',      'dampener',
      'evidence_id', NULL
    ) AS adj
    WHERE (p_inputs->>'dampener_applied') IS NOT NULL
      AND (p_inputs->>'dampener_applied')::numeric < 1.0
  ),
  cap_adj AS (
    SELECT jsonb_build_object(
      'reason',      'Hard cap: ' || (c->>'cap'),
      'delta',       0,
      'source',      'cap',
      'evidence_id', NULL
    ) AS adj
    FROM jsonb_array_elements(COALESCE(p_inputs->'hard_caps_applied', '[]'::jsonb)) AS c
  ),
  all_adj AS (
    SELECT adj FROM cat_adj
    UNION ALL SELECT adj FROM damp_adj
    UNION ALL SELECT adj FROM cap_adj
  )
  SELECT jsonb_build_object(
    'base_score',  0,
    'final_score', round(p_composite),
    'methodology', 'weighted_with_caps',
    'adjustments', COALESCE((SELECT jsonb_agg(adj) FROM all_adj), '[]'::jsonb)
  );
$function$;

-- C. Backfill the 16 templated_evidence_derived rows from 2026-05-07 → 2026-05-12.
--    Idempotent: only re-scores rows that don't already have a
--    contractor_trust_scores row for their job_id (skips rows already
--    realigned by a re-run of this migration).
--
--    Stale industry_baseline.percentile_rank is intentionally NOT recomputed
--    here; computeIndustryBaseline lives in TS and the next runtime trust
--    report refresh will pick up the new rank. Acceptable since percentile
--    is approximated from p25/median/p75 buckets.
DO $$
DECLARE
  r RECORD;
  v_score contractor_trust_scores;
BEGIN
  FOR r IN
    SELECT id AS report_id, job_id
    FROM trust_reports
    WHERE synthesis_model = 'templated_evidence_derived'
      AND job_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM contractor_trust_scores cts WHERE cts.job_id = trust_reports.job_id
      )
  LOOP
    v_score := score_free_tier_inline(r.job_id);

    UPDATE trust_reports
    SET trust_score     = v_score.composite_score::smallint,
        risk_level      = v_score.risk_level,
        score_breakdown = trust_inputs_to_score_breakdown(
                            v_score.inputs_snapshot,
                            v_score.composite_score,
                            v_score.effective_weights
                          )
    WHERE id = r.report_id;

    UPDATE contractor_trust_scores
    SET report_id = r.report_id
    WHERE job_id = r.job_id AND report_id IS NULL;
  END LOOP;
END $$;
