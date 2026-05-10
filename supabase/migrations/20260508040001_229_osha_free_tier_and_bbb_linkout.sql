-- 229: enable OSHA establishment search for free tier + register bbb_link_check
-- as a ToS-clean BBB profile linkout source. Already applied via MCP this turn;
-- this file is the symmetric record per the apply-then-commit-symmetric-.sql rule.
-- All three statements are idempotent.

-- 1. OSHA establishment search to free tier
UPDATE public.trust_source_registry
SET applicable_tiers = ARRAY['free','standard','plus','deep_dive','forensic']::text[],
    updated_at = now()
WHERE source_key = 'osha_est_search';

-- 2. BBB link-check source — DOES NOT scrape BBB content. Only constructs a
-- search URL for the user to follow. ToS-compliant alternative to the paused
-- bbb_profile direct scraper (deactivated in migration 225).
INSERT INTO public.trust_source_registry (
  source_key, display_name, source_category,
  access_method, base_url, auth_type,
  rate_limit_per_minute, cost_per_call_cents,
  is_active, confidence_weight,
  applicable_state_codes, applicable_tiers,
  notes, metadata
) VALUES (
  'bbb_link_check',
  'BBB Profile Linkout',
  'bbb',
  'rest_api',
  'https://www.bbb.org/search',
  'none',
  10000, 0,
  true, 0.5,
  NULL,
  ARRAY['free','standard','plus','deep_dive','forensic']::text[],
  'Constructs a deterministic bbb.org search URL for the user to verify directly. NO automated content access — does not fetch, parse, or cache BBB pages. ToS-compliant alternative to bbb_profile (deactivated in 225 over scraping concerns).',
  '{"emits_finding_types": ["bbb_link_constructed"], "url_pattern": "https://www.bbb.org/search?find_text={name}&find_loc={city}%2C+{state}&find_country=USA"}'::jsonb
)
ON CONFLICT (source_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  source_category = EXCLUDED.source_category,
  is_active = true,
  applicable_tiers = EXCLUDED.applicable_tiers,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 3. Add 'bbb_link_constructed' to trust_evidence finding_type CHECK.
ALTER TABLE public.trust_evidence
  DROP CONSTRAINT IF EXISTS trust_evidence_finding_type_check;
ALTER TABLE public.trust_evidence
  ADD CONSTRAINT trust_evidence_finding_type_check
  CHECK (finding_type = ANY (ARRAY[
    'license_active','license_inactive','license_expired','license_suspended',
    'license_not_found','license_revoked','license_disciplinary_action',
    'license_penalty_assessed','license_no_record','license_revoked_but_operating',
    'business_active','business_inactive','business_dissolved','business_not_found',
    'osha_violation','osha_serious_violation','osha_no_violations',
    'osha_violations_clean','osha_serious_citation','osha_willful_citation',
    'osha_repeat_citation','osha_fatality_finding','osha_inspection_no_violation',
    'legal_action_found','legal_judgment_against','legal_no_actions',
    'civil_judgment_against','civil_settlement','civil_no_judgments',
    'mechanic_lien_filed','mechanic_lien_resolved',
    'sanction_hit','sanction_clear',
    'federal_contractor_active','federal_contractor_past_performance',
    'federal_contractor_no_record',
    'insurance_active_gl','insurance_active_wc','insurance_lapsed',
    'insurance_no_record','insurance_below_minimum','insurance_carrier_name',
    'bbb_accredited','bbb_rating','bbb_complaint','bbb_not_profiled',
    'bbb_rating_a_plus','bbb_rating_a','bbb_rating_b','bbb_rating_c_or_below',
    'bbb_complaints_high','bbb_no_profile',
    'review_aggregate','review_item_positive','review_item_negative',
    'phoenix_signal','officer_match','address_reuse','phone_reuse','ein_match',
    'news_mention_positive','news_mention_negative',
    'lien_found','lien_clear',
    'permit_history_robust','permit_history_clean','permit_history_low',
    'permit_history_stale','permit_scope_violation',
    'raw_source_response','source_error','source_not_applicable',
    'entity_disambiguation_candidates','name_discrepancy_observed',
    'bbb_link_constructed'
  ]));
