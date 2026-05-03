-- 118_trust_project_evidence_preserve_synthesis.sql
--
-- Surgical fix to trust_project_evidence_to_report(): preserves synthesis-tier
-- red_flags and positive_indicators when synthesis_model IS NOT NULL.
--
-- BEFORE (lines from production function body, captured 2026-05-02):
--   red_flags           = CASE WHEN cardinality(v_red) > 0 THEN v_red ELSE red_flags END,
--   positive_indicators = CASE WHEN cardinality(v_pos) > 0 THEN v_pos ELSE positive_indicators END,
--
-- AFTER:
--   red_flags = CASE WHEN synthesis_model IS NULL AND cardinality(v_red) > 0 THEN v_red ELSE red_flags END,
--   positive_indicators = CASE WHEN synthesis_model IS NULL AND cardinality(v_pos) > 0 THEN v_pos ELSE positive_indicators END,
--
-- Effect: when a synthesizer (templated or LLM) has populated red_flags and
-- positive_indicators, those arrays are preserved. Only the legacy path
-- (synthesis_model IS NULL — pre-v2 reports with no synthesizer ever run)
-- continues to overwrite from evidence finding_summaries.
--
-- This restores the value proposition of paid tiers (Sonnet/Opus): cited,
-- LLM-synthesized red_flags survive the projection pass instead of being
-- replaced with raw evidence summaries.
--
-- All other behavior (biz_status / lic_status / bbb_rating / review_*  / osha_* /
-- legal_status / legal_findings / data_integrity_status / last_projected_at /
-- early-return for empty evidence_ids) is preserved verbatim from the production
-- function body.

CREATE OR REPLACE FUNCTION public.trust_project_evidence_to_report(p_report_id uuid)
RETURNS trust_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_report     trust_reports%ROWTYPE;
  v_biz        trust_evidence%ROWTYPE;
  v_lic        trust_evidence%ROWTYPE;
  v_bbb        trust_evidence%ROWTYPE;
  v_rev        trust_evidence%ROWTYPE;
  v_osha       trust_evidence%ROWTYPE;
  v_legal      trust_evidence%ROWTYPE;
  v_legal_arr  text[] := '{}';
  v_red        text[] := '{}';
  v_pos        text[] := '{}';
