-- doc-sync: re-gate ccb_or + denver_cpd (pre-existing prod bug)
--
-- Applied to prod via Supabase MCP as
-- "groundcheck_regate_ccb_or_denver_cpd_v255" on 2026-05-13.
--
-- Background: ccb_or and denver_cpd are both in the dispatch switch that
-- throws NotImplementedScraperError, but were unlocked at some prior point
-- with [standard,plus,deep_dive,forensic] tiers. Every Denver report and
-- every Oregon report has been calling a broken scraper, getting caught by
-- integrity-v2, and demoted to 59/HIGH + requires_re_review=true. This is
-- a pre-existing bug, not a mig 252 regression. Gate to {} until real
-- scrapers ship — at which point a one-row UPDATE re-flips the gate.
--
-- Re-apply-safe: yes (idempotent).

BEGIN;

DO $pre$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE relname='trust_source_registry') THEN
    RAISE EXCEPTION 'precondition: trust_source_registry table required';
  END IF;
END $pre$;

UPDATE trust_source_registry
SET applicable_tiers = ARRAY[]::text[], updated_at = now()
WHERE source_key IN ('ccb_or','denver_cpd')
  AND applicable_tiers <> ARRAY[]::text[];

DO $post$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM trust_source_registry
    WHERE source_key IN ('ccb_or','denver_cpd')
      AND (applicable_tiers = '{}' OR applicable_tiers IS NULL);
  IF n <> 2 THEN
    RAISE EXCEPTION 'postcondition: expected 2 gated, got %', n;
  END IF;
END $post$;

COMMIT;
