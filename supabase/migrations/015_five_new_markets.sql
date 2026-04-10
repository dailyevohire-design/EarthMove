-- 015: Add 5 new launch markets: Orlando, Las Vegas, Raleigh, Salt Lake City, Boise
-- These markets launch with custom display pricing (no suppliers yet).
-- The scraping pipeline will populate suppliers/offerings post-launch.

-- ============================================================
-- MARKET ROWS
-- ============================================================
INSERT INTO markets (id, name, slug, state, is_active, center_lat, center_lng, timezone, default_delivery_radius_miles)
VALUES
  ('b1a00000-0000-0000-0000-000000000001', 'Orlando', 'orlando', 'FL', true, 28.5383, -81.3792, 'America/New_York', 60),
  ('b1a00000-0000-0000-0000-000000000002', 'Las Vegas', 'las-vegas', 'NV', true, 36.1699, -115.1398, 'America/Los_Angeles', 50),
  ('b1a00000-0000-0000-0000-000000000003', 'Raleigh', 'raleigh', 'NC', true, 35.7796, -78.6382, 'America/New_York', 60),
  ('b1a00000-0000-0000-0000-000000000004', 'Salt Lake City', 'salt-lake-city', 'UT', true, 40.7608, -111.8910, 'America/Denver', 60),
  ('b1a00000-0000-0000-0000-000000000005', 'Boise', 'boise', 'ID', true, 43.6150, -116.2023, 'America/Boise', 50)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- MARKET MATERIALS (15 per market, custom display pricing)
-- ============================================================
-- Material catalog IDs:
--   fill-dirt:          ba7d5c6c-4595-4a3d-ac94-45f0b2003efa
--   select-fill:        50069494-8f57-4f1c-8276-5d0847d6f9d4
--   topsoil:            5914c3ff-a3f9-45f6-8080-edccc1fd7396
--   concrete-sand:      6f05aa89-34f3-4ca5-898e-fba6e3ce4c55
--   masonry-sand:       0432f60f-9c40-4a90-823d-2f8913e979db
--   utility-sand:       f52bddd0-5b4a-48ed-8d17-1b05add79a0c
--   pea-gravel:         37473f74-b830-47dc-84a0-a12e2ca58045
--   base-gravel-57:     c07074ee-69be-4383-b1ee-f3957fea7ac1
--   flex-base:          c6ec2458-99a2-45cd-8af4-43d58d87a9e0
--   road-base:          00b032d1-f6b4-406f-bdad-6da3869f7241
--   washed-river-rock:  fa4a56ba-8b1a-43d1-81d5-5815f30a3438
--   limestone:          e0ebb867-2c5a-450a-a67d-d663b1929a78
--   rip-rap:            19695bd3-c842-41a3-baba-6ebbf28c0b93
--   crushed-concrete:   ea3e57cb-a8eb-41d5-9c26-143517c57dcf
--   decomposed-granite: 1d712dbe-1701-44fb-9858-96a72e12f06f

