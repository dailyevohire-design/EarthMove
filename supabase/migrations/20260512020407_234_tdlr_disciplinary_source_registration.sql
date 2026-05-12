-- 234_tdlr_disciplinary_source_registration
--
-- Documents the trust_source_registry row already applied to production
-- via Supabase MCP at PR #33 (commit 44ad0ef → main 3288402) land time.
-- This file exists so prod and repo agree per the 'never apply via MCP
-- without committing the .sql' workflow rule.
--
-- Idempotent via ON CONFLICT DO NOTHING — no-op against current prod
-- (which has the canonical row), inserts the canonical row on fresh-DB init.
-- Deliberately NOT a DO UPDATE: any in-place MCP edits to prod (rate-limit
-- tuning, notes amendments) survive future re-applies of this file.
--
-- Scraper code: src/lib/trust/scrapers/tdlr-disciplinary.ts (PR #33).
-- Weight 0.85 vs tx_tdlr 0.90 reflects ~60-80% Google index coverage of FOs.
-- Free-tier quota: 100 GCSE queries per day. rate_limit_per_minute=6 keeps
-- a burst from draining the daily quota in seconds.
--
-- Refs: mig 211 (tx_tdlr registration, paired active-license source),
--       mig 212 (cimsfo/fosearch.asp unscriptable problem this pivots around),
--       mig 222 (phantom-evidence avoidance workflow rule).

INSERT INTO trust_source_registry (
  source_key, display_name, source_category, applicable_state_codes,
  access_method, base_url, query_template,
  auth_type, rate_limit_per_minute, cost_per_call_cents,
  is_active, confidence_weight, applicable_tiers,
  notes, metadata
) VALUES (
  'tdlr_disciplinary',
  'TX TDLR Disciplinary Actions (via Google Custom Search)',
  'state_license',
  ARRAY['TX'],
  'gcse_index',
  'https://customsearch.googleapis.com/customsearch/v1',
  'site:tdlr.texas.gov "{contractor_name}" (revoked OR suspended OR sanction OR penalty OR "agreed order" OR "final order")',
  'api_key',
  6,
  0.0000,
  true,
  0.85,
  ARRAY['standard','plus','deep_dive','forensic']::text[],
  'Texas TDLR Disciplinary Actions via Google Custom Search of indexed tdlr.texas.gov Final Order detail pages. Pivots around the cimsfo/fosearch.asp unscriptable problem (mig 212). Free-tier 100 queries/day; throws ScraperRateLimitError on 429/403. Index-coverage gap ~60-80% of FOs (justifies weight 0.85 vs tx_tdlr 0.90). Sanction-keyword classification → license_revoked / license_suspended / license_penalty_assessed / license_disciplinary_action. Two-pass match: GCSE snippet first, fall back to allowlisted destination fetch (*.tdlr.texas.gov only, SSRF-safe, 5s timeout, 2MB body cap). Zero indexed hits OR hits without strict-name + keyword match → license_no_record. API key never logged: citation_url uses google.com/search.',
  jsonb_build_object(
    'gcse_indexed_paths', jsonb_build_array('tdlr.texas.gov/cimsfo/', 'tdlr.texas.gov/news/'),
    'ssrf_allowlist', jsonb_build_array('www.tdlr.texas.gov', 'tdlr.texas.gov'),
    'max_items_processed', 5,
    'max_destination_fetches', 3,
    'destination_timeout_ms', 5000,
    'destination_max_bytes', 2097152,
    'snippet_db_cap', 4096,
    'fallback_to_serper', 'TODO at production scale'
  )
)
ON CONFLICT (source_key) DO NOTHING;
