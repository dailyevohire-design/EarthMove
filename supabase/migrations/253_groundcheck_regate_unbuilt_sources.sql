-- 253_groundcheck_regate_unbuilt_sources.sql
--
-- Reverses 14 of the 16 tier-unlocks mig 252 performed. Mig 252 flipped
-- applicable_tiers to the full 5-tier array for 16 source_keys, but a
-- post-audit of src/lib/trust/scrapers/ found:
--
--   REAL (2)    cslb_ca, roc_az
--     Built scrapers, kept unlocked.
--
--   STUB (7)    dbpr_fl, lni_wa, nclbgc_nc, fl_sunbiz,
--               google_reviews, sec_edgar, usaspending
--     No scraper file in src/lib/trust/scrapers/. The orchestrator
--     dispatches by source_key → registry throws NotImplementedScraperError.
--
--   REFERENCED-DOWNSTREAM-ONLY (7)
--               az_ecorp, ca_sos_biz, ga_sos_biz, nc_sos_biz,
--               ny_sos_biz, or_sos_biz, wa_sos_biz
--     UI knows them (ContractorCheckClient, TrustReportView,
--     build-evidence-derived-report) but no scraper exists. Same end
--     state: NotImplementedScraperError on dispatch.
--
-- Why re-gate: trust_reports_integrity_v2 (PR #40) was correctly catching
-- the missing-evidence pattern by floor-clamping scores to 59/HIGH +
-- requires_re_review=true on every report from a state whose tier
-- promised these sources. Homeowners in AZ/CA/FL/GA/NC/NY/OR/WA were
-- getting the "report not trustworthy" treatment on contractors who
-- should have scored normally given the real sources that DID run
-- (CSLB, ROC AZ, CO SOS, TX SOS, SAM, OSHA, etc.).
--
-- Re-flipping these 14 to applicable_tiers='{}' stops the wasted
-- NotImplementedScraperError dispatch + restores accurate scoring for
-- the entities those real sources do cover. When a scraper ships, a
-- one-row UPDATE re-flips the corresponding source_key.
--
-- Re-apply-safe: yes. The UPDATE is idempotent and skips any row that's
-- already in the target state.

BEGIN;

DO $pre$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE relname='trust_source_registry') THEN
    RAISE EXCEPTION 'precondition: trust_source_registry table required';
  END IF;
END $pre$;

UPDATE trust_source_registry
SET
  applicable_tiers = ARRAY[]::text[],
  updated_at = now()
WHERE source_key IN (
  -- stubs (no scraper file)
  'dbpr_fl','lni_wa','nclbgc_nc','fl_sunbiz',
  'google_reviews','sec_edgar','usaspending',
  -- referenced downstream only (UI + report builder, but no scraper)
  'az_ecorp','ca_sos_biz','ga_sos_biz','nc_sos_biz',
  'ny_sos_biz','or_sos_biz','wa_sos_biz'
)
AND cardinality(applicable_tiers) > 0;

DO $post$
DECLARE
  regated_count int;
  real_kept int;
BEGIN
  -- 14 unbuilt sources should be gated to {}
  SELECT count(*) INTO regated_count
  FROM trust_source_registry
  WHERE source_key IN (
    'dbpr_fl','lni_wa','nclbgc_nc','fl_sunbiz',
    'google_reviews','sec_edgar','usaspending',
    'az_ecorp','ca_sos_biz','ga_sos_biz','nc_sos_biz',
    'ny_sos_biz','or_sos_biz','wa_sos_biz'
  )
  AND cardinality(applicable_tiers) = 0;

  -- 2 real scrapers (cslb_ca + roc_az) must remain unlocked
  SELECT count(*) INTO real_kept
  FROM trust_source_registry
  WHERE source_key IN ('cslb_ca','roc_az')
  AND applicable_tiers = ARRAY['free','standard','plus','deep_dive','forensic']::text[];

  IF regated_count <> 14 THEN
    RAISE EXCEPTION 'mig253 postcondition: expected 14 regated, got %', regated_count;
  END IF;
  IF real_kept <> 2 THEN
    RAISE EXCEPTION 'mig253 postcondition: cslb_ca + roc_az should still be unlocked, found % matching', real_kept;
  END IF;

  RAISE NOTICE 'mig253: % unbuilt sources re-gated, % real scrapers preserved', regated_count, real_kept;
END $post$;

COMMIT;
