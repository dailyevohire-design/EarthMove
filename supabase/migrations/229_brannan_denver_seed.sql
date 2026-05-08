-- Brannan Sand and Gravel Co. — 2026 contractor pricing seed (Denver)
-- Path A public load, agreement confirmed with Rachel Hendrickson.
-- Markup × 1.20 applied. price_per_cuyd derived from density.
-- Time-based delivery: $175 base / mi=0 / radius 30mi (Pit 26 = 40mi).
--
-- All 4 producing yards already existed pre-migration (created in earlier seed):
--   Pit 11 = 22222222-2222-4222-a222-222222222212 (Ft. Lupton Recycling)
--   Pit 14 = 22222222-2222-4222-a222-222222222211 (Central Yard, Commerce City)
--   Pit 21 = 22222222-2222-4222-a222-222222222210 (Young Ranch Quarry, Central City)
--   Pit 26 = 22222222-2222-4222-a222-222222222208 (Nix Platteville)
-- Pit 23 Fairplay (22222222-2222-4222-a222-222222222209) left active with 0 offerings.
--
-- Skipped from supplier price sheet: Pit 23 mountain corridor; dump fees;
-- 4 non-aggregate SKUs (Concrete Mix, Filter Material, Cold Mix, RAP/RAS).
--
-- Catalog mapping reuses existing Denver entries to avoid taxonomy duplication:
--   #57 / #57+#67 → existing 57-stone
--   Class 6 Quarried Roadbase → existing class-6
--   Mason Sand → existing masonry-sand
--   X-Y" Cobble → existing cobblestone
--   1.5" Recycled Concrete Rock → existing recycled-concrete
-- 7 new catalog entries added: washed-rock, crushed-rock, vtc, squeegee,
-- crusher-fines, fine-sand, chip-aggregate.

BEGIN;

-- ============================================================
-- 1. Material catalog — 7 new aggregate types
-- ============================================================
INSERT INTO material_catalog (slug, name, density_tons_per_cuyd, category_id) VALUES
  ('washed-rock',    'Washed Rock',           1.5, '8f6540b0-8a77-45a2-bb25-35df11d29a8f'),  -- Gravel
  ('crushed-rock',   'Crushed Rock',          1.5, '8f6540b0-8a77-45a2-bb25-35df11d29a8f'),  -- Gravel
  ('vtc',            'VTC (Verified Type C)', 1.5, '8f6540b0-8a77-45a2-bb25-35df11d29a8f'),  -- Gravel
  ('squeegee',       'Squeegee',              1.4, '8f6540b0-8a77-45a2-bb25-35df11d29a8f'),  -- Gravel
  ('crusher-fines',  'Crusher Fines',         1.5, 'f0e59a45-37a0-4098-be99-d930d6010948'),  -- Base
  ('fine-sand',      'Fine Sand',             1.4, '89df83c9-6d92-4c2d-8987-858e5285f880'),  -- Sand
  ('chip-aggregate', 'Chip Aggregate',        1.4, '8f6540b0-8a77-45a2-bb25-35df11d29a8f')   -- Gravel
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. Pit 26 delivery radius 30 → 40 (per ops sheet)
-- ============================================================
UPDATE supply_yards
SET delivery_radius_miles = 40, updated_at = now()
WHERE id = '22222222-2222-4222-a222-222222222208';

-- ============================================================
-- 3. Align existing Pit 26 C-33 row to draft naming so upsert collides
-- ============================================================
UPDATE supplier_offerings
SET supplier_material_name = 'C-33 Concrete Sand / Aurora Bedding', updated_at = now()
WHERE supply_yard_id = '22222222-2222-4222-a222-222222222208'
  AND material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'concrete-sand')
  AND supplier_material_name = 'C-33 Concrete Sand';

