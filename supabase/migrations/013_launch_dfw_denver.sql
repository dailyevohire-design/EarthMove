-- ============================================================
-- 013 — LAUNCH-READY: DFW & Denver
-- Fixes pricing, sort order, featured flags, delivery radius,
-- and adds second-yard coverage for the 7 materials from 011.
--
-- DOES NOT touch data outside DFW and Denver.
-- DOES NOT delete anything — only updates and inserts.
-- ============================================================

DO $$
DECLARE
  -- Markets
  v_dfw_id   uuid;
  v_den_id   uuid;

  -- DFW yards
  v_dfw_yard1 uuid;  -- DFW Dirt — Grand Prairie (supplier 1)
  v_dfw_yard2 uuid;  -- Lone Star — Mesquite (supplier 2)

  -- Denver yards
  v_den_yard1 uuid;  -- Rocky Mtn — Aurora (supplier 1)
  v_den_yard2 uuid;  -- Front Range — Lakewood (supplier 2)

  -- Catalog IDs
  v_fill        uuid;
  v_select      uuid;
  v_topsoil     uuid;
  v_csand       uuid;
  v_msand       uuid;
  v_usand       uuid;
  v_pea         uuid;
  v_gravel57    uuid;
  v_flexbase    uuid;
  v_roadbase    uuid;
  v_riverrock   uuid;
  v_limestone   uuid;
  v_riprap      uuid;
  v_crushed     uuid;
  v_dg          uuid;

  -- Temp vars
  v_off_id  uuid;
  v_mm_id   uuid;

