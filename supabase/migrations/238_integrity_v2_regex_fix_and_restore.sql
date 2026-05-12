-- 238_integrity_v2_regex_fix_and_restore.sql
--
-- Fix for mig 237's verify_trust_report_integrity trigger:
--   1. Regex check was \m<score>\M against the FIRST 240 chars only. Most
--      LLM-generated paid-tier summaries lead with contractor preamble
--      and mention the score later (after ~70 chars). Also missed
--      fractional scores (LLM saw 45.6/100; trust_score=46 → no match).
--   2. Backfill rewrote 555 paid-tier LLM summaries (390 sonnet rows!)
--      with the generic template. Audit table has the originals.
--
-- This migration:
--   A. Replaces the trigger with a tolerant regex (any number within ±2 of
--      trust_score immediately before "/100", anywhere in summary).
--   B. Restores LLM summaries from trust_report_audit for the 250 paid-tier
--      rows where score was NOT changed by mig 237 (so the LLM narrative
--      still matches the score). The 305 rows whose score was demoted by
--      the quorum gate keep their template (matches the new demoted score).

-- ============================================================
-- A. Replace the integrity trigger function (tolerant regex)
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_trust_report_integrity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_red_n INT;
  v_pos_n INT;
  v_extracted_red TEXT[];
  v_summary_mentions_score BOOLEAN := FALSE;
  v_match_num NUMERIC;
BEGIN
  -- Step 1: NULL-score short-circuit
  IF NEW.trust_score IS NULL THEN
    NEW.risk_level := NULL;
    IF NEW.summary IS NULL OR length(trim(NEW.summary)) = 0 THEN
      NEW.summary := build_trust_summary_text(NULL, NULL, 0, 0);
    END IF;
    RETURN NEW;
  END IF;

  -- Step 2: Force risk_level to band
  NEW.risk_level := band_for_score(NEW.trust_score::INT);

  -- Step 3: Quorum gate (DEMOTE not REJECT)
  IF NEW.trust_score >= 60 AND NOT source_quorum_satisfied(NEW.job_id) THEN
    NEW.trust_score := 59;
    NEW.risk_level := 'HIGH';
    NEW.requires_re_review := TRUE;
  END IF;

  -- Step 4: Red_flags auto-extract for low scores
  IF NEW.trust_score < 60 AND cardinality(COALESCE(NEW.red_flags, '{}')) = 0 THEN
    v_extracted_red := extract_red_flags_from_evidence(NEW.job_id);
    IF cardinality(v_extracted_red) > 0 THEN
      NEW.red_flags := v_extracted_red;
    ELSE
      NEW.requires_re_review := TRUE;
    END IF;
  END IF;

  -- Step 5: Confidence floor
  IF NEW.structured_source_hit_rate IS NOT NULL THEN
    NEW.confidence_level := least_confidence(
      NEW.confidence_level,
      confidence_for_hit_rate(NEW.structured_source_hit_rate)
    );
  END IF;

  -- Step 6: Tolerant summary verify. Scan the ENTIRE summary (not just
  -- the first 240 chars) for any "<number>/100" pattern whose number is
  -- within ±2 of the trust_score. Tolerates: fractional LLM scores
  -- (45.6/100 vs trust_score=46), late-in-text mentions (after contractor
  -- preamble), and minor rounding drift between SQL composite and what
  -- the LLM observed at synthesis time.
  v_red_n := cardinality(COALESCE(NEW.red_flags, '{}'));
  v_pos_n := cardinality(COALESCE(NEW.positive_indicators, '{}'));

  IF COALESCE(NEW.summary, '') <> '' THEN
    FOR v_match_num IN
      SELECT (m[1])::numeric
      FROM regexp_matches(NEW.summary, '([0-9]{1,3}(?:\.[0-9]+)?)\s*/\s*100', 'g') AS m
    LOOP
      IF abs(v_match_num - NEW.trust_score::numeric) <= 2.0 THEN
        v_summary_mentions_score := TRUE;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_summary_mentions_score THEN
    NEW.summary := build_trust_summary_text(NEW.trust_score::INT, NEW.risk_level, v_red_n, v_pos_n);
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- B. Restore LLM summaries from audit (paid-tier, score unchanged)
-- ============================================================

DO $$
DECLARE
  v_restored INT := 0;
BEGIN
  PERFORM set_config('app.change_source', 'migration-238-llm-summary-restore', TRUE);

  WITH first_audit AS (
    SELECT DISTINCT ON (a.report_id)
      a.report_id, a.summary_before, a.trust_score_before, a.trust_score_after
    FROM trust_report_audit a
    WHERE a.change_source = 'migration-237-backfill'
    ORDER BY a.report_id, a.changed_at ASC
  ),
  restorable AS (
    SELECT fa.report_id, fa.summary_before
    FROM first_audit fa
    JOIN trust_reports tr ON tr.id = fa.report_id
    WHERE tr.synthesis_model IN ('claude-opus-4-7', 'claude-sonnet-4-6')
      AND fa.summary_before IS DISTINCT FROM (SELECT summary FROM trust_reports WHERE id = fa.report_id)
      AND fa.trust_score_before IS NOT DISTINCT FROM fa.trust_score_after
      AND fa.summary_before IS NOT NULL
      AND length(fa.summary_before) > 0
  )
  UPDATE trust_reports tr
  SET summary = r.summary_before
  FROM restorable r
  WHERE tr.id = r.report_id;

  GET DIAGNOSTICS v_restored = ROW_COUNT;
  RAISE NOTICE 'mig 238: restored % LLM summaries', v_restored;
END $$;

COMMENT ON FUNCTION verify_trust_report_integrity IS
  'BEFORE INSERT OR UPDATE trigger fn on trust_reports. Enforces 6 invariants; demotes (not rejects) on quorum failure. Summary check is tolerant — any number within ±2 of trust_score followed by /100, anywhere in summary, counts as a match (handles fractional LLM scores + late-in-text mentions).';
