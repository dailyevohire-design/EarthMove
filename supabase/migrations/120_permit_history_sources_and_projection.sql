-- 120_permit_history_sources_and_projection.sql
--
-- Tier 2 #3 — Permit pull history (Denver + Dallas launch).
--
-- Section A: extend three CHECK constraints to admit the new vocabulary
--            (municipal_permits source_category, 5 permit_history_* finding
--            types, unverified confidence). Initial recon (vitest mocks
--            bypass DB constraints) missed these; production refused inserts
--            until they were extended. Idempotent via DROP IF EXISTS + ADD.
--
-- Section B: register two open-data permit sources (denver_pim,
--            dallas_open_data) in trust_source_registry. Idempotent via
--            ON CONFLICT.
--
-- Section C: extend trust_project_evidence_to_report() to surface the new
--            permit_history_* finding_types in red_flags / positive_indicators.
--            Body is byte-faithful to post-migration-118 production with ONLY
--            the v_red / v_pos array_agg WHERE clauses changed. Migration 118
--            synthesis_model gate preserved verbatim.
--
-- Fort Worth deferred — open-data permits dataset (CFW_Open_Data_Development_
-- Permits_View) does not expose a contractor field; Owner_Full_Name is the
-- property owner, not the contractor. Coverage requires Accela scraping
-- (aca-prod.accela.com/CFW), tracked as Tier 2 #3a follow-up.

BEGIN;

-- ============================================================
-- Section A: CHECK constraint extensions
-- ============================================================

ALTER TABLE trust_source_registry
  DROP CONSTRAINT IF EXISTS trust_source_registry_source_category_check;
ALTER TABLE trust_source_registry
  ADD CONSTRAINT trust_source_registry_source_category_check
  CHECK (source_category = ANY (ARRAY[
    'state_license','state_business_entity',
    'court_federal','court_state',
    'regulatory_osha','bbb','review_platform','news','ag_fraud',
    'lien_recorder','sanctions','sos_federal','llm_search',
    'municipal_permits'
  ]::text[]));

ALTER TABLE trust_evidence
  DROP CONSTRAINT IF EXISTS trust_evidence_finding_type_check;
ALTER TABLE trust_evidence
  ADD CONSTRAINT trust_evidence_finding_type_check
  CHECK (finding_type = ANY (ARRAY[
    'license_active','license_inactive','license_expired','license_suspended','license_not_found',
    'business_active','business_inactive','business_dissolved','business_not_found',
    'osha_violation','osha_serious_violation','osha_no_violations',
    'legal_action_found','legal_judgment_against','legal_no_actions',
    'bbb_accredited','bbb_rating','bbb_complaint','bbb_not_profiled',
    'review_aggregate','review_item_positive','review_item_negative',
    'phoenix_signal','officer_match','address_reuse','phone_reuse','ein_match',
    'sanction_hit','sanction_clear',
    'news_mention_positive','news_mention_negative',
    'lien_found','lien_clear',
    'raw_source_response','source_error','source_not_applicable',
    'permit_history_clean','permit_history_robust','permit_history_low','permit_history_stale','permit_scope_violation'
  ]::text[]));

ALTER TABLE trust_evidence
  DROP CONSTRAINT IF EXISTS trust_evidence_confidence_check;
ALTER TABLE trust_evidence
  ADD CONSTRAINT trust_evidence_confidence_check
  CHECK (confidence = ANY (ARRAY[
    'verified_structured','high_llm','medium_llm','low_inference','contradicted','unverified'
  ]::text[]));

-- ============================================================
-- Section B: source registry
-- ============================================================

