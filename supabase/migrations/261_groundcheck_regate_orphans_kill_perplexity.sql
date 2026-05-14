-- doc-sync: re-gate 4 orphan source_keys + kill perplexity_sweep
--
-- Applied to prod via Supabase MCP as
-- "groundcheck_regate_4_orphan_sources_kill_perplexity_v261" on 2026-05-14.
--
-- The 4 orphans (co_county_recorder_liens, co_assessor,
-- tx_county_recorder_liens, tx_assessor) were LIVE in registry but threw
-- "Unknown source_key" on every CO/TX report — same root-cause class as the
-- ccb_or/denver_cpd issue: registered in trust_source_registry but missing
-- from the dispatch switch in registry.ts. Re-gate to {} until real scrapers
-- ship; one-row UPDATE re-flips per source.
--
-- system_internal NOT included — its address_reuse path is real and useful;
-- only the source_error sub-path is buggy, separate followup.
--
-- perplexity_sweep is dead — superseded by inline synthesis web_search.
-- Explicit double-down to is_active=false + tiers=[] for audit log clarity.
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
SET applicable_tiers = ARRAY[]::text[], updated_at = now()
WHERE source_key IN (
  'co_county_recorder_liens','co_assessor',
  'tx_county_recorder_liens','tx_assessor'
)
AND applicable_tiers <> ARRAY[]::text[];

UPDATE trust_source_registry
SET applicable_tiers = ARRAY[]::text[], is_active = false, updated_at = now()
WHERE source_key = 'perplexity_sweep';

DO $post$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM trust_source_registry
    WHERE source_key IN (
      'co_county_recorder_liens','co_assessor',
      'tx_county_recorder_liens','tx_assessor'
    )
    AND (applicable_tiers = '{}' OR applicable_tiers IS NULL);
  IF n <> 4 THEN RAISE EXCEPTION 'postcondition: expected 4 gated, got %', n; END IF;
END $post$;

COMMIT;
