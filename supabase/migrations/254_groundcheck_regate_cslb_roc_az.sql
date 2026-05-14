-- doc-sync: re-gate cslb_ca + roc_az (audit error in mig 253)
--
-- Applied to prod via Supabase MCP as
-- "groundcheck_regate_cslb_roc_az_v254" on 2026-05-13.
--
-- Background: mig 252 unlocked 16 sources on assumption that scrapers existed.
-- Mig 253 re-gated 14 of those after a classification script flagged them as
-- stubs. But the classifier missed cslb_ca and roc_az because the throwing
-- 'case' in the dispatch switch is 12 lines below those source_keys — outside
-- the grep -B2 -A8 window. This re-gates them to match reality.
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
WHERE source_key IN ('cslb_ca','roc_az')
  AND applicable_tiers <> ARRAY[]::text[];

DO $post$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM trust_source_registry
    WHERE source_key IN ('cslb_ca','roc_az')
      AND (applicable_tiers = '{}' OR applicable_tiers IS NULL);
  IF n <> 2 THEN
    RAISE EXCEPTION 'postcondition: expected 2 gated, got %', n;
  END IF;
END $post$;

COMMIT;