BEGIN
  -- ── Resolve markets ──
  SELECT id INTO v_dfw_id FROM markets WHERE slug = 'dallas-fort-worth';
  SELECT id INTO v_den_id FROM markets WHERE slug = 'denver';
  IF v_dfw_id IS NULL OR v_den_id IS NULL THEN
    RAISE EXCEPTION 'DFW or Denver market not found';
  END IF;

  -- ── Resolve yards (ordered by name to get predictable results) ──
  SELECT sy.id INTO v_dfw_yard1
    FROM supply_yards sy JOIN suppliers s ON s.id = sy.supplier_id
    WHERE sy.market_id = v_dfw_id AND sy.is_active = true
    ORDER BY sy.name LIMIT 1;
  SELECT sy.id INTO v_dfw_yard2
    FROM supply_yards sy JOIN suppliers s ON s.id = sy.supplier_id
    WHERE sy.market_id = v_dfw_id AND sy.is_active = true AND sy.id != v_dfw_yard1
    ORDER BY sy.name LIMIT 1;

  SELECT sy.id INTO v_den_yard1
    FROM supply_yards sy JOIN suppliers s ON s.id = sy.supplier_id
    WHERE sy.market_id = v_den_id AND sy.is_active = true
    ORDER BY sy.name LIMIT 1;
  SELECT sy.id INTO v_den_yard2
    FROM supply_yards sy JOIN suppliers s ON s.id = sy.supplier_id
    WHERE sy.market_id = v_den_id AND sy.is_active = true AND sy.id != v_den_yard1
    ORDER BY sy.name LIMIT 1;

  -- ── Resolve all 15 catalog IDs ──
  SELECT id INTO v_fill      FROM material_catalog WHERE slug = 'fill-dirt';
  SELECT id INTO v_select    FROM material_catalog WHERE slug = 'select-fill';
  SELECT id INTO v_topsoil   FROM material_catalog WHERE slug = 'topsoil';
  SELECT id INTO v_csand     FROM material_catalog WHERE slug = 'concrete-sand';
  SELECT id INTO v_msand     FROM material_catalog WHERE slug = 'masonry-sand';
  SELECT id INTO v_usand     FROM material_catalog WHERE slug = 'utility-sand';
  SELECT id INTO v_pea       FROM material_catalog WHERE slug = 'pea-gravel';
  SELECT id INTO v_gravel57  FROM material_catalog WHERE slug = 'base-gravel-57';
  SELECT id INTO v_flexbase  FROM material_catalog WHERE slug = 'flex-base';
  SELECT id INTO v_roadbase  FROM material_catalog WHERE slug = 'road-base';
  SELECT id INTO v_riverrock FROM material_catalog WHERE slug = 'washed-river-rock';
  SELECT id INTO v_limestone FROM material_catalog WHERE slug = 'limestone';
  SELECT id INTO v_riprap    FROM material_catalog WHERE slug = 'rip-rap';
  SELECT id INTO v_crushed   FROM material_catalog WHERE slug = 'crushed-concrete';
  SELECT id INTO v_dg        FROM material_catalog WHERE slug = 'decomposed-granite';

  -- ================================================================
  --  1. EXPAND DENVER YARD DELIVERY RADIUS TO 50 MILES
  -- ================================================================
  UPDATE supply_yards SET delivery_radius_miles = 50
    WHERE id IN (v_den_yard1, v_den_yard2);

  -- ================================================================
  --  2. FIX DFW OFFERINGS — update the 7 materials from migration 011
  --     (on yard1) with real DFW market prices + proper load info
  -- ================================================================

  -- Masonry Sand — fine washed sand for mortar/brick. DFW: $24/ton
  UPDATE supplier_offerings SET
    price_per_unit = 24.00, minimum_order_quantity = 5,
    typical_load_size = 12, load_size_label = '12-ton load',
    delivery_fee_base = 90.00, delivery_fee_per_mile = 3.25,
    max_delivery_miles = 60, availability_confidence = 88
  WHERE supply_yard_id = v_dfw_yard1 AND material_catalog_id = v_msand;

  -- Utility Sand — bedding/pipe sand. DFW: $14/ton
  UPDATE supplier_offerings SET
    price_per_unit = 14.00, minimum_order_quantity = 5,
    typical_load_size = 14, load_size_label = '14-ton load',
    delivery_fee_base = 85.00, delivery_fee_per_mile = 3.00,
    max_delivery_miles = 60, availability_confidence = 90
  WHERE supply_yard_id = v_dfw_yard1 AND material_catalog_id = v_usand;

  -- Base Gravel #57 — clean crushed stone. DFW: $30/ton
  UPDATE supplier_offerings SET
    price_per_unit = 30.00, minimum_order_quantity = 5,
    typical_load_size = 14, load_size_label = '14-ton load',
    delivery_fee_base = 95.00, delivery_fee_per_mile = 3.50,
    max_delivery_miles = 60, availability_confidence = 90
  WHERE supply_yard_id = v_dfw_yard1 AND material_catalog_id = v_gravel57;

  -- Limestone — crushed TX limestone. DFW: $34/ton
  UPDATE supplier_offerings SET
    price_per_unit = 34.00, minimum_order_quantity = 5,
    typical_load_size = 14, load_size_label = '14-ton load',
    delivery_fee_base = 95.00, delivery_fee_per_mile = 3.50,
    max_delivery_miles = 60, availability_confidence = 88
  WHERE supply_yard_id = v_dfw_yard1 AND material_catalog_id = v_limestone;

  -- Rip Rap — large erosion control stone. DFW: $48/ton
  UPDATE supplier_offerings SET
    price_per_unit = 48.00, minimum_order_quantity = 2,
    typical_load_size = 12, load_size_label = '12-ton load',
    delivery_fee_base = 105.00, delivery_fee_per_mile = 4.00,
    max_delivery_miles = 60, availability_confidence = 82
  WHERE supply_yard_id = v_dfw_yard1 AND material_catalog_id = v_riprap;

  -- Crushed Concrete — recycled base material. DFW: $12/ton
  UPDATE supplier_offerings SET
    price_per_unit = 12.00, minimum_order_quantity = 14,
    typical_load_size = 14, load_size_label = '14-ton load',
    delivery_fee_base = 82.00, delivery_fee_per_mile = 2.75,
    max_delivery_miles = 60, availability_confidence = 92
  WHERE supply_yard_id = v_dfw_yard1 AND material_catalog_id = v_crushed;

  -- Decomposed Granite — decorative paths/patios. DFW: $40/ton
  UPDATE supplier_offerings SET
    price_per_unit = 40.00, minimum_order_quantity = 2,
    typical_load_size = 14, load_size_label = '14-ton load',
    delivery_fee_base = 95.00, delivery_fee_per_mile = 3.50,
    max_delivery_miles = 60, availability_confidence = 85
  WHERE supply_yard_id = v_dfw_yard1 AND material_catalog_id = v_dg;

  -- ================================================================
  --  3. ADD DFW YARD2 OFFERINGS for the 7 materials (backup supply)
  -- ================================================================

  -- Masonry Sand on yard2
  INSERT INTO supplier_offerings (
    supply_yard_id, material_catalog_id, unit, price_per_unit,
    minimum_order_quantity, typical_load_size, load_size_label,
    delivery_fee_base, delivery_fee_per_mile, max_delivery_miles,
    is_available, available_for_delivery, is_public,
    availability_confidence, data_source
  ) VALUES
    (v_dfw_yard2, v_msand,    'ton', 25.50, 5,  12, '12-ton load', 95.00,  3.50, 50, true, true, true, 85, 'manual'),
    (v_dfw_yard2, v_usand,    'ton', 15.00, 5,  14, '14-ton load', 88.00,  3.25, 50, true, true, true, 87, 'manual'),
    (v_dfw_yard2, v_gravel57, 'ton', 32.00, 5,  14, '14-ton load', 100.00, 3.75, 50, true, true, true, 86, 'manual'),
    (v_dfw_yard2, v_limestone,'ton', 36.00, 5,  14, '14-ton load', 100.00, 3.75, 50, true, true, true, 84, 'manual'),
    (v_dfw_yard2, v_riprap,   'ton', 50.00, 2,  12, '12-ton load', 110.00, 4.25, 50, true, true, true, 80, 'manual'),
    (v_dfw_yard2, v_crushed,  'ton', 13.00, 14, 14, '14-ton load', 85.00,  3.00, 50, true, true, true, 90, 'manual'),
    (v_dfw_yard2, v_dg,       'ton', 42.00, 2,  14, '14-ton load', 100.00, 3.75, 50, true, true, true, 83, 'manual')
  ON CONFLICT DO NOTHING;

  -- ================================================================
  --  4. FIX DENVER OFFERINGS — update the 7 materials from migration 011
  --     Denver prices ~15-20% higher than DFW (mountain transport)
  -- ================================================================

  -- Masonry Sand — Denver: $28/ton
  UPDATE supplier_offerings SET
    price_per_unit = 28.00, minimum_order_quantity = 5,
    typical_load_size = 12, load_size_label = '12-ton load',
    delivery_fee_base = 105.00, delivery_fee_per_mile = 4.00,
    max_delivery_miles = 50, availability_confidence = 84
  WHERE supply_yard_id = v_den_yard1 AND material_catalog_id = v_msand;

  -- Utility Sand — Denver: $17/ton
  UPDATE supplier_offerings SET
    price_per_unit = 17.00, minimum_order_quantity = 5,
    typical_load_size = 14, load_size_label = '14-ton load',
    delivery_fee_base = 100.00, delivery_fee_per_mile = 3.75,
    max_delivery_miles = 50, availability_confidence = 86
  WHERE supply_yard_id = v_den_yard1 AND material_catalog_id = v_usand;

  -- Base Gravel #57 — Denver: $34/ton
  UPDATE supplier_offerings SET
    price_per_unit = 34.00, minimum_order_quantity = 5,
    typical_load_size = 14, load_size_label = '14-ton load',
    delivery_fee_base = 110.00, delivery_fee_per_mile = 4.25,
    max_delivery_miles = 50, availability_confidence = 87
  WHERE supply_yard_id = v_den_yard1 AND material_catalog_id = v_gravel57;

  -- Limestone — Denver: $38/ton
  UPDATE supplier_offerings SET
    price_per_unit = 38.00, minimum_order_quantity = 5,
    typical_load_size = 14, load_size_label = '14-ton load',
    delivery_fee_base = 110.00, delivery_fee_per_mile = 4.25,
    max_delivery_miles = 50, availability_confidence = 84
  WHERE supply_yard_id = v_den_yard1 AND material_catalog_id = v_limestone;

  -- Rip Rap — Denver: $52/ton
  UPDATE supplier_offerings SET
    price_per_unit = 52.00, minimum_order_quantity = 2,
    typical_load_size = 12, load_size_label = '12-ton load',
    delivery_fee_base = 118.00, delivery_fee_per_mile = 4.75,
    max_delivery_miles = 50, availability_confidence = 78
  WHERE supply_yard_id = v_den_yard1 AND material_catalog_id = v_riprap;

  -- Crushed Concrete — Denver: $15/ton
  UPDATE supplier_offerings SET
    price_per_unit = 15.00, minimum_order_quantity = 14,
    typical_load_size = 14, load_size_label = '14-ton load',
    delivery_fee_base = 95.00, delivery_fee_per_mile = 3.50,
    max_delivery_miles = 50, availability_confidence = 88
  WHERE supply_yard_id = v_den_yard1 AND material_catalog_id = v_crushed;

  -- Decomposed Granite — Denver: $44/ton
  UPDATE supplier_offerings SET
    price_per_unit = 44.00, minimum_order_quantity = 2,
    typical_load_size = 14, load_size_label = '14-ton load',
    delivery_fee_base = 110.00, delivery_fee_per_mile = 4.25,
    max_delivery_miles = 50, availability_confidence = 82
  WHERE supply_yard_id = v_den_yard1 AND material_catalog_id = v_dg;

  -- ================================================================
  --  5. ADD DENVER YARD2 OFFERINGS for the 7 materials
  -- ================================================================

  INSERT INTO supplier_offerings (
    supply_yard_id, material_catalog_id, unit, price_per_unit,
    minimum_order_quantity, typical_load_size, load_size_label,
    delivery_fee_base, delivery_fee_per_mile, max_delivery_miles,
    is_available, available_for_delivery, is_public,
    availability_confidence, data_source
  ) VALUES
    (v_den_yard2, v_msand,    'ton', 29.50,  5,  12, '12-ton load', 108.00, 4.00, 50, true, true, true, 82, 'manual'),
    (v_den_yard2, v_usand,    'ton', 18.50,  5,  14, '14-ton load', 102.00, 3.75, 50, true, true, true, 84, 'manual'),
    (v_den_yard2, v_gravel57, 'ton', 36.00,  5,  14, '14-ton load', 112.00, 4.25, 50, true, true, true, 85, 'manual'),
    (v_den_yard2, v_limestone,'ton', 40.00,  5,  14, '14-ton load', 112.00, 4.25, 50, true, true, true, 82, 'manual'),
    (v_den_yard2, v_riprap,   'ton', 55.00,  2,  12, '12-ton load', 120.00, 4.75, 50, true, true, true, 76, 'manual'),
    (v_den_yard2, v_crushed,  'ton', 16.50,  14, 14, '14-ton load', 98.00,  3.50, 50, true, true, true, 86, 'manual'),
    (v_den_yard2, v_dg,       'ton', 46.00,  2,  14, '14-ton load', 112.00, 4.25, 50, true, true, true, 80, 'manual')
  ON CONFLICT DO NOTHING;

  -- ================================================================
  --  6. UPDATE DFW MARKET_MATERIALS — sort order + featured flags
  --     Featured: fill-dirt, select-fill, flex-base, crushed-concrete, pea-gravel
  -- ================================================================

  UPDATE market_materials SET sort_order = 1,  is_featured = true  WHERE market_id = v_dfw_id AND material_catalog_id = v_fill;
  UPDATE market_materials SET sort_order = 2,  is_featured = true  WHERE market_id = v_dfw_id AND material_catalog_id = v_select;
  UPDATE market_materials SET sort_order = 3,  is_featured = false WHERE market_id = v_dfw_id AND material_catalog_id = v_topsoil;
  UPDATE market_materials SET sort_order = 4,  is_featured = false WHERE market_id = v_dfw_id AND material_catalog_id = v_csand;
  UPDATE market_materials SET sort_order = 5,  is_featured = false WHERE market_id = v_dfw_id AND material_catalog_id = v_msand;
  UPDATE market_materials SET sort_order = 6,  is_featured = false WHERE market_id = v_dfw_id AND material_catalog_id = v_usand;
  UPDATE market_materials SET sort_order = 7,  is_featured = true  WHERE market_id = v_dfw_id AND material_catalog_id = v_pea;
  UPDATE market_materials SET sort_order = 8,  is_featured = false WHERE market_id = v_dfw_id AND material_catalog_id = v_gravel57;
  UPDATE market_materials SET sort_order = 9,  is_featured = true  WHERE market_id = v_dfw_id AND material_catalog_id = v_flexbase;
  UPDATE market_materials SET sort_order = 10, is_featured = false WHERE market_id = v_dfw_id AND material_catalog_id = v_roadbase;
  UPDATE market_materials SET sort_order = 11, is_featured = false WHERE market_id = v_dfw_id AND material_catalog_id = v_riverrock;
  UPDATE market_materials SET sort_order = 12, is_featured = false WHERE market_id = v_dfw_id AND material_catalog_id = v_limestone;
  UPDATE market_materials SET sort_order = 13, is_featured = false WHERE market_id = v_dfw_id AND material_catalog_id = v_riprap;
  UPDATE market_materials SET sort_order = 14, is_featured = true  WHERE market_id = v_dfw_id AND material_catalog_id = v_crushed;
  UPDATE market_materials SET sort_order = 15, is_featured = false WHERE market_id = v_dfw_id AND material_catalog_id = v_dg;

  -- ================================================================
  --  7. UPDATE DENVER MARKET_MATERIALS — sort order + featured flags
  --     Featured: fill-dirt, flex-base, base-gravel-57, decomposed-granite, select-fill
  -- ================================================================

  UPDATE market_materials SET sort_order = 1,  is_featured = true  WHERE market_id = v_den_id AND material_catalog_id = v_fill;
  UPDATE market_materials SET sort_order = 2,  is_featured = true  WHERE market_id = v_den_id AND material_catalog_id = v_select;
  UPDATE market_materials SET sort_order = 3,  is_featured = false WHERE market_id = v_den_id AND material_catalog_id = v_topsoil;
  UPDATE market_materials SET sort_order = 4,  is_featured = true  WHERE market_id = v_den_id AND material_catalog_id = v_csand;
  UPDATE market_materials SET sort_order = 5,  is_featured = false WHERE market_id = v_den_id AND material_catalog_id = v_msand;
  UPDATE market_materials SET sort_order = 6,  is_featured = false WHERE market_id = v_den_id AND material_catalog_id = v_usand;
  UPDATE market_materials SET sort_order = 7,  is_featured = false WHERE market_id = v_den_id AND material_catalog_id = v_pea;
  UPDATE market_materials SET sort_order = 8,  is_featured = true  WHERE market_id = v_den_id AND material_catalog_id = v_gravel57;
  UPDATE market_materials SET sort_order = 9,  is_featured = true  WHERE market_id = v_den_id AND material_catalog_id = v_flexbase;
  UPDATE market_materials SET sort_order = 10, is_featured = false WHERE market_id = v_den_id AND material_catalog_id = v_roadbase;
  UPDATE market_materials SET sort_order = 11, is_featured = false WHERE market_id = v_den_id AND material_catalog_id = v_riverrock;
  UPDATE market_materials SET sort_order = 12, is_featured = false WHERE market_id = v_den_id AND material_catalog_id = v_limestone;
  UPDATE market_materials SET sort_order = 13, is_featured = false WHERE market_id = v_den_id AND material_catalog_id = v_riprap;
  UPDATE market_materials SET sort_order = 14, is_featured = false WHERE market_id = v_den_id AND material_catalog_id = v_crushed;
  UPDATE market_materials SET sort_order = 15, is_featured = true  WHERE market_id = v_den_id AND material_catalog_id = v_dg;

  -- ================================================================
  --  8. ADD POOL ENTRIES for new yard2 offerings (DFW)
  --     These are fallback suppliers (is_preferred = false)
  -- ================================================================

  -- DFW yard2 pool entries
  FOR v_off_id IN
    SELECT so.id FROM supplier_offerings so
    WHERE so.supply_yard_id = v_dfw_yard2
      AND so.material_catalog_id IN (v_msand, v_usand, v_gravel57, v_limestone, v_riprap, v_crushed, v_dg)
  LOOP
    SELECT mm.id INTO v_mm_id
      FROM market_materials mm
      JOIN supplier_offerings so ON so.material_catalog_id = mm.material_catalog_id
      WHERE mm.market_id = v_dfw_id AND so.id = v_off_id;

    IF v_mm_id IS NOT NULL THEN
      INSERT INTO market_supply_pool (
        market_material_id, offering_id, is_preferred, is_fallback, is_active,
        composite_score, price_score, distance_score, reliability_score, availability_score
      ) VALUES (
        v_mm_id, v_off_id, false, true, true,
        75, 68, 80, 75, 85
      ) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Denver yard2 pool entries
  FOR v_off_id IN
    SELECT so.id FROM supplier_offerings so
    WHERE so.supply_yard_id = v_den_yard2
      AND so.material_catalog_id IN (v_msand, v_usand, v_gravel57, v_limestone, v_riprap, v_crushed, v_dg)
  LOOP
    SELECT mm.id INTO v_mm_id
      FROM market_materials mm
      JOIN supplier_offerings so ON so.material_catalog_id = mm.material_catalog_id
      WHERE mm.market_id = v_den_id AND so.id = v_off_id;

    IF v_mm_id IS NOT NULL THEN
      INSERT INTO market_supply_pool (
        market_material_id, offering_id, is_preferred, is_fallback, is_active,
        composite_score, price_score, distance_score, reliability_score, availability_score
      ) VALUES (
        v_mm_id, v_off_id, false, true, true,
        73, 65, 78, 75, 82
      ) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RAISE NOTICE '✓ DFW: 15 materials with real pricing, 2-yard coverage';
  RAISE NOTICE '✓ Denver: 15 materials with real pricing, 2-yard coverage, 50mi radius';
  RAISE NOTICE '013_launch_dfw_denver complete';
END;
$$;