DO $$
DECLARE
  m RECORD;
  mat RECORD;
  sort_idx INT;
  featured_slugs TEXT[] := ARRAY['fill-dirt','road-base','crushed-concrete','flex-base','topsoil'];
  prices JSONB := '{
    "fill-dirt": {"orlando": 20, "las-vegas": 25, "raleigh": 18, "salt-lake-city": 22, "boise": 20},
    "select-fill": {"orlando": 26, "las-vegas": 30, "raleigh": 24, "salt-lake-city": 28, "boise": 25},
    "topsoil": {"orlando": 32, "las-vegas": 38, "raleigh": 30, "salt-lake-city": 34, "boise": 28},
    "concrete-sand": {"orlando": 34, "las-vegas": 38, "raleigh": 32, "salt-lake-city": 36, "boise": 35},
    "masonry-sand": {"orlando": 32, "las-vegas": 36, "raleigh": 30, "salt-lake-city": 34, "boise": 32},
    "utility-sand": {"orlando": 28, "las-vegas": 34, "raleigh": 26, "salt-lake-city": 30, "boise": 28},
    "pea-gravel": {"orlando": 38, "las-vegas": 42, "raleigh": 36, "salt-lake-city": 40, "boise": 38},
    "base-gravel-57": {"orlando": 36, "las-vegas": 40, "raleigh": 34, "salt-lake-city": 38, "boise": 35},
    "flex-base": {"orlando": 26, "las-vegas": 30, "raleigh": 24, "salt-lake-city": 28, "boise": 26},
    "road-base": {"orlando": 24, "las-vegas": 28, "raleigh": 22, "salt-lake-city": 26, "boise": 24},
    "washed-river-rock": {"orlando": 48, "las-vegas": 55, "raleigh": 45, "salt-lake-city": 50, "boise": 48},
    "limestone": {"orlando": 40, "las-vegas": 46, "raleigh": 38, "salt-lake-city": 42, "boise": 40},
    "rip-rap": {"orlando": 50, "las-vegas": 58, "raleigh": 48, "salt-lake-city": 52, "boise": 50},
    "crushed-concrete": {"orlando": 22, "las-vegas": 26, "raleigh": 20, "salt-lake-city": 24, "boise": 22},
    "decomposed-granite": {"orlando": 42, "las-vegas": 45, "raleigh": 40, "salt-lake-city": 44, "boise": 42}
  }'::JSONB;
BEGIN
  FOR m IN
    SELECT id, slug FROM markets WHERE slug IN ('orlando','las-vegas','raleigh','salt-lake-city','boise')
  LOOP
    sort_idx := 0;
    FOR mat IN
      SELECT id, slug FROM material_catalog
      WHERE slug IN ('fill-dirt','select-fill','topsoil','concrete-sand','masonry-sand',
                     'utility-sand','pea-gravel','base-gravel-57','flex-base','road-base',
                     'washed-river-rock','limestone','rip-rap','crushed-concrete','decomposed-granite')
      ORDER BY slug
    LOOP
      sort_idx := sort_idx + 1;
      INSERT INTO market_materials (
        market_id, material_catalog_id, is_visible, is_available, is_featured,
        sort_order, price_display_mode, custom_display_price
      ) VALUES (
        m.id, mat.id, true, true,
        mat.slug = ANY(featured_slugs),
        sort_idx,
        'custom',
        (prices -> mat.slug ->> m.slug)::numeric
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- ============================================================
-- PRICING RULES (3 per market)
-- ============================================================
DO $$
DECLARE
  m RECORD;
  delivery_configs JSONB := '{
    "orlando":        {"base_fee": 95, "free_miles": 10, "per_mile": 3.50},
    "las-vegas":      {"base_fee": 105, "free_miles": 8,  "per_mile": 4.00},
    "raleigh":        {"base_fee": 92, "free_miles": 10, "per_mile": 3.25},
    "salt-lake-city": {"base_fee": 100, "free_miles": 8,  "per_mile": 3.75},
    "boise":          {"base_fee": 98, "free_miles": 10, "per_mile": 3.50}
  }'::JSONB;
BEGIN
  FOR m IN
    SELECT id, slug FROM markets WHERE slug IN ('orlando','las-vegas','raleigh','salt-lake-city','boise')
  LOOP
    -- Platform fee: 9%
    INSERT INTO pricing_rules (market_id, rule_type, config, is_active, effective_from)
    VALUES (m.id, 'platform_fee', '{"mode": "percentage", "value": 9}'::jsonb, true, NOW())
    ON CONFLICT DO NOTHING;

    -- Delivery tier
    INSERT INTO pricing_rules (market_id, rule_type, config, is_active, effective_from)
    VALUES (m.id, 'delivery_tier', delivery_configs -> m.slug, true, NOW())
    ON CONFLICT DO NOTHING;

    -- Min order value: $100
    INSERT INTO pricing_rules (market_id, rule_type, config, is_active, effective_from)
    VALUES (m.id, 'min_order_value', '{"value": 100}'::jsonb, true, NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