-- ============================================================
-- 4. supplier_offerings — 51 rows (45 inserts + 6 upsert existing)
-- ============================================================
WITH bo(yard_id, material_slug, supplier_name, brannan_ton, max_miles) AS (VALUES
  -- SANDS
  ('22222222-2222-4222-a222-222222222208'::uuid, 'concrete-sand',     'C-33 Concrete Sand / Aurora Bedding', 17.00::numeric, 40::numeric),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'concrete-sand',     'C-33 Concrete Sand / Aurora Bedding', 29.00, 30),
  ('22222222-2222-4222-a222-222222222208'::uuid, 'masonry-sand',      'Mason Sand',                          20.00, 40),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'masonry-sand',      'Mason Sand',                          30.00, 30),
  ('22222222-2222-4222-a222-222222222208'::uuid, 'fine-sand',         'Ultra Fine Sand',                     20.00, 40),
  -- WASHED ROCK / PEA / SQUEEGEE
  ('22222222-2222-4222-a222-222222222208'::uuid, 'washed-rock',       '1.5" Washed Rock',                    38.00, 40),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'washed-rock',       '1.5" Washed Rock',                    42.00, 30),
  ('22222222-2222-4222-a222-222222222208'::uuid, '57-stone',          '#57/67 Washed Rock',                  32.00, 40),
  ('22222222-2222-4222-a222-222222222210'::uuid, 'washed-rock',       '#67 3/4 Washed Rock',                 33.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'washed-rock',       '#67 3/4 Washed Rock',                 45.00, 30),
  ('22222222-2222-4222-a222-222222222208'::uuid, 'pea-gravel',        '#8 Pea Gravel',                       20.00, 40),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'pea-gravel',        '#8 Pea Gravel',                       32.00, 30),
  ('22222222-2222-4222-a222-222222222208'::uuid, 'squeegee',          '#9 Squeegee',                         20.00, 40),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'squeegee',          '#9 Squeegee',                         32.00, 30),
  -- CRUSHED ROCK / BASE / FILL
  ('22222222-2222-4222-a222-222222222211'::uuid, 'vtc',               '3-6" VTC',                            46.00, 30),
  ('22222222-2222-4222-a222-222222222210'::uuid, 'crushed-rock',      '1.5" Crushed Rock / Type II Bedding', 35.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'crushed-rock',      '1.5" Crushed Rock / Type II Bedding', 45.00, 30),
  ('22222222-2222-4222-a222-222222222210'::uuid, '57-stone',          '#57 Crushed Rock',                    33.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, '57-stone',          '#57 Crushed Rock',                    45.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'crushed-rock',      '3/4" Crushed Rock',                   45.00, 30),
  ('22222222-2222-4222-a222-222222222210'::uuid, 'class-6',           'Class 6 Quarried Roadbase',           14.50, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'class-6',           'Class 6 Quarried Roadbase',           20.00, 30),
  ('22222222-2222-4222-a222-222222222210'::uuid, 'crusher-fines',     'Crusher Fines',                       7.50,  30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'crusher-fines',     'Crusher Fines',                       20.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'structural-fill',   'Class 1 Structural Fill',             20.00, 30),
  -- COBBLES / RIP RAP / BOULDERS
  ('22222222-2222-4222-a222-222222222211'::uuid, 'cobblestone',       '1-2" Cobble',                         45.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'cobblestone',       '2-4" Cobble',                         50.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'cobblestone',       '4-8" Cobble',                         55.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'cobblestone',       '8-12" Cobble',                        57.00, 30),
  ('22222222-2222-4222-a222-222222222210'::uuid, 'rip-rap',           'Type L Rip Rap (d/50 9")',            39.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'rip-rap',           'Type L Rip Rap (d/50 9")',            50.00, 30),
  ('22222222-2222-4222-a222-222222222210'::uuid, 'rip-rap',           'Type M Rip Rap (d/50 12")',           40.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'rip-rap',           'Type M Rip Rap (d/50 12")',           50.00, 30),
  ('22222222-2222-4222-a222-222222222210'::uuid, 'boulders',          'Boulders 1-2''',                      135.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'boulders',          'Boulders 1-2''',                      135.00, 30),
  ('22222222-2222-4222-a222-222222222210'::uuid, 'boulders',          'Boulders 2-3''',                      135.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'boulders',          'Boulders 2-3''',                      145.00, 30),
  ('22222222-2222-4222-a222-222222222210'::uuid, 'boulders',          'Boulders 3-4''',                      135.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'boulders',          'Boulders 3-4''',                      145.00, 30),
  ('22222222-2222-4222-a222-222222222210'::uuid, 'boulders',          'Boulders 4-5''',                      145.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'boulders',          'Boulders 4-5''',                      155.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'boulders',          'Boulder 5''+',                        175.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'boulders',          'Boulders Select',                     175.00, 30),
  -- SPECIALTY (clay/overburden mapped to nearest catalog match)
  ('22222222-2222-4222-a222-222222222208'::uuid, 'structural-fill',   'Processed Clay',                      20.00, 40),
  ('22222222-2222-4222-a222-222222222208'::uuid, 'structural-fill',   'Overburden',                          7.00,  40),
  ('22222222-2222-4222-a222-222222222212'::uuid, 'structural-fill',   'Overburden',                          7.00,  30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'chip-aggregate',    '3/8" Chip',                           45.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'chip-aggregate',    '1/4" Chip',                           45.00, 30),
  -- RECYCLED
  ('22222222-2222-4222-a222-222222222211'::uuid, 'recycled-concrete', 'Class 6 Recycled Concrete Roadbase',  18.50, 30),
  ('22222222-2222-4222-a222-222222222212'::uuid, 'recycled-concrete', 'Class 6 Recycled Concrete Roadbase',  17.00, 30),
  ('22222222-2222-4222-a222-222222222211'::uuid, 'recycled-concrete', '1.5" Recycled Concrete Rock',         18.00, 30),
  ('22222222-2222-4222-a222-222222222212'::uuid, 'recycled-concrete', '1.5" Recycled Concrete Rock',         17.00, 30)
)
INSERT INTO supplier_offerings (
  supply_yard_id, material_catalog_id, supplier_material_name,
  unit, price_per_unit, price_per_ton, price_per_cuyd,
  delivery_fee_base, delivery_fee_per_mile, max_delivery_miles,
  typical_load_size, load_size_label,
  is_public, is_available, available_for_delivery, available_for_pickup,
  verification_status, data_source, availability_confidence,
  minimum_order_quantity
)
SELECT
  bo.yard_id,
  m.id,
  bo.supplier_name,
  'ton',
  ROUND(bo.brannan_ton * 1.20, 2),
  ROUND(bo.brannan_ton * 1.20, 2),
  ROUND((bo.brannan_ton * 1.20) / m.density_tons_per_cuyd::numeric, 2),
  175,
  0,
  bo.max_miles,
  22,
  'Tandem dump truck (22 ton)',
  true, true, true, true,
  'verified',
  'manual',
  85,
  1
