-- 242_groundcheck_data_expansion.sql
-- Adds finding_types for bonds, residential-address patterns, principal-network,
-- complaint disposition. Registers 6 new sources (lien recorders, permit APIs,
-- assessor APIs). Indexes trust_report_audit for trajectory rendering. Adds two
-- RPCs: get_trust_trajectory and get_principal_entity_summary.
-- Idempotent — safe to re-apply.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend trust_evidence.finding_type CHECK with 19 new tokens
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE trust_evidence DROP CONSTRAINT IF EXISTS trust_evidence_finding_type_check;
ALTER TABLE trust_evidence ADD CONSTRAINT trust_evidence_finding_type_check
  CHECK (finding_type = ANY (ARRAY[
    'license_active','license_inactive','license_expired','license_suspended','license_not_found',
    'business_active','business_inactive','business_dissolved','business_not_found',
    'osha_violation','osha_serious_violation','osha_no_violations',
    'legal_action_found','legal_judgment_against','legal_no_actions',
    'bbb_accredited','bbb_rating','bbb_complaint','bbb_not_profiled',
    'review_aggregate','review_item_positive','review_item_negative',
    'phoenix_signal','officer_match','address_reuse','phone_reuse','ein_match',
    'sanction_hit','sanction_clear','news_mention_positive','news_mention_negative',
    'lien_found','lien_clear','raw_source_response','source_error','source_not_applicable',
    'permit_history_clean','permit_history_robust','permit_history_low','permit_history_stale','permit_scope_violation',
    'license_revoked','license_disciplinary_action','license_penalty_assessed','license_no_record','license_revoked_but_operating',
    'insurance_active_gl','insurance_active_wc','insurance_lapsed','insurance_no_record','insurance_below_minimum','insurance_carrier_name',
    'osha_violations_clean','osha_serious_citation','osha_willful_citation','osha_repeat_citation','osha_fatality_finding','osha_inspection_no_violation',
    'bbb_rating_a_plus','bbb_rating_a','bbb_rating_b','bbb_rating_c_or_below','bbb_complaints_high','bbb_no_profile',
    'civil_judgment_against','civil_settlement','civil_no_judgments',
    'mechanic_lien_filed','mechanic_lien_resolved',
    'federal_contractor_active','federal_contractor_past_performance','federal_contractor_no_record',
    'entity_disambiguation_candidates','name_discrepancy_observed','bbb_link_constructed',
    'open_web_adverse_signal','open_web_positive_signal','open_web_verified','open_web_unverified','cross_engine_corroboration_event',
    'usdot_active','usdot_out_of_service','usdot_revoked','usdot_safety_satisfactory','usdot_safety_conditional','usdot_safety_unsatisfactory','usdot_not_found',
    -- NEW (mig 242) ─────────────────────────────────────────────────────
    'bond_active',
    'bond_claimed_against',
    'bond_lapsed',
    'bond_not_required',
    'mechanic_lien_against_contractor',
    'mechanic_lien_by_contractor',
    'address_residential_pattern',
    'address_commercial',
    'address_pobox',
    'address_shared_with_dissolved_entity',
    'principal_serial_dissolutions',
    'principal_cross_entity_count',
    'bbb_complaint_unresolved',
    'bbb_complaint_resolved',
    'civil_disposition_settled',
    'civil_disposition_defaulted',
    'civil_disposition_dismissed',
    'civil_disposition_won_by_plaintiff',
    'permit_volume_inconsistent'
  ]));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Register 6 new sources (idempotent via ON CONFLICT)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO trust_source_registry (
  source_key, display_name, source_category, applicable_state_codes,
  access_method, base_url, auth_type, rate_limit_per_minute, cost_per_call_cents,
  is_active, confidence_weight, notes, metadata, applicable_tiers
) VALUES
  ('austin_open_data',
   'Austin Open Data — Issued Construction Permits',
   'municipal_permits', ARRAY['TX'],
   'rest_api', 'https://data.austintexas.gov/resource/3syk-w9eu.json',
   'none', 60, 0, true, 0.85,
   'Socrata SODA. Filter by applicant_full_name or contractor_company_name. Last 24mo window.',
   jsonb_build_object('soda_endpoint','3syk-w9eu','date_field','issued_date','applicant_field','applicant_full_name'),
   ARRAY['standard','pro','deep']),

  ('phoenix_open_data',
   'Phoenix Open Data — Building Permits',
   'municipal_permits', ARRAY['AZ'],
   'rest_api', 'https://www.phoenixopendata.com/api/3/action/datastore_search',
   'none', 60, 0, true, 0.85,
   'CKAN datastore_search. resource_id rotates yearly — verify in metadata.resource_id at scrape-time.',
   jsonb_build_object('resource_id','TBD_FETCH_FROM_PORTAL','date_field','PermitIssueDate','applicant_field','ContractorBusinessName'),
   ARRAY['standard','pro','deep']),

  ('co_county_recorder_liens',
   'Colorado County Recorder — Mechanic''s Liens (multi-county)',
   'court_state', ARRAY['CO'],
   'html_scrape', 'https://www.denvergov.org/clerkandrecorder',
   'none', 20, 0, true, 0.90,
   'Denver+Adams+Arapahoe+Jefferson+Boulder. Search by debtor (liens AGAINST contractor — sub/supplier nonpayment) and by claimant (liens BY contractor — client collections). Directional persistence is the entire point.',
   jsonb_build_object('counties',ARRAY['denver','adams','arapahoe','jefferson','boulder']),
   ARRAY['pro','deep']),

  ('tx_county_recorder_liens',
   'Texas County Recorder — Mechanic''s Liens (multi-county)',
   'court_state', ARRAY['TX'],
   'html_scrape', 'https://www.dallascounty.org/government/county-clerk/',
   'none', 20, 0, true, 0.90,
   'Dallas+Tarrant+Collin+Harris+Travis. TX Property Code Chap. 53. Same directional logic.',
   jsonb_build_object('counties',ARRAY['dallas','tarrant','collin','harris','travis']),
   ARRAY['pro','deep']),

  ('co_assessor',
   'Colorado County Assessor — Property Classification',
   'state_business_entity', ARRAY['CO'],
   'rest_api', 'https://www.denvergov.org/property',
   'none', 30, 0, true, 0.80,
   'Multi-county assessor. Classifies registered address as residential / commercial / mixed / pobox.',
   jsonb_build_object('endpoints',jsonb_build_object('denver','https://www.denvergov.org/property/realproperty','jefferson','https://gisapps.jeffco.us')),
   ARRAY['standard','pro','deep']),

  ('tx_assessor',
   'Texas County Assessor — Property Classification (DCAD/TAD/HCAD/TCAD)',
   'state_business_entity', ARRAY['TX'],
   'rest_api', 'https://www.dallascad.org',
   'none', 30, 0, true, 0.80,
   'DCAD+TAD+HCAD+TCAD. Same classification logic as co_assessor.',
   jsonb_build_object('endpoints',jsonb_build_object('dallas','https://www.dallascad.org','tarrant','https://www.tad.org','harris','https://hcad.org','travis','https://www.traviscad.org')),
   ARRAY['standard','pro','deep'])
