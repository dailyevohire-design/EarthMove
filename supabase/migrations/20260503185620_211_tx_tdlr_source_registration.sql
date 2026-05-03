-- 211_tx_tdlr_source_registration
--
-- Registers source_key='tx_tdlr' for the Texas TDLR Final Orders scraper.
-- Form-POST scrape against tdlr.texas.gov/cimsfo/fosearch_results.asp.
-- Coverage: TDLR-licensed trades (A/C, refrigeration, electricians, etc.).
-- Plumbers are NOT covered by TDLR; TX TSBPE handles plumbers and is
-- deferred (no machine-readable disciplinary endpoint identified —
-- see FOLLOWUP-TSBPE-DISCIPLINARY-NO-ENDPOINT).
--
-- Search window is current + 2 prior fiscal years per TDLR's documented
-- coverage. Older orders are NOT in the search and require a written
-- TDLR Records Center request.

INSERT INTO trust_source_registry (
  source_key, display_name, source_category, applicable_state_codes,
  access_method, base_url, query_template,
  auth_type, rate_limit_per_minute, cost_per_call_cents,
  is_active, confidence_weight, applicable_tiers,
  notes, metadata
) VALUES (
  'tx_tdlr',
  'Texas TDLR Final Orders',
  'state_license',
  ARRAY['TX'],
  'html_scrape',
  'https://www.tdlr.texas.gov/cimsfo/fosearch_results.asp',
  null,
  'none',
  20,
  0.0000,
  true,
  0.90,
  ARRAY['standard','plus','deep_dive','forensic']::text[],
  'TX TDLR Final Orders search — POST form, HTML response. Form fields: pht_oth_name (company/other), pht_lnm (last), pht_fnm (first), pht_lic (license #), phy_zip. Coverage window: current + 2 prior fiscal years. Plumbers NOT covered (use TSBPE). Absence in result is ambiguous — could be clean record OR not-licensed-by-TDLR OR older order outside window. Scraper emits license_no_record on absence with summary noting the ambiguity.',
  jsonb_build_object(
    'jurisdiction', 'texas',
    'agency', 'Texas TDLR',
    'access_pattern', 'post_form_html',
    'form_action', 'fosearch_results.asp',
    'form_fields', jsonb_build_array('pht_oth_name','pht_lnm','pht_fnm','pht_lic','phy_zip'),
    'coverage_window', 'current + 2 prior fiscal years',
    'plumbers_excluded', true,
    'launch_priority', 1
  )
)
ON CONFLICT (source_key) DO UPDATE SET
  applicable_tiers = EXCLUDED.applicable_tiers,
  is_active = EXCLUDED.is_active,
  base_url = EXCLUDED.base_url,
  notes = EXCLUDED.notes,
  metadata = trust_source_registry.metadata || EXCLUDED.metadata,
  updated_at = NOW();
