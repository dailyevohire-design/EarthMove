-- 221_dfw_denver_launch_data_seed.sql
-- Documentation migration capturing data state applied via Supabase MCP during
-- the May 5, 2026 DFW + Denver launch sprint. All ops are idempotent — prod
-- already reflects this state; this file exists for audit trail and replay-
-- from-empty parity (dev branches, fresh staging).

BEGIN;

-- (1) Unified delivery policy across all launch-market suppliers.
--     $175 base / 30-mile radius / time-based escalation
--     (delivery_fee_per_mile = 0 triggers the time ladder in pricing-engine.ts).
--     Self-correcting WHERE: only rows diverging from policy get touched.
UPDATE supplier_offerings so
SET
  delivery_fee_base     = 175,
  delivery_fee_per_mile = 0,
  max_delivery_miles    = 30,
  typical_load_size = CASE
    WHEN so.unit = 'ton'         THEN 22
    WHEN so.unit = 'cubic_yard'  THEN 16
    ELSE so.typical_load_size
  END,
  load_size_label = CASE
    WHEN so.unit = 'ton'         THEN 'Tandem dump truck (22 ton)'
    WHEN so.unit = 'cubic_yard'  THEN 'Tandem dump truck (16 cy)'
    ELSE so.load_size_label
  END
FROM supply_yards sy
JOIN markets m ON m.id = sy.market_id
WHERE so.supply_yard_id = sy.id
  AND m.slug IN ('denver','dallas-fort-worth')
  AND so.is_public
  AND so.is_available
  AND (
       so.delivery_fee_base     IS DISTINCT FROM 175
    OR so.delivery_fee_per_mile IS DISTINCT FROM 0
    OR so.max_delivery_miles    IS DISTINCT FROM 30
    OR (so.unit = 'ton'        AND so.typical_load_size IS DISTINCT FROM 22)
    OR (so.unit = 'cubic_yard' AND so.typical_load_size IS DISTINCT FROM 16)
  );

UPDATE supply_yards sy
SET delivery_radius_miles = 30
FROM markets m
WHERE sy.market_id = m.id
  AND m.slug IN ('denver','dallas-fort-worth')
  AND sy.is_active
  AND sy.delivery_radius_miles IS DISTINCT FROM 30;

-- (2) market_materials — one row per (market, catalog) we sell.
--     Detail pages 404 without these.
INSERT INTO market_materials (market_id, material_catalog_id)
SELECT DISTINCT sy.market_id, so.material_catalog_id
FROM supplier_offerings so
JOIN supply_yards sy ON sy.id = so.supply_yard_id
JOIN markets m       ON m.id = sy.market_id
WHERE m.slug IN ('denver','dallas-fort-worth')
  AND so.is_public
  AND so.is_available
ON CONFLICT (market_id, material_catalog_id) DO NOTHING;

-- (3) market_supply_pool — one row per (market_material, offering).
--     resolveOffering returns NO_POOL_ENTRIES without these.
INSERT INTO market_supply_pool (market_material_id, offering_id)
SELECT mm.id, so.id
FROM supplier_offerings so
JOIN supply_yards sy     ON sy.id = so.supply_yard_id
JOIN markets m           ON m.id  = sy.market_id
JOIN market_materials mm ON mm.market_id = sy.market_id
                        AND mm.material_catalog_id = so.material_catalog_id
WHERE m.slug IN ('denver','dallas-fort-worth')
  AND so.is_public
  AND so.is_available
ON CONFLICT (market_material_id, offering_id) DO NOTHING;

COMMIT;