FROM bo
JOIN material_catalog m ON m.slug = bo.material_slug
ON CONFLICT (supply_yard_id, material_catalog_id, supplier_material_name) DO UPDATE
  SET price_per_unit         = EXCLUDED.price_per_unit,
      price_per_ton          = EXCLUDED.price_per_ton,
      price_per_cuyd         = EXCLUDED.price_per_cuyd,
      delivery_fee_base      = EXCLUDED.delivery_fee_base,
      delivery_fee_per_mile  = EXCLUDED.delivery_fee_per_mile,
      max_delivery_miles     = EXCLUDED.max_delivery_miles,
      typical_load_size      = EXCLUDED.typical_load_size,
      load_size_label        = EXCLUDED.load_size_label,
      is_public              = true,
      is_available           = true,
      available_for_delivery = true,
      available_for_pickup   = true,
      verification_status    = 'verified',
      updated_at             = now();

-- ============================================================
-- 5. Denver market_materials — 10 new catalog ids exposed in market
-- ============================================================
INSERT INTO market_materials (market_id, material_catalog_id)
SELECT '24ea7f05-50ce-4363-9ad1-97a699389a90', mc.id
FROM material_catalog mc
WHERE mc.slug IN (
  'boulders','structural-fill','cobblestone',
  'washed-rock','crushed-rock','vtc','squeegee','crusher-fines','fine-sand','chip-aggregate'
)
ON CONFLICT (market_id, material_catalog_id) DO NOTHING;

-- ============================================================
-- 6. market_supply_pool — 1 row per Brannan public offering
--    (without these, /browse/[slug] detail pages throw NO_POOL_ENTRIES)
-- ============================================================
INSERT INTO market_supply_pool (market_material_id, offering_id)
SELECT mm.id, so.id
FROM supplier_offerings so
JOIN supply_yards sy ON sy.id = so.supply_yard_id
JOIN market_materials mm
  ON mm.material_catalog_id = so.material_catalog_id
 AND mm.market_id = sy.market_id
WHERE sy.supplier_id = '11111111-1111-4111-a111-111111111104'
  AND so.is_public = true
ON CONFLICT (market_material_id, offering_id) DO NOTHING;

COMMIT;

-- ============================================================
-- Verification (post-migration)
-- ============================================================
-- Expect 53 public offerings (51 from this batch + 2 pre-existing legacy rows
-- preserved: Pit 14 #57 Washed Rock $54 and similar). Pool entries should equal
-- offering count. Pit 26 radius = 40. Pit 23 Fairplay untouched (0 offerings).
--
-- SELECT COUNT(*) FROM supplier_offerings so
--   JOIN supply_yards sy ON sy.id = so.supply_yard_id
--  WHERE sy.supplier_id = '11111111-1111-4111-a111-111111111104'
--    AND so.is_public = true;
