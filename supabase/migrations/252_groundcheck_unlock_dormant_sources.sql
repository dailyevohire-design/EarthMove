-- doc-sync: unlock 16 dormant trust sources to all tiers
--
-- Applied to prod via Supabase MCP as migration
-- "groundcheck_unlock_dormant_sources_v252" on 2026-05-13.
-- This file restores symmetric-rule compliance (prod ↔ repo).
--
-- Flips applicable_tiers from {} to {free,standard,plus,deep_dive,forensic}
-- for 16 sources that had built scrapers + is_active=true but were gated out
-- of every tier. Worst-case failures are caught by trust_reports_integrity_v2
-- (PR #40) which demotes garbage scores to 59/HIGH + requires_re_review=true.
--
-- Intentionally NOT flipped (prior decisions preserved):
--   bbb_profile      — deactivated 2026-05-06 via mig 225 (legal_risk)
--   llm_web_search   — overlaps synthesis inline web_search; flip after diff
--   opencorporates   — paid API, not subscribed
--   perplexity_sweep — superseded by inline synthesis web_search
--   mock_source      — test fixture
--
-- Re-apply-safe: yes (UPDATE is fully idempotent).

BEGIN;

DO $pre$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE relname='trust_source_registry') THEN
    RAISE EXCEPTION 'precondition: trust_source_registry table required';
  END IF;
END $pre$;

UPDATE trust_source_registry
SET
  applicable_tiers = ARRAY['free','standard','plus','deep_dive','forensic']::text[],
  updated_at = now()
WHERE source_key IN (
  'cslb_ca','dbpr_fl','lni_wa','nclbgc_nc','roc_az',
  'az_ecorp','ca_sos_biz','fl_sunbiz','ga_sos_biz',
  'nc_sos_biz','ny_sos_biz','or_sos_biz','wa_sos_biz',
  'google_reviews','sec_edgar','usaspending'
)
AND is_active = true
AND (applicable_tiers = '{}' OR applicable_tiers IS NULL OR cardinality(applicable_tiers) < 5);

DO $post$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM trust_source_registry
    WHERE source_key IN (
      'cslb_ca','dbpr_fl','lni_wa','nclbgc_nc','roc_az',
      'az_ecorp','ca_sos_biz','fl_sunbiz','ga_sos_biz',
      'nc_sos_biz','ny_sos_biz','or_sos_biz','wa_sos_biz',
      'google_reviews','sec_edgar','usaspending'
    )
    AND applicable_tiers = ARRAY['free','standard','plus','deep_dive','forensic']::text[];
  IF n <> 16 THEN
    RAISE EXCEPTION 'postcondition failed: expected 16 unlocked, got %', n;
  END IF;
END $post$;

COMMIT;
