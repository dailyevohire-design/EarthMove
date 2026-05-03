-- 127_business_score_cross_jurisdiction_priority_fix
--
-- Bug:
--   calculate_contractor_trust_score's BUSINESS section orders candidate
--   evidence by ascending "badness" priority and LIMIT 1 picks the worst.
--   Current order is dissolved(0) → inactive(1) → not_found(2) → active(3),
--   which makes a cross-jurisdiction `business_not_found` row (e.g. tx_sos_biz
--   returning "no TX franchise tax record" for a Colorado-only contractor)
--   outrank the contractor's actual `business_active` evidence from CO SOS.
--   Result: business_score = 20 even when the contractor is in Good Standing
--   in its stated home state, dragging composite into HIGH risk via the
--   weakest-link dampener.
--
-- Fix:
--   Swap the priorities of business_active and business_not_found so
--   verified-active outranks not-found. New ordering:
--     business_dissolved → 0  (real adverse, worst)
--     business_inactive  → 1  (adverse)
--     business_active    → 2  (positive — outranks missing-data)
--     business_not_found → 3  (missing data, lowest)
--     else               → 4
--
--   No other changes. License section's analogous bug is logged as a
--   followup (FOLLOWUP-CROSS-CATEGORY-PRIORITY) and will be fixed
--   pre-emptively before DORA + TDLR scrapers ship.

CREATE OR REPLACE FUNCTION public.calculate_contractor_trust_score(p_job_id uuid)
 RETURNS contractor_trust_scores
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_job                     trust_jobs;
  v_state_has_license_board BOOLEAN;
  v_license_score           NUMERIC(5,2);
  v_business_score          NUMERIC(5,2);
  v_legal_score             NUMERIC(5,2);
  v_osha_score              NUMERIC(5,2);
  v_bbb_score               NUMERIC(5,2);
  v_phoenix_score           NUMERIC(5,2);
  v_phoenix_signals         JSONB;
  v_phoenix_total_weight    NUMERIC;
  v_age_score               NUMERIC(5,2);
  v_sanction_hit            BOOLEAN := FALSE;
  v_license_suspended       BOOLEAN := FALSE;
  v_w_license   NUMERIC := 0.25; v_w_business NUMERIC := 0.15;
  v_w_legal     NUMERIC := 0.20; v_w_osha     NUMERIC := 0.12;
  v_w_bbb       NUMERIC := 0.08; v_w_phoenix  NUMERIC := 0.15;
  v_w_age       NUMERIC := 0.05;
  v_total_weight NUMERIC; v_weighted_sum NUMERIC;
  v_composite   NUMERIC(5,2); v_grade TEXT; v_risk_level TEXT;
  v_weakest     NUMERIC;
  v_dampener    NUMERIC;
  v_evidence_count INT; v_structured_count INT; v_hit_rate NUMERIC(4,3);
  v_inputs JSONB; v_effective_weights JSONB;
  v_formation_date DATE; v_age_days INT;
  v_row contractor_trust_scores;
  v_bbb_rating TEXT;
  v_legal_judgment_count INT; v_legal_action_count INT;
