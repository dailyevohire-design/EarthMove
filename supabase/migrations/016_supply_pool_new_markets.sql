-- 016: Create supply yards, offerings, and pool entries for 5 new markets
-- For each new market, pick 2 suppliers from the same state (from other markets),
-- create a yard in the new market, clone their offerings, then build pool entries.

DO $$
DECLARE
  mkt RECORD;
  src_yard RECORD;
  new_yard_id UUID;
  src_offering RECORD;
  new_offering_id UUID;
  mm RECORD;
  best_off_id UUID;
  fallback_off_id UUID;
  state_map JSONB := '{
    "orlando": "FL",
    "las-vegas": "NV",
    "raleigh": "NC",
    "salt-lake-city": "UT",
    "boise": "ID"
  }'::JSONB;
  city_map JSONB := '{
    "orlando": "Orlando",
    "las-vegas": "Las Vegas",
    "raleigh": "Raleigh",
    "salt-lake-city": "Salt Lake City",
    "boise": "Boise"
  }'::JSONB;
  target_state TEXT;
  target_city TEXT;
  yard_count INT;
BEGIN
  FOR mkt IN
    SELECT id, slug FROM markets WHERE slug IN ('orlando','las-vegas','raleigh','salt-lake-city','boise')
  LOOP
    target_state := state_map ->> mkt.slug;
    target_city := city_map ->> mkt.slug;
    yard_count := 0;

    -- Find up to 2 source yards from the same state (from other markets) that have offerings
    FOR src_yard IN
      SELECT DISTINCT ON (sy.supplier_id)
        sy.id, sy.supplier_id, sy.name, s.name as supplier_name
      FROM supply_yards sy
      JOIN suppliers s ON sy.supplier_id = s.id
      JOIN supplier_offerings so ON so.supply_yard_id = sy.id
      WHERE sy.state = target_state
        AND sy.is_active = true
        AND sy.market_id != mkt.id
      ORDER BY sy.supplier_id, (SELECT COUNT(*) FROM supplier_offerings WHERE supply_yard_id = sy.id) DESC
      LIMIT 2
    LOOP
      yard_count := yard_count + 1;

      -- Create a new yard in this market for this supplier
      INSERT INTO supply_yards (
        supplier_id, market_id, name, city, state, is_active
      ) VALUES (
        src_yard.supplier_id, mkt.id,
        src_yard.supplier_name || ' - ' || target_city || ' Yard',
        target_city, target_state, true
      ) RETURNING id INTO new_yard_id;

      -- Clone the 15 core material offerings from the source yard
      FOR src_offering IN
        SELECT so.material_catalog_id, so.price_per_unit, so.minimum_order_quantity,
               so.typical_load_size, so.load_size_label, so.delivery_fee_base,
               so.delivery_fee_per_mile, so.max_delivery_miles, so.availability_confidence
        FROM supplier_offerings so
        JOIN material_catalog mc ON so.material_catalog_id = mc.id
        WHERE so.supply_yard_id = src_yard.id
          AND mc.slug IN ('fill-dirt','select-fill','topsoil','concrete-sand','masonry-sand',
                         'utility-sand','pea-gravel','base-gravel-57','flex-base','road-base',
                         'washed-river-rock','limestone','rip-rap','crushed-concrete','decomposed-granite')
      LOOP
        INSERT INTO supplier_offerings (
          supply_yard_id, material_catalog_id, price_per_unit,
          minimum_order_quantity, typical_load_size, load_size_label,
          delivery_fee_base, delivery_fee_per_mile, max_delivery_miles,
          availability_confidence
        ) VALUES (
          new_yard_id, src_offering.material_catalog_id, src_offering.price_per_unit,
          src_offering.minimum_order_quantity, src_offering.typical_load_size, src_offering.load_size_label,
          src_offering.delivery_fee_base, src_offering.delivery_fee_per_mile, src_offering.max_delivery_miles,
          src_offering.availability_confidence
        ) ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;

    -- Now create pool entries: for each market_material, link to the best offering in this market
    FOR mm IN
      SELECT mmat.id AS mm_id, mc.id AS mc_id
      FROM market_materials mmat
      JOIN material_catalog mc ON mmat.material_catalog_id = mc.id
      WHERE mmat.market_id = mkt.id
    LOOP
      -- Best offering (preferred)
      SELECT so.id INTO best_off_id
      FROM supplier_offerings so
      JOIN supply_yards sy ON so.supply_yard_id = sy.id
      WHERE sy.market_id = mkt.id
        AND so.material_catalog_id = mm.mc_id
      ORDER BY so.price_per_unit ASC
      LIMIT 1;

      IF best_off_id IS NOT NULL THEN
        INSERT INTO market_supply_pool (
          market_material_id, offering_id,
          is_active, is_preferred, is_fallback,
          composite_score, price_score, distance_score, reliability_score, availability_score
        ) VALUES (
          mm.mm_id, best_off_id,
          true, true, false,
          85, 90, 80, 85, 80
        ) ON CONFLICT DO NOTHING;

        -- Fallback offering (second option)
        SELECT so.id INTO fallback_off_id
        FROM supplier_offerings so
        JOIN supply_yards sy ON so.supply_yard_id = sy.id
        WHERE sy.market_id = mkt.id
          AND so.material_catalog_id = mm.mc_id
          AND so.id != best_off_id
        ORDER BY so.price_per_unit ASC
        LIMIT 1;

        IF fallback_off_id IS NOT NULL THEN
          INSERT INTO market_supply_pool (
            market_material_id, offering_id,
            is_active, is_preferred, is_fallback,
            composite_score, price_score, distance_score, reliability_score, availability_score
          ) VALUES (
            mm.mm_id, fallback_off_id,
            true, false, true,
            70, 75, 70, 75, 70
          ) ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;

    RAISE NOTICE 'Market % populated with % yards', mkt.slug, yard_count;
  END LOOP;
END;
$$;
