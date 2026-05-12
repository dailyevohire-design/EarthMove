-- Migration 241: register FMCSA SAFER + extend trust_evidence vocabulary
--
-- 1. Add USDOT carrier-safety finding types to the trust_evidence
--    finding_type CHECK constraint (mig 201's constraint).
-- 2. Register fmcsa_safer in trust_source_registry.
--
-- Scope note: scoring contribution is NOT wired in this migration —
-- calculate_contractor_trust_score doesn't read usdot_* yet. Evidence
-- rows still record the data for downstream consumers (PDF, share page,
-- audit). Scoring can be extended in a follow-up.

ALTER TABLE trust_evidence DROP CONSTRAINT IF EXISTS trust_evidence_finding_type_check;
ALTER TABLE trust_evidence ADD CONSTRAINT trust_evidence_finding_type_check CHECK (
  finding_type = ANY (ARRAY[
    -- existing values (from mig 201)
    'license_active', 'license_inactive', 'license_expired', 'license_suspended',
    'license_not_found', 'business_active', 'business_inactive', 'business_dissolved',
    'business_not_found', 'osha_violation', 'osha_serious_violation', 'osha_no_violations',
    'legal_action_found', 'legal_judgment_against', 'legal_no_actions', 'bbb_accredited',
    'bbb_rating', 'bbb_complaint', 'bbb_not_profiled', 'review_aggregate',
    'review_item_positive', 'review_item_negative', 'phoenix_signal', 'officer_match',
    'address_reuse', 'phone_reuse', 'ein_match', 'sanction_hit', 'sanction_clear',
    'news_mention_positive', 'news_mention_negative', 'lien_found', 'lien_clear',
    'raw_source_response', 'source_error', 'source_not_applicable',
    'permit_history_clean', 'permit_history_robust', 'permit_history_low',
    'permit_history_stale', 'permit_scope_violation', 'license_revoked',
    'license_disciplinary_action', 'license_penalty_assessed', 'license_no_record',
    'license_revoked_but_operating', 'insurance_active_gl', 'insurance_active_wc',
    'insurance_lapsed', 'insurance_no_record', 'insurance_below_minimum',
    'insurance_carrier_name', 'osha_violations_clean', 'osha_serious_citation',
    'osha_willful_citation', 'osha_repeat_citation', 'osha_fatality_finding',
    'osha_inspection_no_violation', 'bbb_rating_a_plus', 'bbb_rating_a', 'bbb_rating_b',
    'bbb_rating_c_or_below', 'bbb_complaints_high', 'bbb_no_profile',
    'civil_judgment_against', 'civil_settlement', 'civil_no_judgments',
    'mechanic_lien_filed', 'mechanic_lien_resolved', 'federal_contractor_active',
    'federal_contractor_past_performance', 'federal_contractor_no_record',
    'entity_disambiguation_candidates', 'name_discrepancy_observed',
    'bbb_link_constructed', 'open_web_adverse_signal', 'open_web_positive_signal',
    'open_web_verified', 'open_web_unverified', 'cross_engine_corroboration_event',
    -- mig 241 — USDOT carrier safety vocabulary
    'usdot_active', 'usdot_out_of_service', 'usdot_revoked',
    'usdot_safety_satisfactory', 'usdot_safety_conditional', 'usdot_safety_unsatisfactory',
    'usdot_not_found'
  ])
);

-- Extend source_category vocabulary with usdot_carrier_safety for FMCSA SAFER.
ALTER TABLE trust_source_registry DROP CONSTRAINT IF EXISTS trust_source_registry_source_category_check;
ALTER TABLE trust_source_registry ADD CONSTRAINT trust_source_registry_source_category_check CHECK (
  source_category = ANY (ARRAY[
    'state_license', 'state_business_entity', 'court_federal', 'court_state',
    'regulatory_osha', 'bbb', 'review_platform', 'news', 'ag_fraud',
    'lien_recorder', 'sanctions', 'sos_federal', 'llm_search', 'municipal_permits',
    'system',
    -- mig 241
    'usdot_carrier_safety'
  ])
);

INSERT INTO trust_source_registry (
  source_key, display_name, source_category, access_method, base_url,
  auth_type, rate_limit_per_minute, confidence_weight,
  notes, metadata
) VALUES (
  'fmcsa_safer',
  'FMCSA SAFER',
  'usdot_carrier_safety',
  'rest_api',
  'https://mobile.fmcsa.dot.gov/qc/services/carriers',
  'webkey',
  60,
  0.90,
  'FMCSA QCMobile public API for USDOT carriers. Requires FMCSA_WEB_KEY env var (register at https://mobile.fmcsa.dot.gov/QCDevsite/). Scraper degrades to source_not_applicable when the env var is missing so it ships safely before the key lands.',
  jsonb_build_object('api_doc_url', 'https://mobile.fmcsa.dot.gov/QCDevsite/docs/getStarted')
) ON CONFLICT (source_key) DO NOTHING;
