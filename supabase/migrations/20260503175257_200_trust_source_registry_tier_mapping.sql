-- 200_trust_source_registry_tier_mapping
--
-- Adds applicable_tiers text[] to trust_source_registry. Migrates the
-- TIER_SOURCES TS const out of code into the DB. The 5 implemented scrapers
-- get standard+ tiers; the mock test fixture gets free; the 21+
-- declared-but-not-yet-built sources get [] (registered for documentation
-- but never dispatched).

ALTER TABLE trust_source_registry
  ADD COLUMN IF NOT EXISTS applicable_tiers text[]
  DEFAULT ARRAY['standard','plus','deep_dive','forensic']::text[];

-- Mock test fixture — free tier only.
UPDATE trust_source_registry SET applicable_tiers = ARRAY['free']::text[]
WHERE source_key = 'mock_source';

-- 5 implemented scrapers — standard+ tiers (matches current TIER_SOURCES).
UPDATE trust_source_registry SET applicable_tiers = ARRAY['standard','plus','deep_dive','forensic']::text[]
WHERE source_key IN (
  'sam_gov_exclusions',
  'co_sos_biz',
  'tx_sos_biz',
  'denver_pim',
  'dallas_open_data'
);

-- All other declared-but-not-yet-implemented sources — empty array.
-- They remain catalogued in trust_source_registry but won't be dispatched
-- by sourcesForTier(). Each scraper migration in Tranche B/C will set its
-- own applicable_tiers when its scraper code lands.
UPDATE trust_source_registry SET applicable_tiers = ARRAY[]::text[]
WHERE source_key NOT IN (
  'mock_source',
  'sam_gov_exclusions',
  'co_sos_biz',
  'tx_sos_biz',
  'denver_pim',
  'dallas_open_data'
);

CREATE INDEX IF NOT EXISTS idx_trust_source_registry_tiers
  ON trust_source_registry USING GIN (applicable_tiers);
