-- 220_osha_dol_api_source_activation
-- Pivots OSHA source from HTML scrape to data.dol.gov JSON API and activates
-- across all 4 tiers. Mirror of MCP-applied state. The 7 existing evidence
-- rows on source_key='osha_est_search' are preserved (no key change).

UPDATE public.trust_source_registry
SET
  display_name = 'OSHA Establishment Inspections (DOL data.dol.gov JSON API, mirrored locally)',
  base_url = 'https://data.dol.gov/get/inspection',
  access_method = 'rest_api',
  auth_type = 'api_key',
  rate_limit_per_minute = 600,
  applicable_tiers = ARRAY['standard','plus','deep_dive','forensic']::text[],
  applicable_state_codes = NULL,
  confidence_weight = 0.92,
  is_active = true,
  query_template = 'GET https://data.dol.gov/get/inspection?api_key=$DOL_API_KEY&limit=10000&offset=$OFFSET&filter_object={"field":"naics_code","operator":"like","value":"23%"}&sort_by=case_mod_date&sort=desc',
  notes = 'Pulled from DOL data.dol.gov JSON API (free key from dataportal.dol.gov/registration). Filter NAICS 23% (construction). Mirrored locally into osha_establishments / osha_inspections / osha_violations. Score-time lookup via osha_lookup_findings() — no external HTTP at score time. 5yr lookback enforced in lookup function.',
  metadata = jsonb_build_object(
    'ingestion_strategy', 'mirror',
    'incremental_field', 'case_mod_date',
    'api_key_env', 'DOL_API_KEY',
    'naics_filter', '23%',
    'lookback_years', 5,
    'pivoted_from_html_scrape_at', '2026-05-06T00:00:00Z'
  ),
  updated_at = now()
WHERE source_key = 'osha_est_search';

DO $$
DECLARE v_tier_count int;
BEGIN
  SELECT array_length(applicable_tiers, 1) INTO v_tier_count
  FROM public.trust_source_registry WHERE source_key = 'osha_est_search';
  IF v_tier_count IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'OSHA source tier activation failed: expected 4 tiers, got %', v_tier_count;
  END IF;
END $$;