BEGIN
  SELECT * INTO v_job FROM trust_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'trust_jobs row % not found', p_job_id; END IF;

  SELECT EXISTS(
    SELECT 1 FROM trust_source_registry
    WHERE is_active AND source_category = 'state_license'
      AND (applicable_state_codes IS NULL OR v_job.state_code = ANY(applicable_state_codes))
  ) INTO v_state_has_license_board;

  SELECT EXISTS(SELECT 1 FROM trust_evidence WHERE job_id = p_job_id AND finding_type = 'sanction_hit')
    INTO v_sanction_hit;
  SELECT EXISTS(SELECT 1 FROM trust_evidence WHERE job_id = p_job_id AND finding_type = 'license_suspended')
    INTO v_license_suspended;

  -- LICENSING
  IF v_state_has_license_board THEN
    SELECT CASE finding_type
      WHEN 'license_active' THEN CASE confidence
        WHEN 'verified_structured' THEN 100 WHEN 'high_llm' THEN 80
        WHEN 'medium_llm' THEN 65 ELSE 50 END
      WHEN 'license_suspended' THEN 0 WHEN 'license_expired' THEN 10
      WHEN 'license_inactive' THEN 10 WHEN 'license_not_found' THEN 15 END
    INTO v_license_score
    FROM trust_evidence WHERE job_id = p_job_id AND finding_type LIKE 'license_%'
    ORDER BY CASE finding_type
      WHEN 'license_suspended' THEN 0 WHEN 'license_expired' THEN 1
      WHEN 'license_inactive' THEN 2 WHEN 'license_not_found' THEN 3
      WHEN 'license_active' THEN 4 ELSE 5 END,
      CASE confidence WHEN 'verified_structured' THEN 0 WHEN 'high_llm' THEN 1
        WHEN 'medium_llm' THEN 2 ELSE 3 END, pulled_at DESC
    LIMIT 1;
  END IF;

  -- BUSINESS
  -- Priority swap (migration 127): business_active outranks business_not_found
  -- so cross-jurisdiction "no TX franchise tax record" no longer wins over a
  -- verified CO SOS Good Standing row.
  SELECT CASE finding_type
    WHEN 'business_active' THEN CASE confidence
      WHEN 'verified_structured' THEN 100 WHEN 'high_llm' THEN 75
      WHEN 'medium_llm' THEN 60 ELSE 50 END
    WHEN 'business_dissolved' THEN 0 WHEN 'business_inactive' THEN 30
    WHEN 'business_not_found' THEN 20 END
  INTO v_business_score
  FROM trust_evidence WHERE job_id = p_job_id AND finding_type LIKE 'business_%'
  ORDER BY CASE finding_type
    WHEN 'business_dissolved' THEN 0 WHEN 'business_inactive' THEN 1
    WHEN 'business_active' THEN 2 WHEN 'business_not_found' THEN 3 ELSE 4 END,
    CASE confidence WHEN 'verified_structured' THEN 0 WHEN 'high_llm' THEN 1 ELSE 2 END,
    pulled_at DESC
  LIMIT 1;

  -- LEGAL (TIGHTENED: actions now 50-15n floor 20; judgments unchanged)
  SELECT
    COUNT(*) FILTER (WHERE finding_type = 'legal_judgment_against'),
    COUNT(*) FILTER (WHERE finding_type = 'legal_action_found')
  INTO v_legal_judgment_count, v_legal_action_count
  FROM trust_evidence WHERE job_id = p_job_id AND finding_type LIKE 'legal_%';

  IF v_legal_judgment_count > 0 THEN
    v_legal_score := GREATEST(0, 30 - (v_legal_judgment_count * 10));
  ELSIF v_legal_action_count > 0 THEN
    v_legal_score := GREATEST(20, 50 - (v_legal_action_count * 15));
  ELSIF EXISTS(SELECT 1 FROM trust_evidence WHERE job_id = p_job_id AND finding_type = 'legal_no_actions') THEN
    v_legal_score := 92;
  END IF;

  -- OSHA (TIGHTENED: serious 20→15, violation 60→50)
  SELECT CASE finding_type
    WHEN 'osha_serious_violation' THEN 15
    WHEN 'osha_violation' THEN 50
    WHEN 'osha_no_violations' THEN 95 END
  INTO v_osha_score
  FROM trust_evidence WHERE job_id = p_job_id AND finding_type LIKE 'osha_%'
  ORDER BY CASE finding_type
    WHEN 'osha_serious_violation' THEN 0 WHEN 'osha_violation' THEN 1
    WHEN 'osha_no_violations' THEN 2 END, pulled_at DESC
  LIMIT 1;

  -- BBB (TIGHTENED: C/D/F lower)
  SELECT extracted_facts->>'rating' INTO v_bbb_rating FROM trust_evidence
  WHERE job_id = p_job_id AND finding_type = 'bbb_rating' ORDER BY pulled_at DESC LIMIT 1;

  IF v_bbb_rating IS NOT NULL THEN
    v_bbb_score := CASE UPPER(BTRIM(v_bbb_rating))
      WHEN 'A+' THEN 95 WHEN 'A' THEN 90 WHEN 'A-' THEN 85
      WHEN 'B+' THEN 72 WHEN 'B' THEN 65 WHEN 'B-' THEN 58
      WHEN 'C+' THEN 45 WHEN 'C' THEN 38 WHEN 'C-' THEN 30
      WHEN 'D+' THEN 25 WHEN 'D' THEN 22 WHEN 'D-' THEN 15
      WHEN 'F' THEN 8 ELSE 50 END;
  ELSIF EXISTS(SELECT 1 FROM trust_evidence WHERE job_id = p_job_id AND finding_type = 'bbb_accredited') THEN
    v_bbb_score := 85;
  ELSIF EXISTS(SELECT 1 FROM trust_evidence WHERE job_id = p_job_id AND finding_type = 'bbb_complaint') THEN
    v_bbb_score := 35;
  ELSIF EXISTS(SELECT 1 FROM trust_evidence WHERE job_id = p_job_id AND finding_type = 'bbb_not_profiled') THEN
    v_bbb_score := 72;
  END IF;

  -- PHOENIX (unchanged mechanics)
  v_phoenix_signals := detect_contractor_phoenix_signals(v_job.contractor_id);
  SELECT COALESCE(SUM((value->>'weight')::NUMERIC), 0) INTO v_phoenix_total_weight
  FROM jsonb_array_elements(v_phoenix_signals);
  v_phoenix_total_weight := LEAST(v_phoenix_total_weight, 1.0);
  v_phoenix_score := GREATEST(0, 100 - (v_phoenix_total_weight * 100))::NUMERIC(5,2);

  -- AGE (unchanged)
  SELECT (extracted_facts->>'formation_date')::DATE INTO v_formation_date
  FROM trust_evidence WHERE job_id = p_job_id
    AND finding_type = 'business_active' AND extracted_facts ? 'formation_date'
  ORDER BY CASE confidence WHEN 'verified_structured' THEN 0 ELSE 1 END, pulled_at DESC LIMIT 1;

  IF v_formation_date IS NOT NULL THEN
    v_age_days := (CURRENT_DATE - v_formation_date);
    v_age_score := CASE
      WHEN v_age_days < 0 THEN 50 WHEN v_age_days < 90 THEN 35
      WHEN v_age_days < 365 THEN 55 WHEN v_age_days < 1095 THEN 75
      WHEN v_age_days < 3650 THEN 90 ELSE 100 END;
  END IF;

  -- Weight redistribution
  IF v_license_score IS NULL  THEN v_w_license  := 0; END IF;
  IF v_business_score IS NULL THEN v_w_business := 0; END IF;
  IF v_legal_score IS NULL    THEN v_w_legal    := 0; END IF;
  IF v_osha_score IS NULL     THEN v_w_osha     := 0; END IF;
  IF v_bbb_score IS NULL      THEN v_w_bbb      := 0; END IF;
  IF v_phoenix_score IS NULL  THEN v_w_phoenix  := 0; END IF;
  IF v_age_score IS NULL      THEN v_w_age      := 0; END IF;

  v_total_weight := v_w_license + v_w_business + v_w_legal + v_w_osha + v_w_bbb + v_w_phoenix + v_w_age;

  -- Composite
  IF v_sanction_hit THEN
    v_composite := 0; v_grade := 'F'; v_risk_level := 'CRITICAL';
  ELSIF v_total_weight = 0 THEN
    v_composite := 50; v_grade := 'C'; v_risk_level := 'MEDIUM';
  ELSE
    v_weighted_sum := COALESCE(v_license_score, 0)  * v_w_license
                    + COALESCE(v_business_score, 0) * v_w_business
                    + COALESCE(v_legal_score, 0)    * v_w_legal
                    + COALESCE(v_osha_score, 0)     * v_w_osha
                    + COALESCE(v_bbb_score, 0)      * v_w_bbb
                    + COALESCE(v_phoenix_score, 0)  * v_w_phoenix
                    + COALESCE(v_age_score, 0)      * v_w_age;
    v_composite := ROUND(v_weighted_sum / v_total_weight, 2);

    -- WEAKEST-LINK DAMPENING (new in v2)
    -- When the lowest non-null category score is <65, pull composite toward it.
    -- Formula: composite × (0.70 + 0.30 × weakest/100)
    v_weakest := LEAST(
      COALESCE(v_license_score,  101),
      COALESCE(v_business_score, 101),
      COALESCE(v_legal_score,    101),
      COALESCE(v_osha_score,     101),
      COALESCE(v_bbb_score,      101),
      COALESCE(v_phoenix_score,  101),
      COALESCE(v_age_score,      101)
    );
    IF v_weakest < 65 THEN
      v_dampener := 0.70 + 0.30 * (v_weakest / 100.0);
      v_composite := ROUND(v_composite * v_dampener, 2);
    ELSE
      v_dampener := 1.0;
    END IF;

    IF v_license_suspended AND v_composite > 44 THEN v_composite := 44; END IF;

    v_grade := CASE WHEN v_composite >= 90 THEN 'A' WHEN v_composite >= 75 THEN 'B'
                    WHEN v_composite >= 60 THEN 'C' WHEN v_composite >= 45 THEN 'D' ELSE 'F' END;
    v_risk_level := CASE WHEN v_composite >= 75 THEN 'LOW' WHEN v_composite >= 60 THEN 'MEDIUM'
                          WHEN v_composite >= 45 THEN 'HIGH' ELSE 'CRITICAL' END;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE confidence = 'verified_structured')
  INTO v_evidence_count, v_structured_count FROM trust_evidence WHERE job_id = p_job_id;
  v_hit_rate := CASE WHEN v_evidence_count > 0
                     THEN ROUND(v_structured_count::NUMERIC / v_evidence_count, 3)
                     ELSE NULL END;

  v_effective_weights := jsonb_build_object(
    'license', v_w_license, 'business', v_w_business, 'legal', v_w_legal,
    'osha', v_w_osha, 'bbb', v_w_bbb, 'phoenix', v_w_phoenix,
    'age', v_w_age, 'total', v_total_weight);

  v_inputs := jsonb_build_object(
    'license_score', v_license_score, 'business_score', v_business_score,
    'legal_score', v_legal_score, 'legal_judgment_count', v_legal_judgment_count,
    'legal_action_count', v_legal_action_count, 'osha_score', v_osha_score,
    'bbb_score', v_bbb_score, 'bbb_rating', v_bbb_rating,
    'phoenix_score', v_phoenix_score, 'phoenix_signals', v_phoenix_signals,
    'phoenix_total_weight', v_phoenix_total_weight,
    'age_score', v_age_score, 'age_days', v_age_days, 'formation_date', v_formation_date,
    'sanction_hit', v_sanction_hit, 'license_suspended', v_license_suspended,
    'state_has_license_board', v_state_has_license_board,
    'weakest_category_score', CASE WHEN v_weakest = 101 THEN NULL ELSE v_weakest END,
    'dampener_applied', COALESCE(v_dampener, 1.0));

  v_row := ROW(
    NULL::BIGINT, v_job.contractor_id, p_job_id, NULL::UUID, 2, -- bumped to version 2
    v_composite, v_grade, v_risk_level,
    v_license_score, v_business_score, v_legal_score, v_osha_score,
    v_bbb_score, v_phoenix_score, v_age_score,
    v_effective_weights, v_sanction_hit, v_license_suspended, v_state_has_license_board,
    v_evidence_count, v_hit_rate, v_inputs, NOW()
  )::contractor_trust_scores;

  RETURN v_row;
END;
$function$;
