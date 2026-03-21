-- ============================================================
-- AGGREGATEMARKET — 9 Additional Markets + Suppliers + Deals
-- Run AFTER 003. Adds Houston, Austin, San Antonio, Phoenix,
-- Denver, Atlanta, Nashville, Charlotte, Tampa.
-- Each gets 2 suppliers, 2 yards, 8 offerings, 8 market_materials,
-- 8 pool entries, and 1-2 promotions.
-- ============================================================

do $$
declare
  -- Catalog IDs (from 001_schema)
  v_fill_id       uuid;
  v_select_id     uuid;
  v_topsoil_id    uuid;
  v_csand_id      uuid;
  v_pea_id        uuid;
  v_flexbase_id   uuid;
  v_roadbase_id   uuid;
  v_rr_id         uuid;

  -- Working vars per city
  v_market_id     uuid;
  v_sup1_id       uuid;
  v_sup2_id       uuid;
  v_yard1_id      uuid;
  v_yard2_id      uuid;

  v_off1 uuid; v_off2 uuid; v_off3 uuid; v_off4 uuid; v_off5 uuid;
  v_off6 uuid; v_off7 uuid; v_off8 uuid;

  v_mm1 uuid; v_mm2 uuid; v_mm3 uuid; v_mm4 uuid;
  v_mm5 uuid; v_mm6 uuid; v_mm7 uuid; v_mm8 uuid;