ON CONFLICT (source_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  base_url     = EXCLUDED.base_url,
  notes        = EXCLUDED.notes,
  metadata     = EXCLUDED.metadata,
  is_active    = EXCLUDED.is_active,
  updated_at   = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trajectory indexes on trust_report_audit
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trust_report_audit_contractor_time
  ON trust_report_audit (contractor_name, changed_at DESC)
  WHERE contractor_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trust_report_audit_report_time
  ON trust_report_audit (report_id, changed_at DESC)
  WHERE report_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: trust trajectory (12-month default)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_trust_trajectory(p_contractor_name text, p_state text, p_months int DEFAULT 12)
RETURNS TABLE (
  observed_at   timestamptz,
  trust_score   smallint,
  risk_level    text,
  change_source text,
  delta         smallint
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  WITH rows AS (
    SELECT
      a.changed_at        AS observed_at,
      a.trust_score_after AS trust_score,
      a.risk_level_after  AS risk_level,
      a.change_source,
      a.trust_score_before AS prev_score
    FROM trust_report_audit a
    WHERE a.contractor_name = p_contractor_name
      AND a.changed_at >= now() - make_interval(months => p_months)
      AND EXISTS (
        SELECT 1 FROM trust_reports r
         WHERE r.id = a.report_id AND r.state_code = upper(p_state)
      )
  )
  SELECT
    observed_at,
    trust_score,
    risk_level,
    change_source,
    (COALESCE(trust_score, 0) - COALESCE(prev_score, trust_score))::smallint AS delta
  FROM rows
  ORDER BY observed_at ASC;
$func$;
GRANT EXECUTE ON FUNCTION get_trust_trajectory(text,text,int) TO authenticated, anon, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: principal-network summary (peer-network detection feeder)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_principal_entity_summary(p_officer_name_normalized text)
RETURNS TABLE (
  total_entities         int,
  dissolved_count        int,
  jurisdictions          text[],
  first_seen             timestamptz,
  last_seen              timestamptz,
  related_contractor_ids uuid[]
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    COALESCE(jsonb_array_length(metadata->'entity_links'), 1) AS total_entities,
    COALESCE((metadata->>'dissolved_count')::int, 0)          AS dissolved_count,
    jurisdictions,
    first_seen_at AS first_seen,
    last_seen_at  AS last_seen,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(metadata->'related_contractor_ids'))::uuid[],
      ARRAY[]::uuid[]
    ) AS related_contractor_ids
  FROM trust_officers
  WHERE officer_name_normalized = p_officer_name_normalized
  LIMIT 1;
$func$;
GRANT EXECUTE ON FUNCTION get_principal_entity_summary(text) TO authenticated, anon, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Self-validating asserts (fail the migration if anything's missing)
-- ─────────────────────────────────────────────────────────────────────────────
DO $assert$
DECLARE
  src_count int;
BEGIN
  SELECT count(*) INTO src_count
    FROM trust_source_registry
   WHERE source_key IN (
     'austin_open_data','phoenix_open_data',
     'co_county_recorder_liens','tx_county_recorder_liens',
     'co_assessor','tx_assessor'
   );
  IF src_count <> 6 THEN
    RAISE EXCEPTION 'mig242 assert: expected 6 new sources, got %', src_count;
  END IF;

  BEGIN
    PERFORM 1
      FROM (VALUES
        ('bond_active'),('bond_claimed_against'),('bond_lapsed'),('bond_not_required'),
        ('mechanic_lien_against_contractor'),('mechanic_lien_by_contractor'),
        ('address_residential_pattern'),('address_commercial'),('address_pobox'),
        ('address_shared_with_dissolved_entity'),
        ('principal_serial_dissolutions'),('principal_cross_entity_count'),
        ('bbb_complaint_unresolved'),('bbb_complaint_resolved'),
        ('civil_disposition_settled'),('civil_disposition_defaulted'),
        ('civil_disposition_dismissed'),('civil_disposition_won_by_plaintiff'),
        ('permit_volume_inconsistent')
      ) AS t(ft)
     WHERE NOT (ft = ANY (ARRAY[
       'bond_active','bond_claimed_against','bond_lapsed','bond_not_required',
       'mechanic_lien_against_contractor','mechanic_lien_by_contractor',
       'address_residential_pattern','address_commercial','address_pobox',
       'address_shared_with_dissolved_entity',
       'principal_serial_dissolutions','principal_cross_entity_count',
       'bbb_complaint_unresolved','bbb_complaint_resolved',
       'civil_disposition_settled','civil_disposition_defaulted',
       'civil_disposition_dismissed','civil_disposition_won_by_plaintiff',
       'permit_volume_inconsistent'
     ]));
  END;

  RAISE NOTICE 'mig242 ok: 6 sources, 19 new finding_types, 2 RPCs';
END
$assert$;

COMMIT;
