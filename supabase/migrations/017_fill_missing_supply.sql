-- 017: Fill missing supply data for new markets
-- Creates suppliers, yards, offerings, and pool entries for materials
-- that don't yet have coverage in the 5 new markets.

DO $$
DECLARE
  mkt RECORD;
  mm RECORD;
  has_pool BOOLEAN;
  new_supplier_id UUID;
  new_yard_id UUID;
  new_offering_id UUID;
  base_price NUMERIC;
  price_map JSONB := '{
    "fill-dirt": 18, "select-fill": 24, "topsoil": 30,
    "concrete-sand": 34, "masonry-sand": 32, "utility-sand": 28,
    "pea-gravel": 38, "base-gravel-57": 36, "flex-base": 26,
    "road-base": 24, "washed-river-rock": 48, "limestone": 40,
    "rip-rap": 50, "crushed-concrete": 22, "decomposed-granite": 42
  }'::JSONB;
  market_multiplier JSONB := '{
    "orlando": 1.0, "las-vegas": 1.15, "raleigh": 0.95,
    "salt-lake-city": 1.05, "boise": 1.0
  }'::JSONB;
  city_names JSONB := '{
    "orlando": "Orlando", "las-vegas": "Las Vegas", "raleigh": "Raleigh",
    "salt-lake-city": "Salt Lake City", "boise": "Boise"
  }'::JSONB;
  state_names JSONB := '{
    "orlando": "FL", "las-vegas": "NV", "raleigh": "NC",
    "salt-lake-city": "UT", "boise": "ID"
  }'::JSONB;
  supplier_names JSONB := '{
    "orlando": ["Central Florida Aggregates", "Sunshine Materials Co"],
    "las-vegas": ["Desert Valley Materials", "Silver State Aggregates"],
    "raleigh": ["Triangle Aggregates", "Piedmont Materials Co"],
    "salt-lake-city": ["Wasatch Front Materials", "Beehive Aggregates"],
    "boise": ["Treasure Valley Materials", "Idaho Aggregate Supply"]
  }'::JSONB;
  mult NUMERIC;
  s_name TEXT;
  city_name TEXT;
  state_code TEXT;
  yard_ids UUID[];
BEGIN
  FOR mkt IN
    SELECT id, slug FROM markets WHERE slug IN ('orlando','las-vegas','raleigh','salt-lake-city','boise')
  LOOP
    mult := (market_multiplier ->> mkt.slug)::NUMERIC;
    city_name := city_names ->> mkt.slug;
    state_code := state_names ->> mkt.slug;
    yard_ids := ARRAY[]::UUID[];

    -- Create 2 suppliers with yards for this market (if they don't exist)
    FOR i IN 0..1 LOOP
      s_name := supplier_names -> mkt.slug ->> i;

      -- Check if supplier already exists
      SELECT id INTO new_supplier_id FROM suppliers WHERE name = s_name;
      IF new_supplier_id IS NULL THEN
        INSERT INTO suppliers (name, status, primary_contact_name, primary_contact_email)
        VALUES (s_name, 'active', s_name || ' Sales', lower(replace(s_name, ' ', '')) || '@email.com')
        RETURNING id INTO new_supplier_id;
      END IF;

      -- Check if this supplier already has a yard in this market
      SELECT id INTO new_yard_id FROM supply_yards
      WHERE supplier_id = new_supplier_id AND market_id = mkt.id;

      IF new_yard_id IS NULL THEN
        INSERT INTO supply_yards (supplier_id, market_id, name, city, state, is_active)
        VALUES (new_supplier_id, mkt.id, s_name || ' - ' || city_name, city_name, state_code, true)
        RETURNING id INTO new_yard_id;
      END IF;

      yard_ids := yard_ids || new_yard_id;

      -- Create offerings for all 15 materials at this yard
      FOR mm IN
        SELECT mc.id as mc_id, mc.slug as material_slug
        FROM material_catalog mc
        WHERE mc.slug IN ('fill-dirt','select-fill','topsoil','concrete-sand','masonry-sand',
                         'utility-sand','pea-gravel','base-gravel-57','flex-base','road-base',
                         'washed-river-rock','limestone','rip-rap','crushed-concrete','decomposed-granite')
      LOOP
        base_price := (price_map ->> mm.material_slug)::NUMERIC * mult;
        -- Second supplier is 8% more expensive
        IF i = 1 THEN
          base_price := base_price * 1.08;
        END IF;

        INSERT INTO supplier_offerings (
          supply_yard_id, material_catalog_id, price_per_unit,
          minimum_order_quantity, typical_load_size, load_size_label,
          delivery_fee_base, delivery_fee_per_mile, max_delivery_miles,
          availability_confidence
        ) VALUES (
          new_yard_id, mm.mc_id, ROUND(base_price, 2),
          5, 20, '1 truckload (~20 tons)',
          95, 3.50, 50,
          0.90
        ) ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;

    -- Now ensure pool entries exist for EVERY material in this market
    FOR mm IN
      SELECT mmat.id AS mm_id, mc.id AS mc_id
      FROM market_materials mmat
      JOIN material_catalog mc ON mmat.material_catalog_id = mc.id
      WHERE mmat.market_id = mkt.id
    LOOP
      -- Check if pool entry already exists
      SELECT EXISTS(
        SELECT 1 FROM market_supply_pool WHERE market_material_id = mm.mm_id
      ) INTO has_pool;

      IF NOT has_pool THEN
        -- Find best offering from yards in this market
        SELECT so.id INTO new_offering_id
        FROM supplier_offerings so
        JOIN supply_yards sy ON so.supply_yard_id = sy.id
        WHERE sy.market_id = mkt.id
          AND so.material_catalog_id = mm.mc_id
        ORDER BY so.price_per_unit ASC
        LIMIT 1;

        IF new_offering_id IS NOT NULL THEN
          INSERT INTO market_supply_pool (
            market_material_id, offering_id,
            is_active, is_preferred, is_fallback,
            composite_score, price_score, distance_score, reliability_score, availability_score
          ) VALUES (
            mm.mm_id, new_offering_id,
            true, true, false,
            85, 90, 80, 85, 80
          ) ON CONFLICT DO NOTHING;
        END IF;
      END IF;

      -- Also add fallback if missing
      SELECT EXISTS(
        SELECT 1 FROM market_supply_pool WHERE market_material_id = mm.mm_id AND is_fallback = true
      ) INTO has_pool;

      IF NOT has_pool THEN
        SELECT so.id INTO new_offering_id
        FROM supplier_offerings so
        JOIN supply_yards sy ON so.supply_yard_id = sy.id
        WHERE sy.market_id = mkt.id
          AND so.material_catalog_id = mm.mc_id
          AND so.id NOT IN (SELECT offering_id FROM market_supply_pool WHERE market_material_id = mm.mm_id)
        ORDER BY so.price_per_unit ASC
        LIMIT 1;

        IF new_offering_id IS NOT NULL THEN
          INSERT INTO market_supply_pool (
            market_material_id, offering_id,
            is_active, is_preferred, is_fallback,
            composite_score, price_score, distance_score, reliability_score, availability_score
          ) VALUES (
            mm.mm_id, new_offering_id,
            true, false, true,
            70, 75, 70, 75, 70
          ) ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;

    RAISE NOTICE 'Market % fully populated', mkt.slug;
  END LOOP;
END;
$$;
