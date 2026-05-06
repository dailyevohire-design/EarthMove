-- 223_score_hard_caps_and_osha_vocab_alignment
--
-- Already applied via MCP on 2026-05-06. This file is the symmetric repo mirror,
-- dumped from pg_get_functiondef on the live function.
--
-- Four surgical fixes to calculate_contractor_trust_score, all driven by the
-- Judge DFW $5M fraud test on 2026-05-06:
--
-- 1. Hard cap at 35 for business_not_found — entity claims to be registered
--    but no record exists in our SOS data. Mirrors existing license_suspended
--    cap at 44 and sanction_hit cap at 0. Closes the false negative where
--    a fraud LLC scored 51 (mid-tier) instead of low-30s.
--
-- 2. Hard cap at 25 for license_revoked — license_score already maps revoked
--    to 0, but the dampener softens the composite too much. Mirrors the
--    suspended-cap pattern for the revoked case.
--
-- 3. Phoenix score → NULL (not 100) when contractor has zero officer links
--    in our SOS data. Today, an unregistered fraud entity scores 100 on
--    phoenix because there's no source data to find related entities. NULL
--    drops phoenix from the weighted average instead of contributing a
--    misleading clean score.
--
-- 4. OSHA finding-type vocabulary alignment — the score function only knew
--    {osha_violation, osha_serious_violation, osha_no_violations} but the
--    new OSHA scorer (mig 219) emits {osha_willful_citation,
--    osha_repeat_citation, osha_serious_citation, osha_inspection_no_violation,
--    osha_violations_clean}. Without this fix, OSHA evidence would never
--    affect any score regardless of severity.
--
-- Verified on Judge DFW LLC: re-scored from 51.62/D/HIGH to 35.00/F/CRITICAL
-- on the same evidence (caps_fired=[business_not_found→35], phoenix=NULL).

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
  v_phoenix_evaluable       BOOLEAN := FALSE;
  v_age_score               NUMERIC(5,2);
  v_permit_score            NUMERIC(5,2);
  v_sanction_hit            BOOLEAN := FALSE;
  v_license_suspended       BOOLEAN := FALSE;
  v_license_revoked         BOOLEAN := FALSE;
  v_business_not_found      BOOLEAN := FALSE;
  v_w_license   NUMERIC := 0.25; v_w_business NUMERIC := 0.15;
  v_w_legal     NUMERIC := 0.20; v_w_osha     NUMERIC := 0.12;
  v_w_bbb       NUMERIC := 0.08; v_w_phoenix  NUMERIC := 0.15;
  v_w_age       NUMERIC := 0.05; v_w_permits  NUMERIC := 0.05;
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
  v_permit_finding TEXT;
  v_caps_applied JSONB := '[]'::jsonb;
  v_officer_link_count INT;
