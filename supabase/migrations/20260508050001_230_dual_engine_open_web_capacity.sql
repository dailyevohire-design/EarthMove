-- 230: dual-engine open-web capacity. Already applied via MCP; symmetric record.
--
-- Three layers:
--   1. perplexity_sweep — sonar/sonar-pro grounded research with citations
--   2. llm_web_search — Anthropic web_search tool used in verify + targeted modes
--   3. cross_engine_corroboration — when both engines cite the same URL/claim
--
-- Idempotent. Existing rows updated; new constraints replace old.

-- 1. Register perplexity_sweep
INSERT INTO public.trust_source_registry (
  source_key, display_name, source_category,
  access_method, base_url, auth_type,
  rate_limit_per_minute, cost_per_call_cents,
  is_active, confidence_weight,
  applicable_state_codes, applicable_tiers,
  notes, metadata
) VALUES (
  'perplexity_sweep',
  'Perplexity Sonar Open Web Sweep',
  'llm_search',
  'rest_api',
  'https://api.perplexity.ai/chat/completions',
  'bearer_token',
  60, 50,
  true, 0.7,
  NULL,
  ARRAY['free','standard','plus','deep_dive','forensic']::text[],
  'Grounded open-web search via Perplexity Sonar. Returns claims + citations. Free tier: sweep only. Paid tiers: sweep + Claude verify fan-out + corroboration.',
  '{"emits_finding_types": ["open_web_adverse_signal","open_web_positive_signal","raw_source_response"], "models": ["sonar","sonar-pro"]}'::jsonb
)
ON CONFLICT (source_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  source_category = EXCLUDED.source_category,
  is_active = true,
  applicable_tiers = EXCLUDED.applicable_tiers,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 2. Activate llm_web_search for paid tiers
UPDATE public.trust_source_registry
SET applicable_tiers = ARRAY['standard','plus','deep_dive','forensic']::text[],
    is_active = true,
    notes = 'Anthropic Claude web_search tool. Verify mode (fan-out from Perplexity hits) + targeted mode (independent queries). Underpins cross-engine corroboration.',
    updated_at = now()
WHERE source_key = 'llm_web_search';

-- 3. Extend trust_evidence finding_type CHECK with the 5 open-web types
--    + cross-engine corroboration event.
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
    'bbb_link_constructed',
    -- 230: dual-engine open-web findings
    'open_web_adverse_signal','open_web_positive_signal',
    'open_web_verified','open_web_unverified',
    'cross_engine_corroboration_event'
  ]));

-- 4. trust_reports columns for open-web aggregates (drives the UI tile +
--    score adjustments + audit trail).
ALTER TABLE public.trust_reports
  ADD COLUMN IF NOT EXISTS open_web_adverse_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_web_positive_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_web_corroboration_depth smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_web_recency_min integer,
  ADD COLUMN IF NOT EXISTS open_web_engines_used text[];

COMMENT ON COLUMN public.trust_reports.open_web_corroboration_depth IS
  'Number of independent engines that surfaced overlapping evidence. 1 = single source. 2+ = independently corroborated. Patent claim 6.';
