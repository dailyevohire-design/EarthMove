-- 243_groundcheck_tier_nomenclature_fix.sql
-- Corrects mig 242's applicable_tiers values from the deprecated
-- {standard,pro,deep} naming to the canonical {standard,plus,deep_dive,forensic}
-- used by fmcsa_safer and all other post-PR-#45 registrations.
-- Idempotent — safe to re-apply.

BEGIN;

-- Permits + assessors: full paid-tier availability (matches fmcsa_safer pattern)
UPDATE trust_source_registry
SET applicable_tiers = ARRAY['standard','plus','deep_dive','forensic'],
    updated_at = now()
WHERE source_key IN ('austin_open_data','phoenix_open_data','co_assessor','tx_assessor');

-- Lien recorders: heavier scrapes, exclude standard tier
UPDATE trust_source_registry
SET applicable_tiers = ARRAY['plus','deep_dive','forensic'],
    updated_at = now()
WHERE source_key IN ('co_county_recorder_liens','tx_county_recorder_liens');

-- Self-validating assert: no row in the 6 mig-242 sources should retain pro/deep
DO $assert$
DECLARE
  bad_rows int;
BEGIN
  SELECT count(*) INTO bad_rows
    FROM trust_source_registry
   WHERE source_key IN ('austin_open_data','phoenix_open_data','co_assessor','tx_assessor',
                        'co_county_recorder_liens','tx_county_recorder_liens')
     AND (applicable_tiers && ARRAY['pro','deep']);
  IF bad_rows > 0 THEN
    RAISE EXCEPTION 'mig243 assert: % rows still reference deprecated tiers', bad_rows;
  END IF;
  RAISE NOTICE 'mig243 ok: tier nomenclature normalized across 6 sources';
END
$assert$;

COMMIT;
