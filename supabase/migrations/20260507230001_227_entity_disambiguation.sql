-- 227: entity disambiguation surface — extends data_integrity_status enum,
--      adds two evidence finding_types, adds trust_reports.searched_as.
--
-- ALREADY APPLIED via MCP — this file is the symmetric repo record per the
-- "never leave .sql unapplied AND never apply without committing the .sql"
-- rule. Idempotent: drops existing CHECK constraints by name first so a
-- re-apply against an already-evolved schema is a no-op.
--
-- Surfaces three product capabilities:
--   1. data_integrity_status='entity_disambiguation_required' — when exact
--      lookup misses but the entity-registry candidate-search returned
--      similar names. The renderer dispatches to <EntityDisambiguationCard />.
--   2. finding_type='entity_disambiguation_candidates' — single evidence row
--      written by the orchestrator carrying the ranked candidate list in
--      extracted_facts.candidates.
--   3. finding_type='name_discrepancy_observed' — written when the user
--      clicks through a candidate, recording that they originally searched
--      under a different name. Independent fraud signal.
--
-- searched_as column captures the original user query for the
-- name-discrepancy fraud-flag projection in the report builder.

-- trust_reports.data_integrity_status — extend enum to include
-- 'entity_disambiguation_required'.
ALTER TABLE trust_reports
  DROP CONSTRAINT IF EXISTS trust_reports_data_integrity_status_check;
ALTER TABLE trust_reports
  ADD CONSTRAINT trust_reports_data_integrity_status_check
  CHECK (data_integrity_status IN (
    'ok','partial','entity_not_found','degraded','failed',
    'entity_disambiguation_required'
  ));

-- trust_jobs.data_integrity_status — same extension (parity column added in 224).
ALTER TABLE trust_jobs
  DROP CONSTRAINT IF EXISTS trust_jobs_data_integrity_status_check;
ALTER TABLE trust_jobs
  ADD CONSTRAINT trust_jobs_data_integrity_status_check
  CHECK (data_integrity_status IS NULL
      OR data_integrity_status IN (
        'ok','partial','entity_not_found','degraded','failed',
        'entity_disambiguation_required'
      ));

-- trust_evidence.finding_type — extend the union to include the two new
-- disambiguation finding types. Re-issuing the full constraint preserves
-- every existing finding_type that's already valid.
ALTER TABLE trust_evidence
  DROP CONSTRAINT IF EXISTS trust_evidence_finding_type_check;
ALTER TABLE trust_evidence
  ADD CONSTRAINT trust_evidence_finding_type_check
  CHECK (finding_type = ANY (ARRAY[
    -- license-board
    'license_active','license_inactive','license_expired','license_suspended',
    'license_not_found','license_revoked','license_disciplinary_action',
    'license_penalty_assessed','license_no_record','license_revoked_but_operating',
    -- business entity
    'business_active','business_inactive','business_dissolved','business_not_found',
    -- OSHA
    'osha_violation','osha_serious_violation','osha_no_violations',
    'osha_violations_clean','osha_serious_citation','osha_willful_citation',
    'osha_repeat_citation','osha_fatality_finding','osha_inspection_no_violation',
    -- legal / civil
    'legal_action_found','legal_judgment_against','legal_no_actions',
    'civil_judgment_against','civil_settlement','civil_no_judgments',
    'mechanic_lien_filed','mechanic_lien_resolved',
    -- federal sanctions / contractor
    'sanction_hit','sanction_clear',
    'federal_contractor_active','federal_contractor_past_performance',
    'federal_contractor_no_record',
    -- insurance
    'insurance_active_gl','insurance_active_wc','insurance_lapsed',
    'insurance_no_record','insurance_below_minimum','insurance_carrier_name',
    -- BBB
    'bbb_accredited','bbb_rating','bbb_complaint','bbb_not_profiled',
    'bbb_rating_a_plus','bbb_rating_a','bbb_rating_b','bbb_rating_c_or_below',
    'bbb_complaints_high','bbb_no_profile',
    -- reviews / news / officer / aliases
    'review_aggregate','review_item_positive','review_item_negative',
    'phoenix_signal','officer_match','address_reuse','phone_reuse','ein_match',
    'news_mention_positive','news_mention_negative',
    -- liens (legacy duplicate kept for back-compat)
    'lien_found','lien_clear',
    -- permits
    'permit_history_robust','permit_history_clean','permit_history_low',
    'permit_history_stale','permit_scope_violation',
    -- operational
    'raw_source_response','source_error','source_not_applicable',
    -- 227: entity disambiguation
    'entity_disambiguation_candidates','name_discrepancy_observed'
  ]));

-- trust_reports.searched_as — original user query when the canonical legal
-- name differs (populated only when user clicked through entity
-- disambiguation). Powers the name-discrepancy fraud signal.
ALTER TABLE trust_reports
  ADD COLUMN IF NOT EXISTS searched_as text;

COMMENT ON COLUMN trust_reports.searched_as IS
  'Original user query when the canonical legal name differs (populated only when user clicked through entity disambiguation). Powers the name-discrepancy fraud signal.';
