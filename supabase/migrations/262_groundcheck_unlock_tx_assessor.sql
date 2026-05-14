-- doc-sync: unlock tx_assessor to all 5 tiers
--
-- Applied to prod via Supabase MCP as
-- "groundcheck_unlock_tx_assessor_all_tiers_v262" on 2026-05-14
-- after DCAD WebForms v2 canary (f9d795d) returned valid evidence
-- across both positive and negative paths:
--   "City of Dallas"  -> business_active, 10 parcels owned by "CITY OF DALLAS"
--   "The Beck Group"  -> business_not_found (legitimate not-found case)
--
-- Re-apply-safe: yes (idempotent UPDATE).

BEGIN;

DO $pre$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE relname='trust_source_registry') THEN
    RAISE EXCEPTION 'precondition: trust_source_registry table required';
  END IF;
END $pre$;

UPDATE trust_source_registry
SET applicable_tiers = ARRAY['free','standard','plus','deep_dive','forensic']::text[],
    updated_at = now()
WHERE source_key = 'tx_assessor'
  AND is_active = true;

DO $post$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM trust_source_registry
    WHERE source_key = 'tx_assessor'
      AND applicable_tiers = ARRAY['free','standard','plus','deep_dive','forensic']::text[];
  IF n <> 1 THEN RAISE EXCEPTION 'postcondition: expected 1, got %', n; END IF;
END $post$;

COMMIT;
