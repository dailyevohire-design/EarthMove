-- 212_tx_tdlr_pivot_to_socrata
--
-- Pivot tx_tdlr from the broken tdlr.texas.gov/cimsfo/fosearch_results.asp
-- POST-form scrape to data.texas.gov dataset 7358-krk7 (TDLR All Licenses)
-- via Socrata SODA. Production smoke on PCL/Bemas/Pinnacle (post-#9 merge)
-- showed the original POST-form scraper false-positive on three unrelated
-- contractor names: server returns 302 with ASP session cookie, follow-up
-- 411s, fetch ends up parsing the search-form homepage's program-list
-- table as ~18 result rows. Root cause: server-side curl + fetch can't
-- complete the session-state replay TDLR's form requires.
--
-- Pivoted scope: this scraper now verifies ACTIVE TDLR licensure (yes/no
-- + license type + expiration). Disciplinary history detection is split
-- into a separate followup (FOLLOWUP-TX-TDLR-FINAL-ORDERS-SESSION-STATE)
-- since 7358-krk7 has no disciplinary fields.

UPDATE trust_source_registry
SET
  display_name = 'Texas TDLR Active Licenses',
  access_method = 'rest_api',
  base_url = 'https://data.texas.gov/resource/7358-krk7.json',
  query_template = '?$where=upper(business_name)%20like%20upper(%27%25{contractor_name}%25%27)%20OR%20upper(owner_name)%20like%20upper(%27%25{contractor_name}%25%27)&$limit=10',
  notes = 'TDLR active licenses via Socrata SODA dataset 7358-krk7. Pivoted in migration 212 from the broken cimsfo/fosearch_results.asp POST scrape (302 + session cookie + 411 chain made it server-side-unscriptable, see FOLLOWUP-TX-TDLR-FINAL-ORDERS-SESSION-STATE). Schema: license_type, license_number, license_subtype, business_name, owner_name, business_county, license_expiration_date_mmddccyy. Disciplinary fields NOT present in this dataset; this scraper verifies presence of active license only.',
  metadata = metadata
    || jsonb_build_object(
      'soda_dataset', '7358-krk7',
      'access_pattern', 'socrata_soda_get',
      'pivoted_at', '2026-05-03',
      'pivoted_from_endpoint', 'https://www.tdlr.texas.gov/cimsfo/fosearch_results.asp',
      'covers_disciplinary_history', false
    ),
  updated_at = NOW()
WHERE source_key = 'tx_tdlr';
