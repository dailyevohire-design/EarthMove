-- Migration 227: Correct state_ag_enforcement notes field.
-- Mig 226 was applied with the wrong TX AG search URL (/news/search?
-- returns 404) and did not document the destination-page fetch fallback
-- introduced during scraper implementation. Recon during scraper work
-- corrected the TX URL to /news?search_api_fulltext= and added the
-- body-text fallback for cases where WordPress search excerpts truncate
-- before the entity name appears. The live notes field was hand-corrected
-- via a re-run of 226's UPSERT during the same session; this migration
-- captures that correction in version control so the .sql file matches
-- the live state.

UPDATE trust_source_registry
SET notes = 'Two-portal HTML scrape: CO AG WordPress search at coag.gov/?s= and TX AG Drupal search at texasattorneygeneral.gov/news?search_api_fulltext=. Title-keyword classification. Strict word-boundary name match on headline + search-result excerpt; destination-page fetch fallback (cap=5) for cases where the search-result excerpt does not contain the entity name. Zero matches → legal_no_actions.',
    updated_at = now()
WHERE source_key = 'state_ag_enforcement';
