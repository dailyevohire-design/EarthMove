-- Add the 7 missing materials to all 10 markets
-- Each market already has 2 suppliers and 2 yards from the seed data

DO $$
DECLARE
  v_market RECORD;
  v_yard RECORD;
  v_cat_id uuid;
  v_off_id uuid;
  v_mm_id uuid;
  v_materials text[] := ARRAY['masonry-sand', 'utility-sand', 'base-gravel-57', 'limestone', 'rip-rap', 'crushed-concrete', 'decomposed-granite'];
  v_slug text;
  v_price numeric;
  v_unit material_unit;
  v_image text;
BEGIN
  FOREACH v_slug IN ARRAY v_materials LOOP
    SELECT id INTO v_cat_id FROM material_catalog WHERE slug = v_slug;
    IF v_cat_id IS NULL THEN RAISE NOTICE 'Catalog not found: %', v_slug; CONTINUE; END IF;

    -- Set price and unit based on material
    v_unit := 'ton';
    CASE v_slug
      WHEN 'masonry-sand' THEN v_price := 22.00; v_image := 'https://images.unsplash.com/photo-1583500178450-e59e4309b57d?w=800&q=80';
      WHEN 'utility-sand' THEN v_price := 15.00; v_image := 'https://images.unsplash.com/photo-1585399000684-d2f72660f092?w=800&q=80';
      WHEN 'base-gravel-57' THEN v_price := 28.00; v_image := 'https://images.unsplash.com/photo-1564419320461-6870880221ad?w=800&q=80';
      WHEN 'limestone' THEN v_price := 32.00; v_image := 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80';
      WHEN 'rip-rap' THEN v_price := 45.00; v_image := 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80';
      WHEN 'crushed-concrete' THEN v_price := 14.00; v_image := 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&q=80';
      WHEN 'decomposed-granite' THEN v_price := 38.00; v_image := 'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800&q=80';
      ELSE v_price := 20.00; v_image := NULL;
    END CASE;

    FOR v_market IN SELECT id, name FROM markets WHERE is_active = true LOOP
      -- Get first yard in this market
      SELECT sy.id INTO v_yard FROM supply_yards sy WHERE sy.market_id = v_market.id AND sy.is_active = true LIMIT 1;
      IF v_yard IS NULL THEN RAISE NOTICE 'No yard for market: %', v_market.name; CONTINUE; END IF;

      -- Check if offering already exists
      IF EXISTS (SELECT 1 FROM supplier_offerings WHERE supply_yard_id = v_yard.id AND material_catalog_id = v_cat_id) THEN
        CONTINUE;
      END IF;

      -- Create offering
      INSERT INTO supplier_offerings (
        supply_yard_id, material_catalog_id, unit, price_per_unit,
        minimum_order_quantity, typical_load_size, load_size_label,
        delivery_fee_base, delivery_fee_per_mile, max_delivery_miles,
        is_available, available_for_delivery, is_public,
        availability_confidence, data_source, image_url
      ) VALUES (
        v_yard.id, v_cat_id, v_unit, v_price + (random() * 5 - 2.5)::numeric(10,2),
        2, 14, '14-ton load',
        95.00, 3.50, 50,
        true, true, true,
        85, 'manual', v_image
      ) RETURNING id INTO v_off_id;

      -- Create market_material
      INSERT INTO market_materials (
        market_id, material_catalog_id, is_visible, is_available, is_featured,
        price_display_mode, sort_order, display_image_url
      ) VALUES (
        v_market.id, v_cat_id, true, true, false, 'exact', 10, v_image
      ) RETURNING id INTO v_mm_id;

      -- Create pool entry
      INSERT INTO market_supply_pool (
        market_material_id, offering_id, is_preferred, is_active,
        composite_score, price_score, distance_score, reliability_score, availability_score
      ) VALUES (
        v_mm_id, v_off_id, true, true,
        78, 70, 80, 75, 85
      );

      RAISE NOTICE 'Added % to %', v_slug, v_market.name;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'DONE - all missing materials added to all markets';
END;
$$;