BEGIN
  SELECT * INTO v_job FROM trust_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'trust_jobs row % not found', p_job_id; END IF;

  SELECT EXISTS(
    SELECT 1 FROM trust_source_registry
    WHERE is_active AND source_category = 'state_license'
      AND (applicable_state_codes IS NULL OR v_job.state_code = ANY(applicable_state_codes))
  ) INTO v_state_has_license_board;

  -- Severity flags drive both scoring AND hard caps below
  SELECT EXISTS(SELECT 1 FROM trust_evidence WHERE job_id = p_job_id AND finding_type = 'sanction_hit')
    INTO v_sanction_hit;
  SELECT EXISTS(SELECT 1 FROM trust_evidence WHERE job_id = p_job_id AND finding_type = 'license_suspended')
    INTO v_license_suspended;
  SELECT EXISTS(SELECT 1 FROM trust_evidence WHERE job_id = p_job_id AND finding_type = 'license_revoked')
    INTO v_license_revoked;
  SELECT EXISTS(SELECT 1 FROM trust_evidence WHERE job_id = p_job_id AND finding_type = 'business_not_found')
    INTO v_business_not_found;

  -- LICENSE
  IF v_state_has_license_board THEN
    SELECT CASE finding_type
      WHEN 'license_active' THEN CASE confidence
        WHEN 'verified_structured' THEN 100 WHEN 'high_llm' THEN 80
        WHEN 'medium_llm' THEN 65 ELSE 50 END
      WHEN 'license_revoked'             THEN 0
      WHEN 'license_suspended'           THEN 0
      WHEN 'license_disciplinary_action' THEN 30
      WHEN 'license_expired'             THEN 10
      WHEN 'license_inactive'            THEN 10
      WHEN 'license_not_found'           THEN 15
      WHEN 'license_no_record'           THEN 75 END
    INTO v_license_score
    FROM trust_evidence WHERE job_id = p_job_id AND finding_type LIKE 'license_%'
    ORDER BY CASE finding_type
      WHEN 'license_revoked'             THEN 0
      WHEN 'license_suspended'           THEN 1
      WHEN 'license_disciplinary_action' THEN 2
      WHEN 'license_expired'             THEN 3
      WHEN 'license_inactive'            THEN 4
      WHEN 'license_not_found'           THEN 5
      WHEN 'license_no_record'           THEN 6
      WHEN 'license_active'              THEN 7
      ELSE 9 END,
      CASE confidence WHEN 'verified_structured' THEN 0 WHEN 'high_llm' THEN 1
        WHEN 'medium_llm' THEN 2 ELSE 3 END, pulled_at DESC
    LIMIT 1;
  END IF;

  -- BUSINESS ENTITY
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

  -- LEGAL (court records)
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

  -- OSHA — handles BOTH legacy (osha_violation, osha_serious_violation,
  -- osha_no_violations) AND new vocabulary (osha_willful_citation,
  -- osha_repeat_citation, osha_serious_citation, osha_inspection_no_violation,
  -- osha_violations_clean). Severity ordering: willful > repeat > serious >
  -- legacy_violation > legacy_serious > legacy_no_violations > inspection_no_violation
  -- > violations_clean > legacy_no_violations.
  SELECT CASE finding_type
    -- New vocabulary (mig 219+)
    WHEN 'osha_willful_citation'       THEN 5
    WHEN 'osha_repeat_citation'        THEN 15
    WHEN 'osha_serious_citation'       THEN 35
    WHEN 'osha_inspection_no_violation' THEN 75
    WHEN 'osha_violations_clean'       THEN 95
    WHEN 'osha_fatality_finding'       THEN 0
    -- Legacy vocabulary (pre-mig 219)
    WHEN 'osha_serious_violation'      THEN 15
    WHEN 'osha_violation'              THEN 50
    WHEN 'osha_no_violations'          THEN 95
  END
  INTO v_osha_score
  FROM trust_evidence WHERE job_id = p_job_id AND finding_type LIKE 'osha_%'
    AND finding_type NOT IN ('source_error','source_not_applicable')
  ORDER BY CASE finding_type
    WHEN 'osha_fatality_finding'       THEN 0
    WHEN 'osha_willful_citation'       THEN 1
    WHEN 'osha_repeat_citation'        THEN 2
    WHEN 'osha_serious_citation'       THEN 3
    WHEN 'osha_serious_violation'      THEN 4
    WHEN 'osha_violation'              THEN 5
    WHEN 'osha_inspection_no_violation' THEN 6
    WHEN 'osha_violations_clean'       THEN 7
    WHEN 'osha_no_violations'          THEN 8
    ELSE 9 END, pulled_at DESC
  LIMIT 1;

  -- BBB
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

  -- PHOENIX — new logic: only evaluable when we have officer-link data for this
  -- contractor. Without source data, "no phoenix signals" = "we couldn't check"
  -- not "no signals exist". Drop from weighted average instead of contributing 100.
  SELECT COUNT(*) INTO v_officer_link_count
  FROM trust_officer_links
  WHERE contractor_id = v_job.contractor_id;

  IF v_officer_link_count > 0 THEN
    v_phoenix_evaluable := TRUE;
    v_phoenix_signals := detect_contractor_phoenix_signals(v_job.contractor_id);
    SELECT COALESCE(SUM((value->>'weight')::NUMERIC), 0) INTO v_phoenix_total_weight
    FROM jsonb_array_elements(v_phoenix_signals);
    v_phoenix_total_weight := LEAST(v_phoenix_total_weight, 1.0);
    v_phoenix_score := GREATEST(0, 100 - (v_phoenix_total_weight * 100))::NUMERIC(5,2);
  ELSE
    v_phoenix_signals := '[]'::jsonb;
    v_phoenix_total_weight := 0;
    v_phoenix_score := NULL;  -- cannot evaluate; weight will be set to 0 below
  END IF;

  -- AGE
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

  -- PERMITS
  SELECT finding_type INTO v_permit_finding
  FROM trust_evidence WHERE job_id = p_job_id AND finding_type LIKE 'permit_%'
  ORDER BY CASE finding_type
    WHEN 'permit_history_robust' THEN 0
    WHEN 'permit_history_clean'  THEN 1
    WHEN 'permit_history_low'    THEN 2
    WHEN 'permit_history_stale'  THEN 3
    ELSE 9 END,
    CASE confidence WHEN 'verified_structured' THEN 0 WHEN 'high_llm' THEN 1
      WHEN 'medium_llm' THEN 2 ELSE 3 END,
    pulled_at DESC
  LIMIT 1;

  v_permit_score := CASE v_permit_finding
    WHEN 'permit_history_robust' THEN 95
    WHEN 'permit_history_clean'  THEN 80
    WHEN 'permit_history_low'    THEN 50
    WHEN 'permit_history_stale'  THEN 30
  END;

  -- Zero out weights for missing components
  IF v_license_score IS NULL  THEN v_w_license  := 0; END IF;
  IF v_business_score IS NULL THEN v_w_business := 0; END IF;
  IF v_legal_score IS NULL    THEN v_w_legal    := 0; END IF;
  IF v_osha_score IS NULL     THEN v_w_osha     := 0; END IF;
  IF v_bbb_score IS NULL      THEN v_w_bbb      := 0; END IF;
  IF v_phoenix_score IS NULL  THEN v_w_phoenix  := 0; END IF;
  IF v_age_score IS NULL      THEN v_w_age      := 0; END IF;
  IF v_permit_score IS NULL   THEN v_w_permits  := 0; END IF;

  v_total_weight := v_w_license + v_w_business + v_w_legal + v_w_osha
                  + v_w_bbb + v_w_phoenix + v_w_age + v_w_permits;

  -- Composite + dampener + hard caps
  IF v_sanction_hit THEN
    v_composite := 0; v_grade := 'F'; v_risk_level := 'CRITICAL';
    v_caps_applied := v_caps_applied || jsonb_build_object('cap','sanction_hit','value',0);
  ELSIF v_total_weight = 0 THEN
    v_composite := 50; v_grade := 'C'; v_risk_level := 'MEDIUM';
  ELSE
    v_weighted_sum := COALESCE(v_license_score, 0)  * v_w_license
                    + COALESCE(v_business_score, 0) * v_w_business
                    + COALESCE(v_legal_score, 0)    * v_w_legal
                    + COALESCE(v_osha_score, 0)     * v_w_osha
                    + COALESCE(v_bbb_score, 0)      * v_w_bbb
                    + COALESCE(v_phoenix_score, 0)  * v_w_phoenix
                    + COALESCE(v_age_score, 0)      * v_w_age
                    + COALESCE(v_permit_score, 0)   * v_w_permits;
    v_composite := ROUND(v_weighted_sum / v_total_weight, 2);

    v_weakest := LEAST(
      COALESCE(v_license_score,  101),
      COALESCE(v_business_score, 101),
      COALESCE(v_legal_score,    101),
      COALESCE(v_osha_score,     101),
      COALESCE(v_bbb_score,      101),
      COALESCE(v_phoenix_score,  101),
      COALESCE(v_age_score,      101),
      COALESCE(v_permit_score,   101)
    );
    IF v_weakest < 65 THEN
      v_dampener := 0.70 + 0.30 * (v_weakest / 100.0);
      v_composite := ROUND(v_composite * v_dampener, 2);
    ELSE
      v_dampener := 1.0;
    END IF;

    -- Hard caps (apply post-dampener, in severity order — most-severe wins)
    IF v_license_revoked AND v_composite > 25 THEN
      v_composite := 25;
      v_caps_applied := v_caps_applied || jsonb_build_object('cap','license_revoked','value',25);
    END IF;
    IF v_business_not_found AND v_composite > 35 THEN
      v_composite := 35;
      v_caps_applied := v_caps_applied || jsonb_build_object('cap','business_not_found','value',35);
    END IF;
    IF v_license_suspended AND v_composite > 44 THEN
      v_composite := 44;
      v_caps_applied := v_caps_applied || jsonb_build_object('cap','license_suspended','value',44);
    END IF;

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
    'age', v_w_age, 'permits', v_w_permits, 'total', v_total_weight);

  v_inputs := jsonb_build_object(
    'license_score', v_license_score, 'business_score', v_business_score,
    'legal_score', v_legal_score, 'legal_judgment_count', v_legal_judgment_count,
    'legal_action_count', v_legal_action_count, 'osha_score', v_osha_score,
    'bbb_score', v_bbb_score, 'bbb_rating', v_bbb_rating,
    'phoenix_score', v_phoenix_score, 'phoenix_signals', v_phoenix_signals,
    'phoenix_total_weight', v_phoenix_total_weight,
    'phoenix_evaluable', v_phoenix_evaluable,
    'phoenix_officer_link_count', v_officer_link_count,
    'age_score', v_age_score, 'age_days', v_age_days, 'formation_date', v_formation_date,
    'permit_score', v_permit_score, 'permit_finding', v_permit_finding,
    'sanction_hit', v_sanction_hit, 'license_suspended', v_license_suspended,
    'license_revoked', v_license_revoked, 'business_not_found', v_business_not_found,
    'state_has_license_board', v_state_has_license_board,
    'weakest_category_score', CASE WHEN v_weakest = 101 THEN NULL ELSE v_weakest END,
    'dampener_applied', COALESCE(v_dampener, 1.0),
    'hard_caps_applied', v_caps_applied);

  v_row := ROW(
    NULL::BIGINT, v_job.contractor_id, p_job_id, NULL::UUID, 2,
    v_composite, v_grade, v_risk_level,
    v_license_score, v_business_score, v_legal_score, v_osha_score,
    v_bbb_score, v_phoenix_score, v_age_score,
    v_effective_weights, v_sanction_hit, v_license_suspended, v_state_has_license_board,
    v_evidence_count, v_hit_rate, v_inputs, NOW()
  )::contractor_trust_scores;

  RETURN v_row;
END;
$function$
