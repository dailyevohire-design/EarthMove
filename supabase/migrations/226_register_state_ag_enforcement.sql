-- 226_register_state_ag_enforcement
--
-- Will be applied via Supabase MCP AFTER this commit pushes (per the
-- terminal-commits-then-MCP-applies workflow for this PR). This is the
-- ONLY file in the repo this session that ships committed-but-unapplied
-- — every other migration was MCP-applied first, then committed.
--
-- Registers state_ag_enforcement source: HTML-scrape of CO + TX AG
-- consumer-protection press-release archives.
--   CO: coag.gov WordPress search
--   TX: texasattorneygeneral.gov Drupal search
-- Title-keyword classification → legal_action_found / legal_judgment_against.
-- Strict word-boundary name match prevents "Acme matched ABC Smith Plumbing"
-- false positives. NOS allowlist NOT applicable (these are press releases,
-- not federal docket entries).

INSERT INTO trust_source_registry (
  source_key, display_name, source_category, applicable_state_codes, access_method,
  base_url, query_template, auth_type, rate_limit_per_minute, cost_per_call_cents,
  is_active, confidence_weight, applicable_tiers, notes
) VALUES (
  'state_ag_enforcement',
  'State AG Consumer Protection Enforcement (CO + TX)',
  'court_state',
  ARRAY['CO', 'TX'],
  'html_scrape',
  'https://coag.gov/press-releases/',
  '/?s={contractor_name}',
  'none',
  20,
  0,
  true,
  0.88,
  ARRAY['standard', 'plus', 'deep_dive', 'forensic'],
  'Two-portal HTML scrape: CO AG WordPress search at coag.gov/?s= and TX AG Drupal search at texasattorneygeneral.gov/news/search?search_api_fulltext=. Title-keyword classification. Strict word-boundary name match. Zero matches → legal_no_actions.'
)
ON CONFLICT (source_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    source_category = EXCLUDED.source_category,
    applicable_state_codes = EXCLUDED.applicable_state_codes,
    base_url = EXCLUDED.base_url,
    query_template = EXCLUDED.query_template,
    rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
    confidence_weight = EXCLUDED.confidence_weight,
    applicable_tiers = EXCLUDED.applicable_tiers,
    notes = EXCLUDED.notes,
    is_active = true,
    updated_at = now();