BEGIN
  SELECT * INTO v_report FROM trust_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF cardinality(v_report.evidence_ids) = 0 THEN
    UPDATE trust_reports SET
      data_integrity_status = CASE
        WHEN raw_report IS NOT NULL AND raw_report <> '{}'::jsonb THEN 'legacy'
        ELSE 'stale'
      END,
      last_projected_at = now()
    WHERE id = p_report_id
    RETURNING * INTO v_report;
    RETURN v_report;
  END IF;

  SELECT * INTO v_biz FROM trust_evidence
   WHERE id = ANY(v_report.evidence_ids)
     AND finding_type IN ('business_active','business_inactive','business_dissolved','business_not_found')
   ORDER BY trust_confidence_rank(confidence) DESC, pulled_at DESC LIMIT 1;

  SELECT * INTO v_lic FROM trust_evidence
   WHERE id = ANY(v_report.evidence_ids)
     AND finding_type IN ('license_active','license_inactive','license_expired','license_suspended','license_not_found')
   ORDER BY trust_confidence_rank(confidence) DESC, pulled_at DESC LIMIT 1;

  SELECT * INTO v_bbb FROM trust_evidence
   WHERE id = ANY(v_report.evidence_ids)
     AND finding_type IN ('bbb_accredited','bbb_rating','bbb_complaint','bbb_not_profiled')
   ORDER BY trust_confidence_rank(confidence) DESC, pulled_at DESC LIMIT 1;

  SELECT * INTO v_rev FROM trust_evidence
   WHERE id = ANY(v_report.evidence_ids)
     AND finding_type = 'review_aggregate'
   ORDER BY trust_confidence_rank(confidence) DESC, pulled_at DESC LIMIT 1;

  SELECT * INTO v_osha FROM trust_evidence
   WHERE id = ANY(v_report.evidence_ids)
     AND finding_type IN ('osha_no_violations','osha_violation','osha_serious_violation')
   ORDER BY trust_confidence_rank(confidence) DESC, pulled_at DESC LIMIT 1;

  SELECT * INTO v_legal FROM trust_evidence
   WHERE id = ANY(v_report.evidence_ids)
     AND finding_type IN ('legal_no_actions','legal_action_found','legal_judgment_against')
   ORDER BY trust_confidence_rank(confidence) DESC, pulled_at DESC LIMIT 1;

  SELECT coalesce(array_agg(finding_summary ORDER BY pulled_at DESC), '{}')
    INTO v_legal_arr FROM trust_evidence
   WHERE id = ANY(v_report.evidence_ids)
     AND finding_type IN ('legal_action_found','legal_judgment_against','lien_found');

  SELECT coalesce(array_agg(finding_summary ORDER BY pulled_at DESC), '{}')
    INTO v_red FROM trust_evidence
   WHERE id = ANY(v_report.evidence_ids)
     AND finding_type IN (
       'business_dissolved','business_inactive',
       'license_expired','license_suspended','license_inactive',
       'osha_serious_violation','legal_judgment_against','legal_action_found',
       'lien_found','sanction_hit','phoenix_signal',
       'officer_match','address_reuse','phone_reuse','ein_match',
       'bbb_complaint','news_mention_negative'
     );

  SELECT coalesce(array_agg(finding_summary ORDER BY pulled_at DESC), '{}')
    INTO v_pos FROM trust_evidence
   WHERE id = ANY(v_report.evidence_ids)
     AND finding_type IN (
       'business_active','license_active','sanction_clear',
       'osha_no_violations','legal_no_actions','lien_clear',
       'bbb_accredited','news_mention_positive'
     );

  UPDATE trust_reports SET
    biz_status = CASE v_biz.finding_type
      WHEN 'business_active'    THEN 'Active'
      WHEN 'business_inactive'  THEN 'Inactive'
      WHEN 'business_dissolved' THEN 'Dissolved'
      WHEN 'business_not_found' THEN 'Not Found'
      ELSE biz_status
    END,
    biz_entity_type    = coalesce(v_biz.extracted_facts->>'entity_type', biz_entity_type),
    biz_formation_date = coalesce(v_biz.extracted_facts->>'formation_date', biz_formation_date),

    lic_status = CASE v_lic.finding_type
      WHEN 'license_active'    THEN 'Active'
      WHEN 'license_inactive'  THEN 'Inactive'
      WHEN 'license_expired'   THEN 'Expired'
      WHEN 'license_suspended' THEN 'Suspended'
      WHEN 'license_not_found' THEN 'Not Found'
      ELSE lic_status
    END,
    lic_license_number = coalesce(v_lic.extracted_facts->>'license_number', lic_license_number),

    bbb_rating = coalesce(
      v_bbb.extracted_facts->>'rating',
      CASE v_bbb.finding_type WHEN 'bbb_not_profiled' THEN 'Not Profiled' ELSE bbb_rating END
    ),
    bbb_accredited      = coalesce((v_bbb.extracted_facts->>'accredited')::boolean, bbb_accredited),
    bbb_complaint_count = coalesce((v_bbb.extracted_facts->>'complaint_count')::smallint, bbb_complaint_count),

    review_avg_rating = coalesce(
      (v_rev.extracted_facts->>'rating')::numeric,
      (v_rev.extracted_facts->>'avg_rating')::numeric,
      review_avg_rating
    ),
    review_total = coalesce(
      (v_rev.extracted_facts->>'count')::integer,
      (v_rev.extracted_facts->>'total')::integer,
      review_total
    ),

    osha_status = CASE v_osha.finding_type
      WHEN 'osha_no_violations'     THEN 'Clean'
      WHEN 'osha_violation'         THEN 'Violations Found'
      WHEN 'osha_serious_violation' THEN 'Serious Violations'
      ELSE osha_status
    END,
    osha_violation_count = coalesce(
      (v_osha.extracted_facts->>'inspection_count')::smallint,
      (v_osha.extracted_facts->>'violation_count')::smallint,
      osha_violation_count
    ),
    osha_serious_count = coalesce(
      (v_osha.extracted_facts->>'serious_violations')::smallint,
      osha_serious_count
    ),

    legal_status = CASE v_legal.finding_type
      WHEN 'legal_no_actions'       THEN 'Clear'
      WHEN 'legal_action_found'     THEN 'Actions Found'
      WHEN 'legal_judgment_against' THEN 'Judgment Against'
      ELSE legal_status
    END,
    legal_findings      = CASE WHEN cardinality(v_legal_arr) > 0 THEN v_legal_arr ELSE legal_findings END,

    -- ─────────────────────────────────────────────────────────────────────
    -- MIGRATION 118 CHANGE: preserve synthesis-tier red_flags / positives.
    -- Only overwrite when synthesis_model IS NULL (legacy path).
    red_flags = CASE
      WHEN synthesis_model IS NULL AND cardinality(v_red) > 0 THEN v_red
      ELSE red_flags
    END,
    positive_indicators = CASE
      WHEN synthesis_model IS NULL AND cardinality(v_pos) > 0 THEN v_pos
      ELSE positive_indicators
    END,
    -- ─────────────────────────────────────────────────────────────────────

    last_projected_at = now(),

    data_integrity_status = CASE
      WHEN (SELECT count(*) FROM trust_evidence WHERE id = ANY(evidence_ids)) = cardinality(evidence_ids)
        THEN 'ok'
      ELSE 'stale'
    END
  WHERE id = p_report_id
  RETURNING * INTO v_report;

  RETURN v_report;
END;
$function$;

COMMENT ON FUNCTION public.trust_project_evidence_to_report(uuid) IS
  'Projects evidence into trust_reports. Migration 118 (2026-05-02) gated red_flags/positive_indicators overwrite on synthesis_model IS NULL to preserve LLM-cited synthesis output. All other behavior unchanged from prior version.';
