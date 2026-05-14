-- doc-sync: unlock sec_edgar + usaspending to all 5 tiers
--
-- Applied to prod via Supabase MCP as
-- "groundcheck_unlock_sec_edgar_usaspending_v260" on 2026-05-14
-- after canary cc6fb980 on Granite Construction returned valid evidence:
--   sec_edgar    -> business_active (2214 filings, CIK 0000861459)
--   usaspending  -> federal_contractor_past_performance ($583M, 25 contracts)
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
WHERE source_key IN ('sec_edgar','usaspending')
  AND is_active = true;

DO $post$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM trust_source_registry
    WHERE source_key IN ('sec_edgar','usaspending')
      AND applicable_tiers = ARRAY['free','standard','plus','deep_dive','forensic']::text[];
  IF n <> 2 THEN RAISE EXCEPTION 'postcondition: expected 2, got %', n; END IF;
END $post$;

COMMIT;