begin
  -- Resolve catalog IDs
  select id into v_fill_id     from material_catalog where slug = 'fill-dirt';
  select id into v_select_id   from material_catalog where slug = 'select-fill';
  select id into v_topsoil_id  from material_catalog where slug = 'topsoil';
  select id into v_csand_id    from material_catalog where slug = 'concrete-sand';
  select id into v_pea_id      from material_catalog where slug = 'pea-gravel';
  select id into v_flexbase_id from material_catalog where slug = 'flex-base';
  select id into v_roadbase_id from material_catalog where slug = 'road-base';
  select id into v_rr_id       from material_catalog where slug = 'washed-river-rock';

  -- ================================================================
  -- HOUSTON
  -- ================================================================
  insert into markets (name, slug, state, is_active, center_lat, center_lng, timezone)
  values ('Houston', 'houston', 'TX', true, 29.7604, -95.3698, 'America/Chicago')
  returning id into v_market_id;

  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Bayou Materials Co', 'bayou-materials', 'active', 'Carlos Reyes', '713-555-0101', 'manual')
  returning id into v_sup1_id;
  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Gulf Coast Aggregate', 'gulf-coast-agg', 'active', 'Mike Torres', '281-555-0202', 'manual')
  returning id into v_sup2_id;

  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup1_id, v_market_id, 'Bayou — Katy Yard', 'Katy', 'TX', '77449', 55, true, true)
  returning id into v_yard1_id;
  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup2_id, v_market_id, 'Gulf Coast — Pasadena', 'Pasadena', 'TX', '77502', 50, true, true)
  returning id into v_yard2_id;

  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard1_id, v_fill_id,    'ton', 10.50, 14, 14, '14-ton load', 90.00, 3.25, 55, true, true, true, 92, 'manual'),
    (v_yard1_id, v_select_id,  'ton', 17.00, 14, 14, '14-ton load', 90.00, 3.25, 55, true, true, true, 90, 'manual'),
    (v_yard1_id, v_topsoil_id, 'cubic_yard', 42.00, 5, 10, '10-yard load', 105.00, 3.75, 55, true, true, true, 85, 'manual'),
    (v_yard1_id, v_csand_id,   'ton', 17.50, 5, 12, '12-ton load', 85.00, 3.00, 55, true, true, true, 88, 'manual'),
    (v_yard1_id, v_flexbase_id,'ton', 22.00, 14, 14, '14-ton load', 90.00, 3.25, 55, true, true, true, 93, 'manual');

  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard2_id, v_pea_id,      'ton', 33.00, 2, 14, '14-ton load', 95.00, 3.50, 50, true, true, true, 86, 'manual'),
    (v_yard2_id, v_roadbase_id, 'ton', 14.50, 14, 14, '14-ton load', 80.00, 2.75, 50, true, true, true, 88, 'manual'),
    (v_yard2_id, v_rr_id,       'ton', 40.00, 2, 12, '12-ton load', 100.00, 3.75, 50, true, true, true, 83, 'manual');

  select id into v_off1 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_fill_id;
  select id into v_off2 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_select_id;
  select id into v_off3 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_topsoil_id;
  select id into v_off4 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_csand_id;
  select id into v_off5 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_flexbase_id;
  select id into v_off6 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_pea_id;
  select id into v_off7 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_roadbase_id;
  select id into v_off8 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_rr_id;

  insert into market_materials (market_id, material_catalog_id, is_visible, is_available, is_featured, price_display_mode, sort_order) values
    (v_market_id, v_fill_id, true, true, true, 'exact', 1),
    (v_market_id, v_select_id, true, true, true, 'exact', 2),
    (v_market_id, v_topsoil_id, true, true, false, 'exact', 3),
    (v_market_id, v_csand_id, true, true, false, 'exact', 4),
    (v_market_id, v_pea_id, true, true, true, 'exact', 5),
    (v_market_id, v_flexbase_id, true, true, true, 'exact', 6),
    (v_market_id, v_roadbase_id, true, true, false, 'exact', 7),
    (v_market_id, v_rr_id, true, true, false, 'exact', 8);

  select id into v_mm1 from market_materials where market_id = v_market_id and material_catalog_id = v_fill_id;
  select id into v_mm2 from market_materials where market_id = v_market_id and material_catalog_id = v_select_id;
  select id into v_mm3 from market_materials where market_id = v_market_id and material_catalog_id = v_topsoil_id;
  select id into v_mm4 from market_materials where market_id = v_market_id and material_catalog_id = v_csand_id;
  select id into v_mm5 from market_materials where market_id = v_market_id and material_catalog_id = v_pea_id;
  select id into v_mm6 from market_materials where market_id = v_market_id and material_catalog_id = v_flexbase_id;
  select id into v_mm7 from market_materials where market_id = v_market_id and material_catalog_id = v_roadbase_id;
  select id into v_mm8 from market_materials where market_id = v_market_id and material_catalog_id = v_rr_id;

  insert into market_supply_pool (market_material_id, offering_id, is_preferred, is_active, composite_score, price_score, distance_score, reliability_score, availability_score) values
    (v_mm1, v_off1, true, true, 82, 80, 85, 75, 92),
    (v_mm2, v_off2, true, true, 80, 72, 85, 75, 90),
    (v_mm3, v_off3, true, true, 78, 68, 85, 75, 85),
    (v_mm4, v_off4, true, true, 79, 72, 85, 75, 88),
    (v_mm5, v_off6, true, true, 77, 66, 80, 75, 86),
    (v_mm6, v_off5, true, true, 83, 78, 85, 75, 93),
    (v_mm7, v_off7, true, true, 76, 70, 80, 75, 88),
    (v_mm8, v_off8, true, true, 75, 62, 80, 75, 83);

  insert into pricing_rules (market_id, rule_type, config) values
    (v_market_id, 'platform_fee', '{"mode":"percentage","value":9.0}'::jsonb),
    (v_market_id, 'delivery_tier', '{"base_fee":90,"free_miles":10,"per_mile":3.25}'::jsonb),
    (v_market_id, 'min_order_value', '{"amount":100}'::jsonb);

  -- Houston deal
  insert into promotions (market_id, title, description, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active)
  values (v_market_id, 'Houston Spring Special — Fill Dirt', 'Spring clearing season price on fill dirt loads', 'SPRING DEAL', false, 'percentage', 10, now(), now() + interval '30 days', true);

  -- ================================================================
  -- AUSTIN
  -- ================================================================
  insert into markets (name, slug, state, is_active, center_lat, center_lng, timezone)
  values ('Austin', 'austin', 'TX', true, 30.2672, -97.7431, 'America/Chicago')
  returning id into v_market_id;

  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Hill Country Materials', 'hill-country-mat', 'active', 'Sarah Kim', '512-555-0301', 'manual')
  returning id into v_sup1_id;
  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Capital Aggregate Supply', 'capital-agg', 'active', 'David Park', '512-555-0302', 'manual')
  returning id into v_sup2_id;

  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup1_id, v_market_id, 'Hill Country — Round Rock', 'Round Rock', 'TX', '78664', 45, true, true) returning id into v_yard1_id;
  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup2_id, v_market_id, 'Capital — Buda Yard', 'Buda', 'TX', '78610', 40, true, true) returning id into v_yard2_id;

  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard1_id, v_fill_id,    'ton', 13.00, 14, 14, '14-ton load', 100.00, 3.75, 45, true, true, true, 88, 'manual'),
    (v_yard1_id, v_select_id,  'ton', 20.00, 14, 14, '14-ton load', 100.00, 3.75, 45, true, true, true, 87, 'manual'),
    (v_yard1_id, v_topsoil_id, 'cubic_yard', 48.00, 5, 10, '10-yard load', 115.00, 4.25, 45, true, true, true, 82, 'manual'),
    (v_yard1_id, v_csand_id,   'ton', 20.50, 5, 12, '12-ton load', 95.00, 3.50, 45, true, true, true, 85, 'manual'),
    (v_yard1_id, v_flexbase_id,'ton', 26.00, 14, 14, '14-ton load', 100.00, 3.50, 45, true, true, true, 90, 'manual');
  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard2_id, v_pea_id,      'ton', 37.00, 2, 14, '14-ton load', 105.00, 4.00, 40, true, true, true, 84, 'manual'),
    (v_yard2_id, v_roadbase_id, 'ton', 17.50, 14, 14, '14-ton load', 90.00, 3.25, 40, true, true, true, 86, 'manual'),
    (v_yard2_id, v_rr_id,       'ton', 45.00, 2, 12, '12-ton load', 110.00, 4.25, 40, true, true, true, 80, 'manual');

  select id into v_off1 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_fill_id;
  select id into v_off2 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_select_id;
  select id into v_off3 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_topsoil_id;
  select id into v_off4 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_csand_id;
  select id into v_off5 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_flexbase_id;
  select id into v_off6 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_pea_id;
  select id into v_off7 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_roadbase_id;
  select id into v_off8 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_rr_id;

  insert into market_materials (market_id, material_catalog_id, is_visible, is_available, is_featured, price_display_mode, sort_order) values
    (v_market_id, v_fill_id, true, true, true, 'exact', 1), (v_market_id, v_select_id, true, true, true, 'exact', 2),
    (v_market_id, v_topsoil_id, true, true, true, 'exact', 3), (v_market_id, v_csand_id, true, true, false, 'exact', 4),
    (v_market_id, v_pea_id, true, true, true, 'exact', 5), (v_market_id, v_flexbase_id, true, true, false, 'exact', 6),
    (v_market_id, v_roadbase_id, true, true, false, 'exact', 7), (v_market_id, v_rr_id, true, true, false, 'exact', 8);

  select id into v_mm1 from market_materials where market_id = v_market_id and material_catalog_id = v_fill_id;
  select id into v_mm2 from market_materials where market_id = v_market_id and material_catalog_id = v_select_id;
  select id into v_mm3 from market_materials where market_id = v_market_id and material_catalog_id = v_topsoil_id;
  select id into v_mm4 from market_materials where market_id = v_market_id and material_catalog_id = v_csand_id;
  select id into v_mm5 from market_materials where market_id = v_market_id and material_catalog_id = v_pea_id;
  select id into v_mm6 from market_materials where market_id = v_market_id and material_catalog_id = v_flexbase_id;
  select id into v_mm7 from market_materials where market_id = v_market_id and material_catalog_id = v_roadbase_id;
  select id into v_mm8 from market_materials where market_id = v_market_id and material_catalog_id = v_rr_id;

  insert into market_supply_pool (market_material_id, offering_id, is_preferred, is_active, composite_score, price_score, distance_score, reliability_score, availability_score) values
    (v_mm1, v_off1, true, true, 80, 75, 82, 78, 88), (v_mm2, v_off2, true, true, 79, 70, 82, 78, 87),
    (v_mm3, v_off3, true, true, 76, 65, 82, 78, 82), (v_mm4, v_off4, true, true, 78, 70, 82, 78, 85),
    (v_mm5, v_off6, true, true, 75, 60, 78, 78, 84), (v_mm6, v_off5, true, true, 81, 75, 82, 78, 90),
    (v_mm7, v_off7, true, true, 77, 68, 78, 78, 86), (v_mm8, v_off8, true, true, 74, 58, 78, 78, 80);

  insert into pricing_rules (market_id, rule_type, config) values
    (v_market_id, 'platform_fee', '{"mode":"percentage","value":9.0}'::jsonb),
    (v_market_id, 'delivery_tier', '{"base_fee":100,"free_miles":8,"per_mile":3.75}'::jsonb),
    (v_market_id, 'min_order_value', '{"amount":125}'::jsonb);

  insert into promotions (market_id, title, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active, material_catalog_id)
  values (v_market_id, 'Austin Topsoil Blowout — 15% Off', 'HOT DEAL', true, 'percentage', 15, now(), now() + interval '14 days', true, v_topsoil_id);

  -- ================================================================
  -- SAN ANTONIO
  -- ================================================================
  insert into markets (name, slug, state, is_active, center_lat, center_lng, timezone)
  values ('San Antonio', 'san-antonio', 'TX', true, 29.4241, -98.4936, 'America/Chicago')
  returning id into v_market_id;

  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Alamo Dirt Works', 'alamo-dirt', 'active', 'Jesse Garza', '210-555-0401', 'manual')
  returning id into v_sup1_id;
  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('River City Gravel', 'river-city-gravel', 'active', 'Anna Perez', '210-555-0402', 'manual')
  returning id into v_sup2_id;

  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup1_id, v_market_id, 'Alamo — Converse Yard', 'Converse', 'TX', '78109', 50, true, true) returning id into v_yard1_id;
  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup2_id, v_market_id, 'River City — New Braunfels', 'New Braunfels', 'TX', '78130', 45, true, true) returning id into v_yard2_id;

  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard1_id, v_fill_id, 'ton', 11.00, 14, 14, '14-ton load', 88.00, 3.00, 50, true, true, true, 91, 'manual'),
    (v_yard1_id, v_select_id, 'ton', 16.50, 14, 14, '14-ton load', 88.00, 3.00, 50, true, true, true, 89, 'manual'),
    (v_yard1_id, v_topsoil_id, 'cubic_yard', 40.00, 5, 10, '10-yard load', 100.00, 3.50, 50, true, true, true, 84, 'manual'),
    (v_yard1_id, v_csand_id, 'ton', 18.00, 5, 12, '12-ton load', 85.00, 3.00, 50, true, true, true, 87, 'manual'),
    (v_yard1_id, v_flexbase_id, 'ton', 21.50, 14, 14, '14-ton load', 88.00, 3.00, 50, true, true, true, 92, 'manual');
  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard2_id, v_pea_id, 'ton', 32.00, 2, 14, '14-ton load', 92.00, 3.25, 45, true, true, true, 85, 'manual'),
    (v_yard2_id, v_roadbase_id, 'ton', 15.00, 14, 14, '14-ton load', 82.00, 2.75, 45, true, true, true, 87, 'manual'),
    (v_yard2_id, v_rr_id, 'ton', 38.00, 2, 12, '12-ton load', 98.00, 3.50, 45, true, true, true, 82, 'manual');

  select id into v_off1 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_fill_id;
  select id into v_off2 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_select_id;
  select id into v_off3 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_topsoil_id;
  select id into v_off4 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_csand_id;
  select id into v_off5 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_flexbase_id;
  select id into v_off6 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_pea_id;
  select id into v_off7 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_roadbase_id;
  select id into v_off8 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_rr_id;

  insert into market_materials (market_id, material_catalog_id, is_visible, is_available, is_featured, price_display_mode, sort_order) values
    (v_market_id, v_fill_id, true, true, true, 'exact', 1), (v_market_id, v_select_id, true, true, true, 'exact', 2),
    (v_market_id, v_topsoil_id, true, true, false, 'exact', 3), (v_market_id, v_csand_id, true, true, true, 'exact', 4),
    (v_market_id, v_pea_id, true, true, true, 'exact', 5), (v_market_id, v_flexbase_id, true, true, false, 'exact', 6),
    (v_market_id, v_roadbase_id, true, true, false, 'exact', 7), (v_market_id, v_rr_id, true, true, false, 'exact', 8);

  select id into v_mm1 from market_materials where market_id = v_market_id and material_catalog_id = v_fill_id;
  select id into v_mm2 from market_materials where market_id = v_market_id and material_catalog_id = v_select_id;
  select id into v_mm3 from market_materials where market_id = v_market_id and material_catalog_id = v_topsoil_id;
  select id into v_mm4 from market_materials where market_id = v_market_id and material_catalog_id = v_csand_id;
  select id into v_mm5 from market_materials where market_id = v_market_id and material_catalog_id = v_pea_id;
  select id into v_mm6 from market_materials where market_id = v_market_id and material_catalog_id = v_flexbase_id;
  select id into v_mm7 from market_materials where market_id = v_market_id and material_catalog_id = v_roadbase_id;
  select id into v_mm8 from market_materials where market_id = v_market_id and material_catalog_id = v_rr_id;

  insert into market_supply_pool (market_material_id, offering_id, is_preferred, is_active, composite_score, price_score, distance_score, reliability_score, availability_score) values
    (v_mm1, v_off1, true, true, 83, 82, 85, 76, 91), (v_mm2, v_off2, true, true, 81, 74, 85, 76, 89),
    (v_mm3, v_off3, true, true, 77, 66, 85, 76, 84), (v_mm4, v_off4, true, true, 79, 72, 85, 76, 87),
    (v_mm5, v_off6, true, true, 78, 68, 82, 76, 85), (v_mm6, v_off5, true, true, 84, 80, 85, 76, 92),
    (v_mm7, v_off7, true, true, 77, 70, 82, 76, 87), (v_mm8, v_off8, true, true, 76, 64, 82, 76, 82);

  insert into pricing_rules (market_id, rule_type, config) values
    (v_market_id, 'platform_fee', '{"mode":"percentage","value":9.0}'::jsonb),
    (v_market_id, 'delivery_tier', '{"base_fee":88,"free_miles":10,"per_mile":3.00}'::jsonb),
    (v_market_id, 'min_order_value', '{"amount":100}'::jsonb);

  insert into promotions (market_id, title, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active, material_catalog_id)
  values (v_market_id, 'SA Fill Dirt — $2 Off Per Ton', 'SAVE $2', false, 'flat_amount', 2, now(), now() + interval '21 days', true, v_fill_id);

  -- ================================================================
  -- PHOENIX
  -- ================================================================
  insert into markets (name, slug, state, is_active, center_lat, center_lng, timezone)
  values ('Phoenix', 'phoenix', 'AZ', true, 33.4484, -112.0740, 'America/Phoenix')
  returning id into v_market_id;

  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Desert Rock Supply', 'desert-rock', 'active', 'Tom Yazzie', '480-555-0501', 'manual')
  returning id into v_sup1_id;
  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Valley Aggregate', 'valley-agg', 'active', 'Lisa Chen', '602-555-0502', 'manual')
  returning id into v_sup2_id;

  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup1_id, v_market_id, 'Desert Rock — Mesa', 'Mesa', 'AZ', '85201', 55, true, true) returning id into v_yard1_id;
  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup2_id, v_market_id, 'Valley — Glendale', 'Glendale', 'AZ', '85301', 50, true, true) returning id into v_yard2_id;

  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard1_id, v_fill_id, 'ton', 14.00, 14, 14, '14-ton load', 105.00, 4.00, 55, true, true, true, 90, 'manual'),
    (v_yard1_id, v_select_id, 'ton', 21.00, 14, 14, '14-ton load', 105.00, 4.00, 55, true, true, true, 88, 'manual'),
    (v_yard1_id, v_topsoil_id, 'cubic_yard', 52.00, 5, 10, '10-yard load', 120.00, 4.50, 55, true, true, true, 80, 'manual'),
    (v_yard1_id, v_csand_id, 'ton', 22.00, 5, 12, '12-ton load', 100.00, 3.75, 55, true, true, true, 86, 'manual'),
    (v_yard1_id, v_flexbase_id, 'ton', 28.00, 14, 14, '14-ton load', 105.00, 3.75, 55, true, true, true, 91, 'manual');
  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard2_id, v_pea_id, 'ton', 38.00, 2, 14, '14-ton load', 110.00, 4.00, 50, true, true, true, 83, 'manual'),
    (v_yard2_id, v_roadbase_id, 'ton', 18.00, 14, 14, '14-ton load', 95.00, 3.50, 50, true, true, true, 85, 'manual'),
    (v_yard2_id, v_rr_id, 'ton', 48.00, 2, 12, '12-ton load', 115.00, 4.25, 50, true, true, true, 81, 'manual');

  select id into v_off1 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_fill_id;
  select id into v_off2 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_select_id;
  select id into v_off3 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_topsoil_id;
  select id into v_off4 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_csand_id;
  select id into v_off5 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_flexbase_id;
  select id into v_off6 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_pea_id;
  select id into v_off7 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_roadbase_id;
  select id into v_off8 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_rr_id;

  insert into market_materials (market_id, material_catalog_id, is_visible, is_available, is_featured, price_display_mode, sort_order) values
    (v_market_id, v_fill_id, true, true, true, 'exact', 1), (v_market_id, v_select_id, true, true, false, 'exact', 2),
    (v_market_id, v_topsoil_id, true, true, true, 'exact', 3), (v_market_id, v_csand_id, true, true, false, 'exact', 4),
    (v_market_id, v_pea_id, true, true, true, 'exact', 5), (v_market_id, v_flexbase_id, true, true, true, 'exact', 6),
    (v_market_id, v_roadbase_id, true, true, false, 'exact', 7), (v_market_id, v_rr_id, true, true, false, 'exact', 8);

  select id into v_mm1 from market_materials where market_id = v_market_id and material_catalog_id = v_fill_id;
  select id into v_mm2 from market_materials where market_id = v_market_id and material_catalog_id = v_select_id;
  select id into v_mm3 from market_materials where market_id = v_market_id and material_catalog_id = v_topsoil_id;
  select id into v_mm4 from market_materials where market_id = v_market_id and material_catalog_id = v_csand_id;
  select id into v_mm5 from market_materials where market_id = v_market_id and material_catalog_id = v_pea_id;
  select id into v_mm6 from market_materials where market_id = v_market_id and material_catalog_id = v_flexbase_id;
  select id into v_mm7 from market_materials where market_id = v_market_id and material_catalog_id = v_roadbase_id;
  select id into v_mm8 from market_materials where market_id = v_market_id and material_catalog_id = v_rr_id;

  insert into market_supply_pool (market_material_id, offering_id, is_preferred, is_active, composite_score, price_score, distance_score, reliability_score, availability_score) values
    (v_mm1, v_off1, true, true, 81, 72, 84, 80, 90), (v_mm2, v_off2, true, true, 79, 68, 84, 80, 88),
    (v_mm3, v_off3, true, true, 74, 58, 84, 80, 80), (v_mm4, v_off4, true, true, 77, 66, 84, 80, 86),
    (v_mm5, v_off6, true, true, 76, 60, 80, 80, 83), (v_mm6, v_off5, true, true, 82, 74, 84, 80, 91),
    (v_mm7, v_off7, true, true, 78, 68, 80, 80, 85), (v_mm8, v_off8, true, true, 73, 55, 80, 80, 81);

  insert into pricing_rules (market_id, rule_type, config) values
    (v_market_id, 'platform_fee', '{"mode":"percentage","value":9.0}'::jsonb),
    (v_market_id, 'delivery_tier', '{"base_fee":105,"free_miles":8,"per_mile":4.00}'::jsonb),
    (v_market_id, 'min_order_value', '{"amount":150}'::jsonb);

  insert into promotions (market_id, title, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active, material_catalog_id)
  values (v_market_id, 'Phoenix Desert Rock — 20% Off Pea Gravel', 'DESERT DEAL', true, 'percentage', 20, now(), now() + interval '10 days', true, v_pea_id);

  -- ================================================================
  -- DENVER
  -- ================================================================
  insert into markets (name, slug, state, is_active, center_lat, center_lng, timezone)
  values ('Denver', 'denver', 'CO', true, 39.7392, -104.9903, 'America/Denver')
  returning id into v_market_id;

  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Rocky Mountain Materials', 'rocky-mtn-mat', 'active', 'Jake Olson', '303-555-0601', 'manual')
  returning id into v_sup1_id;
  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Front Range Aggregate', 'front-range-agg', 'active', 'Maria Sanchez', '720-555-0602', 'manual')
  returning id into v_sup2_id;

  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup1_id, v_market_id, 'Rocky Mtn — Aurora', 'Aurora', 'CO', '80012', 45, true, true) returning id into v_yard1_id;
  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup2_id, v_market_id, 'Front Range — Lakewood', 'Lakewood', 'CO', '80226', 40, true, true) returning id into v_yard2_id;

  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard1_id, v_fill_id, 'ton', 15.00, 14, 14, '14-ton load', 110.00, 4.25, 45, true, true, true, 87, 'manual'),
    (v_yard1_id, v_select_id, 'ton', 22.50, 14, 14, '14-ton load', 110.00, 4.25, 45, true, true, true, 85, 'manual'),
    (v_yard1_id, v_topsoil_id, 'cubic_yard', 50.00, 5, 10, '10-yard load', 125.00, 4.75, 45, true, true, true, 80, 'manual'),
    (v_yard1_id, v_csand_id, 'ton', 21.00, 5, 12, '12-ton load', 100.00, 3.75, 45, true, true, true, 84, 'manual'),
    (v_yard1_id, v_flexbase_id, 'ton', 27.00, 14, 14, '14-ton load', 110.00, 4.00, 45, true, true, true, 89, 'manual');
  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard2_id, v_pea_id, 'ton', 36.00, 2, 14, '14-ton load', 108.00, 4.00, 40, true, true, true, 82, 'manual'),
    (v_yard2_id, v_roadbase_id, 'ton', 17.00, 14, 14, '14-ton load', 92.00, 3.25, 40, true, true, true, 85, 'manual'),
    (v_yard2_id, v_rr_id, 'ton', 46.00, 2, 12, '12-ton load', 112.00, 4.25, 40, true, true, true, 79, 'manual');

  select id into v_off1 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_fill_id;
  select id into v_off2 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_select_id;
  select id into v_off3 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_topsoil_id;
  select id into v_off4 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_csand_id;
  select id into v_off5 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_flexbase_id;
  select id into v_off6 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_pea_id;
  select id into v_off7 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_roadbase_id;
  select id into v_off8 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_rr_id;

  insert into market_materials (market_id, material_catalog_id, is_visible, is_available, is_featured, price_display_mode, sort_order) values
    (v_market_id, v_fill_id, true, true, true, 'exact', 1), (v_market_id, v_select_id, true, true, true, 'exact', 2),
    (v_market_id, v_topsoil_id, true, true, false, 'exact', 3), (v_market_id, v_csand_id, true, true, true, 'exact', 4),
    (v_market_id, v_pea_id, true, true, false, 'exact', 5), (v_market_id, v_flexbase_id, true, true, true, 'exact', 6),
    (v_market_id, v_roadbase_id, true, true, false, 'exact', 7), (v_market_id, v_rr_id, true, true, false, 'exact', 8);

  select id into v_mm1 from market_materials where market_id = v_market_id and material_catalog_id = v_fill_id;
  select id into v_mm2 from market_materials where market_id = v_market_id and material_catalog_id = v_select_id;
  select id into v_mm3 from market_materials where market_id = v_market_id and material_catalog_id = v_topsoil_id;
  select id into v_mm4 from market_materials where market_id = v_market_id and material_catalog_id = v_csand_id;
  select id into v_mm5 from market_materials where market_id = v_market_id and material_catalog_id = v_pea_id;
  select id into v_mm6 from market_materials where market_id = v_market_id and material_catalog_id = v_flexbase_id;
  select id into v_mm7 from market_materials where market_id = v_market_id and material_catalog_id = v_roadbase_id;
  select id into v_mm8 from market_materials where market_id = v_market_id and material_catalog_id = v_rr_id;

  insert into market_supply_pool (market_material_id, offering_id, is_preferred, is_active, composite_score, price_score, distance_score, reliability_score, availability_score) values
    (v_mm1, v_off1, true, true, 79, 70, 82, 78, 87), (v_mm2, v_off2, true, true, 77, 65, 82, 78, 85),
    (v_mm3, v_off3, true, true, 73, 56, 82, 78, 80), (v_mm4, v_off4, true, true, 76, 64, 82, 78, 84),
    (v_mm5, v_off6, true, true, 75, 60, 78, 78, 82), (v_mm6, v_off5, true, true, 80, 72, 82, 78, 89),
    (v_mm7, v_off7, true, true, 77, 66, 78, 78, 85), (v_mm8, v_off8, true, true, 72, 53, 78, 78, 79);

  insert into pricing_rules (market_id, rule_type, config) values
    (v_market_id, 'platform_fee', '{"mode":"percentage","value":9.0}'::jsonb),
    (v_market_id, 'delivery_tier', '{"base_fee":110,"free_miles":8,"per_mile":4.25}'::jsonb),
    (v_market_id, 'min_order_value', '{"amount":125}'::jsonb);

  insert into promotions (market_id, title, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active, material_catalog_id)
  values (v_market_id, 'Denver Flex Base Clearance — $5 Off', 'CLEARANCE', false, 'flat_amount', 5, now(), now() + interval '21 days', true, v_flexbase_id);

  -- ================================================================
  -- ATLANTA
  -- ================================================================
  insert into markets (name, slug, state, is_active, center_lat, center_lng, timezone)
  values ('Atlanta', 'atlanta', 'GA', true, 33.7490, -84.3880, 'America/New_York')
  returning id into v_market_id;

  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Peachtree Materials', 'peachtree-mat', 'active', 'James Wright', '404-555-0701', 'manual')
  returning id into v_sup1_id;
  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Southern Aggregate Co', 'southern-agg', 'active', 'Keisha Brown', '770-555-0702', 'manual')
  returning id into v_sup2_id;

  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup1_id, v_market_id, 'Peachtree — Marietta', 'Marietta', 'GA', '30060', 50, true, true) returning id into v_yard1_id;
  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup2_id, v_market_id, 'Southern — Decatur', 'Decatur', 'GA', '30030', 45, true, true) returning id into v_yard2_id;

  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard1_id, v_fill_id, 'ton', 13.50, 14, 14, '14-ton load', 98.00, 3.50, 50, true, true, true, 89, 'manual'),
    (v_yard1_id, v_select_id, 'ton', 19.50, 14, 14, '14-ton load', 98.00, 3.50, 50, true, true, true, 87, 'manual'),
    (v_yard1_id, v_topsoil_id, 'cubic_yard', 46.00, 5, 10, '10-yard load', 112.00, 4.00, 50, true, true, true, 83, 'manual'),
    (v_yard1_id, v_csand_id, 'ton', 19.00, 5, 12, '12-ton load', 92.00, 3.25, 50, true, true, true, 86, 'manual'),
    (v_yard1_id, v_flexbase_id, 'ton', 25.00, 14, 14, '14-ton load', 98.00, 3.50, 50, true, true, true, 90, 'manual');
  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard2_id, v_pea_id, 'ton', 34.00, 2, 14, '14-ton load', 100.00, 3.75, 45, true, true, true, 84, 'manual'),
    (v_yard2_id, v_roadbase_id, 'ton', 16.00, 14, 14, '14-ton load', 88.00, 3.00, 45, true, true, true, 87, 'manual'),
    (v_yard2_id, v_rr_id, 'ton', 44.00, 2, 12, '12-ton load', 108.00, 4.00, 45, true, true, true, 81, 'manual');

  select id into v_off1 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_fill_id;
  select id into v_off2 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_select_id;
  select id into v_off3 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_topsoil_id;
  select id into v_off4 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_csand_id;
  select id into v_off5 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_flexbase_id;
  select id into v_off6 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_pea_id;
  select id into v_off7 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_roadbase_id;
  select id into v_off8 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_rr_id;

  insert into market_materials (market_id, material_catalog_id, is_visible, is_available, is_featured, price_display_mode, sort_order) values
    (v_market_id, v_fill_id, true, true, true, 'exact', 1), (v_market_id, v_select_id, true, true, true, 'exact', 2),
    (v_market_id, v_topsoil_id, true, true, true, 'exact', 3), (v_market_id, v_csand_id, true, true, false, 'exact', 4),
    (v_market_id, v_pea_id, true, true, true, 'exact', 5), (v_market_id, v_flexbase_id, true, true, false, 'exact', 6),
    (v_market_id, v_roadbase_id, true, true, false, 'exact', 7), (v_market_id, v_rr_id, true, true, false, 'exact', 8);

  select id into v_mm1 from market_materials where market_id = v_market_id and material_catalog_id = v_fill_id;
  select id into v_mm2 from market_materials where market_id = v_market_id and material_catalog_id = v_select_id;
  select id into v_mm3 from market_materials where market_id = v_market_id and material_catalog_id = v_topsoil_id;
  select id into v_mm4 from market_materials where market_id = v_market_id and material_catalog_id = v_csand_id;
  select id into v_mm5 from market_materials where market_id = v_market_id and material_catalog_id = v_pea_id;
  select id into v_mm6 from market_materials where market_id = v_market_id and material_catalog_id = v_flexbase_id;
  select id into v_mm7 from market_materials where market_id = v_market_id and material_catalog_id = v_roadbase_id;
  select id into v_mm8 from market_materials where market_id = v_market_id and material_catalog_id = v_rr_id;

  insert into market_supply_pool (market_material_id, offering_id, is_preferred, is_active, composite_score, price_score, distance_score, reliability_score, availability_score) values
    (v_mm1, v_off1, true, true, 81, 76, 83, 77, 89), (v_mm2, v_off2, true, true, 79, 70, 83, 77, 87),
    (v_mm3, v_off3, true, true, 76, 62, 83, 77, 83), (v_mm4, v_off4, true, true, 78, 68, 83, 77, 86),
    (v_mm5, v_off6, true, true, 77, 64, 80, 77, 84), (v_mm6, v_off5, true, true, 82, 76, 83, 77, 90),
    (v_mm7, v_off7, true, true, 78, 70, 80, 77, 87), (v_mm8, v_off8, true, true, 74, 58, 80, 77, 81);

  insert into pricing_rules (market_id, rule_type, config) values
    (v_market_id, 'platform_fee', '{"mode":"percentage","value":9.0}'::jsonb),
    (v_market_id, 'delivery_tier', '{"base_fee":98,"free_miles":10,"per_mile":3.50}'::jsonb),
    (v_market_id, 'min_order_value', '{"amount":100}'::jsonb);

  insert into promotions (market_id, title, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active, material_catalog_id)
  values (v_market_id, 'ATL Topsoil Season Opener — 12% Off', 'SEASON DEAL', true, 'percentage', 12, now(), now() + interval '18 days', true, v_topsoil_id);

  -- ================================================================
  -- NASHVILLE
  -- ================================================================
  insert into markets (name, slug, state, is_active, center_lat, center_lng, timezone)
  values ('Nashville', 'nashville', 'TN', true, 36.1627, -86.7816, 'America/Chicago')
  returning id into v_market_id;

  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Music City Materials', 'music-city-mat', 'active', 'Tyler Nash', '615-555-0801', 'manual')
  returning id into v_sup1_id;
  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Cumberland Gravel', 'cumberland-gravel', 'active', 'Beth Young', '615-555-0802', 'manual')
  returning id into v_sup2_id;

  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup1_id, v_market_id, 'Music City — Murfreesboro', 'Murfreesboro', 'TN', '37127', 45, true, true) returning id into v_yard1_id;
  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup2_id, v_market_id, 'Cumberland — Hendersonville', 'Hendersonville', 'TN', '37075', 40, true, true) returning id into v_yard2_id;

  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard1_id, v_fill_id, 'ton', 12.50, 14, 14, '14-ton load', 95.00, 3.50, 45, true, true, true, 90, 'manual'),
    (v_yard1_id, v_select_id, 'ton', 19.00, 14, 14, '14-ton load', 95.00, 3.50, 45, true, true, true, 88, 'manual'),
    (v_yard1_id, v_topsoil_id, 'cubic_yard', 44.00, 5, 10, '10-yard load', 108.00, 3.75, 45, true, true, true, 84, 'manual'),
    (v_yard1_id, v_csand_id, 'ton', 18.50, 5, 12, '12-ton load', 90.00, 3.25, 45, true, true, true, 87, 'manual'),
    (v_yard1_id, v_flexbase_id, 'ton', 24.50, 14, 14, '14-ton load', 95.00, 3.50, 45, true, true, true, 91, 'manual');
  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard2_id, v_pea_id, 'ton', 34.50, 2, 14, '14-ton load', 100.00, 3.75, 40, true, true, true, 85, 'manual'),
    (v_yard2_id, v_roadbase_id, 'ton', 15.50, 14, 14, '14-ton load', 85.00, 3.00, 40, true, true, true, 88, 'manual'),
    (v_yard2_id, v_rr_id, 'ton', 43.00, 2, 12, '12-ton load', 105.00, 3.75, 40, true, true, true, 82, 'manual');

  select id into v_off1 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_fill_id;
  select id into v_off2 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_select_id;
  select id into v_off3 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_topsoil_id;
  select id into v_off4 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_csand_id;
  select id into v_off5 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_flexbase_id;
  select id into v_off6 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_pea_id;
  select id into v_off7 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_roadbase_id;
  select id into v_off8 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_rr_id;

  insert into market_materials (market_id, material_catalog_id, is_visible, is_available, is_featured, price_display_mode, sort_order) values
    (v_market_id, v_fill_id, true, true, true, 'exact', 1), (v_market_id, v_select_id, true, true, false, 'exact', 2),
    (v_market_id, v_topsoil_id, true, true, true, 'exact', 3), (v_market_id, v_csand_id, true, true, false, 'exact', 4),
    (v_market_id, v_pea_id, true, true, true, 'exact', 5), (v_market_id, v_flexbase_id, true, true, true, 'exact', 6),
    (v_market_id, v_roadbase_id, true, true, false, 'exact', 7), (v_market_id, v_rr_id, true, true, false, 'exact', 8);

  select id into v_mm1 from market_materials where market_id = v_market_id and material_catalog_id = v_fill_id;
  select id into v_mm2 from market_materials where market_id = v_market_id and material_catalog_id = v_select_id;
  select id into v_mm3 from market_materials where market_id = v_market_id and material_catalog_id = v_topsoil_id;
  select id into v_mm4 from market_materials where market_id = v_market_id and material_catalog_id = v_csand_id;
  select id into v_mm5 from market_materials where market_id = v_market_id and material_catalog_id = v_pea_id;
  select id into v_mm6 from market_materials where market_id = v_market_id and material_catalog_id = v_flexbase_id;
  select id into v_mm7 from market_materials where market_id = v_market_id and material_catalog_id = v_roadbase_id;
  select id into v_mm8 from market_materials where market_id = v_market_id and material_catalog_id = v_rr_id;

  insert into market_supply_pool (market_material_id, offering_id, is_preferred, is_active, composite_score, price_score, distance_score, reliability_score, availability_score) values
    (v_mm1, v_off1, true, true, 82, 78, 84, 77, 90), (v_mm2, v_off2, true, true, 80, 70, 84, 77, 88),
    (v_mm3, v_off3, true, true, 76, 62, 84, 77, 84), (v_mm4, v_off4, true, true, 79, 70, 84, 77, 87),
    (v_mm5, v_off6, true, true, 77, 64, 80, 77, 85), (v_mm6, v_off5, true, true, 83, 78, 84, 77, 91),
    (v_mm7, v_off7, true, true, 79, 72, 80, 77, 88), (v_mm8, v_off8, true, true, 75, 60, 80, 77, 82);

  insert into pricing_rules (market_id, rule_type, config) values
    (v_market_id, 'platform_fee', '{"mode":"percentage","value":9.0}'::jsonb),
    (v_market_id, 'delivery_tier', '{"base_fee":95,"free_miles":10,"per_mile":3.50}'::jsonb),
    (v_market_id, 'min_order_value', '{"amount":100}'::jsonb);

  -- ================================================================
  -- CHARLOTTE
  -- ================================================================
  insert into markets (name, slug, state, is_active, center_lat, center_lng, timezone)
  values ('Charlotte', 'charlotte', 'NC', true, 35.2271, -80.8431, 'America/New_York')
  returning id into v_market_id;

  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Carolina Earth Works', 'carolina-earth', 'active', 'Dwayne Harris', '704-555-0901', 'manual')
  returning id into v_sup1_id;
  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Piedmont Aggregate', 'piedmont-agg', 'active', 'Rachel Adams', '980-555-0902', 'manual')
  returning id into v_sup2_id;

  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup1_id, v_market_id, 'Carolina — Concord', 'Concord', 'NC', '28025', 45, true, true) returning id into v_yard1_id;
  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup2_id, v_market_id, 'Piedmont — Gastonia', 'Gastonia', 'NC', '28052', 40, true, true) returning id into v_yard2_id;

  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard1_id, v_fill_id, 'ton', 11.50, 14, 14, '14-ton load', 92.00, 3.25, 45, true, true, true, 91, 'manual'),
    (v_yard1_id, v_select_id, 'ton', 17.50, 14, 14, '14-ton load', 92.00, 3.25, 45, true, true, true, 89, 'manual'),
    (v_yard1_id, v_topsoil_id, 'cubic_yard', 43.00, 5, 10, '10-yard load', 105.00, 3.75, 45, true, true, true, 85, 'manual'),
    (v_yard1_id, v_csand_id, 'ton', 18.00, 5, 12, '12-ton load', 88.00, 3.00, 45, true, true, true, 88, 'manual'),
    (v_yard1_id, v_flexbase_id, 'ton', 23.00, 14, 14, '14-ton load', 92.00, 3.25, 45, true, true, true, 92, 'manual');
  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard2_id, v_pea_id, 'ton', 33.00, 2, 14, '14-ton load', 96.00, 3.50, 40, true, true, true, 86, 'manual'),
    (v_yard2_id, v_roadbase_id, 'ton', 14.50, 14, 14, '14-ton load', 84.00, 2.75, 40, true, true, true, 89, 'manual'),
    (v_yard2_id, v_rr_id, 'ton', 41.00, 2, 12, '12-ton load', 102.00, 3.75, 40, true, true, true, 83, 'manual');

  select id into v_off1 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_fill_id;
  select id into v_off2 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_select_id;
  select id into v_off3 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_topsoil_id;
  select id into v_off4 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_csand_id;
  select id into v_off5 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_flexbase_id;
  select id into v_off6 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_pea_id;
  select id into v_off7 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_roadbase_id;
  select id into v_off8 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_rr_id;

  insert into market_materials (market_id, material_catalog_id, is_visible, is_available, is_featured, price_display_mode, sort_order) values
    (v_market_id, v_fill_id, true, true, true, 'exact', 1), (v_market_id, v_select_id, true, true, true, 'exact', 2),
    (v_market_id, v_topsoil_id, true, true, false, 'exact', 3), (v_market_id, v_csand_id, true, true, true, 'exact', 4),
    (v_market_id, v_pea_id, true, true, true, 'exact', 5), (v_market_id, v_flexbase_id, true, true, false, 'exact', 6),
    (v_market_id, v_roadbase_id, true, true, false, 'exact', 7), (v_market_id, v_rr_id, true, true, false, 'exact', 8);

  select id into v_mm1 from market_materials where market_id = v_market_id and material_catalog_id = v_fill_id;
  select id into v_mm2 from market_materials where market_id = v_market_id and material_catalog_id = v_select_id;
  select id into v_mm3 from market_materials where market_id = v_market_id and material_catalog_id = v_topsoil_id;
  select id into v_mm4 from market_materials where market_id = v_market_id and material_catalog_id = v_csand_id;
  select id into v_mm5 from market_materials where market_id = v_market_id and material_catalog_id = v_pea_id;
  select id into v_mm6 from market_materials where market_id = v_market_id and material_catalog_id = v_flexbase_id;
  select id into v_mm7 from market_materials where market_id = v_market_id and material_catalog_id = v_roadbase_id;
  select id into v_mm8 from market_materials where market_id = v_market_id and material_catalog_id = v_rr_id;

  insert into market_supply_pool (market_material_id, offering_id, is_preferred, is_active, composite_score, price_score, distance_score, reliability_score, availability_score) values
    (v_mm1, v_off1, true, true, 84, 82, 85, 78, 91), (v_mm2, v_off2, true, true, 81, 74, 85, 78, 89),
    (v_mm3, v_off3, true, true, 77, 64, 85, 78, 85), (v_mm4, v_off4, true, true, 80, 72, 85, 78, 88),
    (v_mm5, v_off6, true, true, 78, 66, 82, 78, 86), (v_mm6, v_off5, true, true, 83, 78, 85, 78, 92),
    (v_mm7, v_off7, true, true, 80, 74, 82, 78, 89), (v_mm8, v_off8, true, true, 76, 62, 82, 78, 83);

  insert into pricing_rules (market_id, rule_type, config) values
    (v_market_id, 'platform_fee', '{"mode":"percentage","value":9.0}'::jsonb),
    (v_market_id, 'delivery_tier', '{"base_fee":92,"free_miles":10,"per_mile":3.25}'::jsonb),
    (v_market_id, 'min_order_value', '{"amount":100}'::jsonb);

  insert into promotions (market_id, title, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active, material_catalog_id)
  values (v_market_id, 'Charlotte Road Base — Contractor Special $3 Off', 'PRO DEAL', false, 'flat_amount', 3, now(), now() + interval '30 days', true, v_roadbase_id);

  -- ================================================================
  -- TAMPA
  -- ================================================================
  insert into markets (name, slug, state, is_active, center_lat, center_lng, timezone)
  values ('Tampa', 'tampa', 'FL', true, 27.9506, -82.4572, 'America/New_York')
  returning id into v_market_id;

  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Sunshine State Materials', 'sunshine-state', 'active', 'Diego Ruiz', '813-555-1001', 'manual')
  returning id into v_sup1_id;
  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Bay Area Aggregate FL', 'bay-area-agg-fl', 'active', 'Tammy Lee', '727-555-1002', 'manual')
  returning id into v_sup2_id;

  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup1_id, v_market_id, 'Sunshine — Brandon', 'Brandon', 'FL', '33510', 50, true, true) returning id into v_yard1_id;
  insert into supply_yards (supplier_id, market_id, name, city, state, zip, delivery_radius_miles, delivery_enabled, is_active)
  values (v_sup2_id, v_market_id, 'Bay Area — Clearwater', 'Clearwater', 'FL', '33755', 45, true, true) returning id into v_yard2_id;

  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard1_id, v_fill_id, 'ton', 12.00, 14, 14, '14-ton load', 95.00, 3.50, 50, true, true, true, 90, 'manual'),
    (v_yard1_id, v_select_id, 'ton', 18.00, 14, 14, '14-ton load', 95.00, 3.50, 50, true, true, true, 88, 'manual'),
    (v_yard1_id, v_topsoil_id, 'cubic_yard', 44.00, 5, 10, '10-yard load', 110.00, 4.00, 50, true, true, true, 83, 'manual'),
    (v_yard1_id, v_csand_id, 'ton', 19.50, 5, 12, '12-ton load', 90.00, 3.25, 50, true, true, true, 86, 'manual'),
    (v_yard1_id, v_flexbase_id, 'ton', 25.50, 14, 14, '14-ton load', 95.00, 3.50, 50, true, true, true, 91, 'manual');
  insert into supplier_offerings (supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity, typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile, max_delivery_miles, is_available, available_for_delivery, is_public, availability_confidence, data_source) values
    (v_yard2_id, v_pea_id, 'ton', 35.00, 2, 14, '14-ton load', 102.00, 3.75, 45, true, true, true, 84, 'manual'),
    (v_yard2_id, v_roadbase_id, 'ton', 16.50, 14, 14, '14-ton load', 88.00, 3.00, 45, true, true, true, 87, 'manual'),
    (v_yard2_id, v_rr_id, 'ton', 42.00, 2, 12, '12-ton load', 106.00, 4.00, 45, true, true, true, 82, 'manual');

  select id into v_off1 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_fill_id;
  select id into v_off2 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_select_id;
  select id into v_off3 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_topsoil_id;
  select id into v_off4 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_csand_id;
  select id into v_off5 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_flexbase_id;
  select id into v_off6 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_pea_id;
  select id into v_off7 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_roadbase_id;
  select id into v_off8 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_rr_id;

  insert into market_materials (market_id, material_catalog_id, is_visible, is_available, is_featured, price_display_mode, sort_order) values
    (v_market_id, v_fill_id, true, true, true, 'exact', 1), (v_market_id, v_select_id, true, true, true, 'exact', 2),
    (v_market_id, v_topsoil_id, true, true, true, 'exact', 3), (v_market_id, v_csand_id, true, true, false, 'exact', 4),
    (v_market_id, v_pea_id, true, true, false, 'exact', 5), (v_market_id, v_flexbase_id, true, true, true, 'exact', 6),
    (v_market_id, v_roadbase_id, true, true, false, 'exact', 7), (v_market_id, v_rr_id, true, true, false, 'exact', 8);

  select id into v_mm1 from market_materials where market_id = v_market_id and material_catalog_id = v_fill_id;
  select id into v_mm2 from market_materials where market_id = v_market_id and material_catalog_id = v_select_id;
  select id into v_mm3 from market_materials where market_id = v_market_id and material_catalog_id = v_topsoil_id;
  select id into v_mm4 from market_materials where market_id = v_market_id and material_catalog_id = v_csand_id;
  select id into v_mm5 from market_materials where market_id = v_market_id and material_catalog_id = v_pea_id;
  select id into v_mm6 from market_materials where market_id = v_market_id and material_catalog_id = v_flexbase_id;
  select id into v_mm7 from market_materials where market_id = v_market_id and material_catalog_id = v_roadbase_id;
  select id into v_mm8 from market_materials where market_id = v_market_id and material_catalog_id = v_rr_id;

  insert into market_supply_pool (market_material_id, offering_id, is_preferred, is_active, composite_score, price_score, distance_score, reliability_score, availability_score) values
    (v_mm1, v_off1, true, true, 82, 78, 84, 78, 90), (v_mm2, v_off2, true, true, 80, 72, 84, 78, 88),
    (v_mm3, v_off3, true, true, 76, 62, 84, 78, 83), (v_mm4, v_off4, true, true, 78, 68, 84, 78, 86),
    (v_mm5, v_off6, true, true, 77, 64, 80, 78, 84), (v_mm6, v_off5, true, true, 83, 78, 84, 78, 91),
    (v_mm7, v_off7, true, true, 79, 70, 80, 78, 87), (v_mm8, v_off8, true, true, 75, 60, 80, 78, 82);

  insert into pricing_rules (market_id, rule_type, config) values
    (v_market_id, 'platform_fee', '{"mode":"percentage","value":9.0}'::jsonb),
    (v_market_id, 'delivery_tier', '{"base_fee":95,"free_miles":10,"per_mile":3.50}'::jsonb),
    (v_market_id, 'min_order_value', '{"amount":100}'::jsonb);

  insert into promotions (market_id, title, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active, material_catalog_id)
  values (v_market_id, 'Tampa Topsoil — Weekend Blowout 18% Off', 'WEEKEND DEAL', true, 'percentage', 18, now(), now() + interval '7 days', true, v_topsoil_id);

  -- ================================================================
  -- DFW DEAL (add a deal to the existing DFW market)
  -- ================================================================
  insert into promotions (market_id, title, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active, material_catalog_id)
  values (
    (select id from markets where slug = 'dallas-fort-worth'),
    'DFW Fill Dirt — Contractor Week 10% Off', 'CONTRACTOR WEEK', true, 'percentage', 10,
    now(), now() + interval '14 days', true, v_fill_id
  );

  raise notice 'Seeded 9 new markets (10 total), 18 new suppliers, 18 new yards, 72 new offerings, 72 new market materials, 72 new pool entries, 9 promotions + 1 DFW deal.';
end;
$$;