INSERT INTO trust_source_registry (
  source_key, display_name, source_category, applicable_state_codes,
  access_method, base_url, auth_type, rate_limit_per_minute,
  cost_per_call_cents, is_active, confidence_weight, notes, metadata
) VALUES
  (
    'denver_pim',
    'Denver Permits & Inspections',
    'municipal_permits',
    ARRAY['CO'],
    'rest_api',
    'https://opendata-geospatialdenver.hub.arcgis.com',
    'none', 30, 0, true, 0.7,
    'Denver building permit history. Two ArcGIS FeatureServer layers (residential + commercial) with identical schemas — CONTRACTOR_NAME, DATE_ISSUED (epoch ms), PERMIT_NUM, CLASS. Street Occupancy (right-of-way) layer intentionally excluded — not building permits.',
    jsonb_build_object(
      'jurisdiction','denver',
      'launch_priority',1,
      'layers', jsonb_build_array(
        jsonb_build_object(
          'name','residential',
          'item_id','014a873bf7444a658fc2ea0da7ad0704',
          'feature_server_url','https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_DEV_RESIDENTIALCONSTPERMIT_P/FeatureServer/316'
        ),
        jsonb_build_object(
          'name','commercial',
          'item_id','4e2cf20443e14710bbb4311126a4362c',
          'feature_server_url','https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_DEV_COMMERCIALCONSTPERMIT_P/FeatureServer/317'
        )
      )
    )
  ),
  (
    'dallas_open_data',
    'Dallas Open Data — Building Permits',
    'municipal_permits',
    ARRAY['TX'],
    'rest_api',
    'https://www.dallasopendata.com/resource/e7gq-4sah.json',
    'none', 60, 0, true, 0.75,
    'Socrata SODA API. Dataset e7gq-4sah. Filter via $where=upper(contractor) like upper(''%NAME%''). Contractor field embeds name + address blob; scraper splits on first 4-digit street number.',
    jsonb_build_object(
      'jurisdiction','dallas',
      'launch_priority',1,
      'soda_dataset','e7gq-4sah',
      'contractor_field_format','name_address_blob',
      'date_format','MM/DD/YY'
    )
  )
ON CONFLICT (source_key) DO UPDATE SET
  display_name              = EXCLUDED.display_name,
  base_url                  = EXCLUDED.base_url,
  applicable_state_codes    = EXCLUDED.applicable_state_codes,
  access_method             = EXCLUDED.access_method,
  is_active                 = EXCLUDED.is_active,
  confidence_weight         = EXCLUDED.confidence_weight,
  notes                     = EXCLUDED.notes,
  metadata                  = EXCLUDED.metadata,
  updated_at                = NOW();

-- ============================================================
-- Section C: trust_project_evidence_to_report extended
-- Body byte-faithful to post-118 production. Only changes:
--   v_red list  ← +permit_history_low, +permit_history_stale, +permit_scope_violation
--   v_pos list  ← +permit_history_robust
-- Migration 118 synthesis_model gate preserved verbatim.
-- ============================================================

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
       'bbb_complaint','news_mention_negative',
       -- Migration 120 additions:
       'permit_history_low','permit_history_stale','permit_scope_violation'
     );

  SELECT coalesce(array_agg(finding_summary ORDER BY pulled_at DESC), '{}')
    INTO v_pos FROM trust_evidence
   WHERE id = ANY(v_report.evidence_ids)
     AND finding_type IN (
       'business_active','license_active','sanction_clear',
       'osha_no_violations','legal_no_actions','lien_clear',
       'bbb_accredited','news_mention_positive',
       -- Migration 120 addition:
       'permit_history_robust'
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

    -- Migration 118 synthesis_model gate preserved.
    red_flags = CASE
      WHEN synthesis_model IS NULL AND cardinality(v_red) > 0 THEN v_red
      ELSE red_flags
    END,
    positive_indicators = CASE
      WHEN synthesis_model IS NULL AND cardinality(v_pos) > 0 THEN v_pos
      ELSE positive_indicators
    END,

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
  'Projects evidence into trust_reports. Migration 118 (2026-05-02) gated red_flags/positive_indicators overwrite on synthesis_model IS NULL. Migration 120 (2026-05-02) added permit_history_robust to v_pos and permit_history_low/stale/scope_violation to v_red.';

COMMIT;
