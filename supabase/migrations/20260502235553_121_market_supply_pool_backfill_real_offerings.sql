-- ============================================================================
-- 121_market_supply_pool_backfill_real_offerings
-- Applied to prod via MCP at 2026-05-02 23:55:53 UTC.
--
-- Discovery: market_supply_pool is the third gate after market_materials.
-- resolveOffering walks: market_materials → market_supply_pool → supplier_offerings.
-- POOL_EXHAUSTED fires when no active pool entry has a public+available offering.
--
-- Two bugs:
--   1. 0 of 23 real-supplier offerings (mig 116) had pool entries.
--   2. 307 active pool entries pointed at offerings now is_public=false (post mig 119/120).
--
-- Fix:
--   A. Deactivate 307 broken pool refs (is_active=false). Reversible.
--   B. Insert 23 fresh pool entries for real offerings, is_preferred=true, score=85
--      to outrank any default-75 entries.
-- ============================================================================

UPDATE market_supply_pool msp
SET is_active = false,
    admin_notes = COALESCE(msp.admin_notes || E'\n', '') ||
      '[2026-05-02] Auto-deactivated by mig 121 — offering became non-public after data cleanup.',
    updated_at = now()
FROM supplier_offerings o
WHERE msp.offering_id = o.id
  AND msp.is_active = true
  AND (o.is_public = false OR o.is_available = false);

INSERT INTO market_supply_pool (
  market_material_id, offering_id, is_active, is_preferred, is_fallback,
  composite_score, price_score, distance_score, reliability_score, availability_score,
  weight_price, weight_distance, weight_reliability, weight_availability,
  scores_calculated_at, admin_notes, created_at, updated_at
)
SELECT
  mm.id, o.id, true, true, false,
  85, 85, 85, 85, 85,
  0.35, 0.25, 0.25, 0.15,
  now(),
  '[2026-05-02] Backfill for real-supplier seed (mig 116). Verified prices, real coords.',
  now(), now()
FROM supplier_offerings o
JOIN supply_yards sy ON sy.id = o.supply_yard_id
JOIN market_materials mm
  ON mm.market_id = sy.market_id
 AND mm.material_catalog_id = o.material_catalog_id
WHERE o.id::text LIKE '33333333-%'
  AND o.is_public = true
  AND o.is_available = true
ON CONFLICT (market_material_id, offering_id) DO UPDATE SET
  is_active = true,
  is_preferred = true,
  composite_score = GREATEST(market_supply_pool.composite_score, EXCLUDED.composite_score),
  scores_calculated_at = now(),
  admin_notes = EXCLUDED.admin_notes,
  updated_at = now();
