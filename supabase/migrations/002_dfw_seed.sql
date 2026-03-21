-- ============================================================
-- AGGREGATEMARKET — DFW Seed Data
-- Run AFTER 001_schema.sql
-- Creates 2 suppliers, 2 yards, 8 offerings, 8 market_materials
-- all wired up and ready for customer browsing.
-- ============================================================

do $$
declare
  -- Market
  v_dfw_id        uuid;

  -- Suppliers
  v_sup1_id       uuid;
  v_sup2_id       uuid;

  -- Yards
  v_yard1_id      uuid;
  v_yard2_id      uuid;

  -- Catalog IDs
  v_fill_id       uuid;
  v_select_id     uuid;
  v_topsoil_id    uuid;
  v_csand_id      uuid;
  v_pea_id        uuid;
  v_flexbase_id   uuid;
  v_roadbase_id   uuid;
  v_rr_id         uuid;

  -- Offering IDs
  v_off_fill1     uuid;
  v_off_select1   uuid;
  v_off_topsoil1  uuid;
  v_off_csand1    uuid;
  v_off_pea1      uuid;
  v_off_flexbase1 uuid;
  v_off_roadbase2 uuid;
  v_off_rr2       uuid;

  -- Market material IDs
  v_mm_fill       uuid;
  v_mm_select     uuid;
  v_mm_topsoil    uuid;
  v_mm_csand      uuid;
  v_mm_pea        uuid;
  v_mm_flexbase   uuid;
  v_mm_roadbase   uuid;
  v_mm_rr         uuid;

begin
  -- Resolve market
  select id into v_dfw_id from markets where slug = 'dallas-fort-worth';
  if v_dfw_id is null then
    raise exception 'DFW market not found. Run 001_schema.sql first.';
  end if;

  -- Resolve catalog IDs
  select id into v_fill_id     from material_catalog where slug = 'fill-dirt';
  select id into v_select_id   from material_catalog where slug = 'select-fill';
  select id into v_topsoil_id  from material_catalog where slug = 'topsoil';
  select id into v_csand_id    from material_catalog where slug = 'concrete-sand';
  select id into v_pea_id      from material_catalog where slug = 'pea-gravel';
  select id into v_flexbase_id from material_catalog where slug = 'flex-base';
  select id into v_roadbase_id from material_catalog where slug = 'road-base';
  select id into v_rr_id       from material_catalog where slug = 'washed-river-rock';

  -- ── SUPPLIER 1 ──
  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('DFW Dirt & Materials', 'dfw-dirt-materials', 'active', 'Operations Team', '817-555-0100', 'manual')
  returning id into v_sup1_id;

  -- Yard 1
  insert into supply_yards (
    supplier_id, market_id, name, address_line_1, city, state, zip,
    phone, delivery_radius_miles, delivery_enabled, is_active
  ) values (
    v_sup1_id, v_dfw_id,
    'DFW Dirt — Grand Prairie', '4200 W Pioneer Pkwy', 'Grand Prairie', 'TX', '75052',
    '817-555-0100', 60, true, true
  ) returning id into v_yard1_id;

  -- Offerings from yard 1
  insert into supplier_offerings (
    supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity,
    typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile,
    max_delivery_miles, is_available, available_for_delivery, is_public,
    availability_confidence, data_source
  ) values
    (v_yard1_id, v_fill_id,    'ton', 12.00, 14, 14, '14-ton load', 95.00, 3.50, 60, true, true, true, 90, 'manual'),
    (v_yard1_id, v_select_id,  'ton', 18.50, 14, 14, '14-ton load', 95.00, 3.50, 60, true, true, true, 90, 'manual'),
    (v_yard1_id, v_topsoil_id, 'cubic_yard', 45.00, 5, 10, '10-yard load', 110.00, 4.00, 60, true, true, true, 85, 'manual'),
    (v_yard1_id, v_csand_id,   'ton', 19.00, 5, 12, '12-ton load', 90.00, 3.25, 60, true, true, true, 88, 'manual'),
    (v_yard1_id, v_flexbase_id,'ton', 24.00, 14, 14, '14-ton load', 95.00, 3.25, 60, true, true, true, 92, 'manual');
  -- NOTE: PostgreSQL doesn't support RETURNING into multiple vars from multi-row insert
  -- We'll query back by supply_yard_id + material_catalog_id

  select id into v_off_fill1     from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_fill_id;
  select id into v_off_select1   from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_select_id;
  select id into v_off_topsoil1  from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_topsoil_id;
  select id into v_off_csand1    from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_csand_id;
  select id into v_off_flexbase1 from supplier_offerings where supply_yard_id = v_yard1_id and material_catalog_id = v_flexbase_id;

  -- ── SUPPLIER 2 ──
  insert into suppliers (name, slug, status, primary_contact_name, primary_contact_phone, data_source)
  values ('Lone Star Aggregate', 'lone-star-aggregate', 'active', 'Sales', '972-555-0200', 'manual')
  returning id into v_sup2_id;

  -- Yard 2
  insert into supply_yards (
    supplier_id, market_id, name, address_line_1, city, state, zip,
    phone, delivery_radius_miles, delivery_enabled, is_active
  ) values (
    v_sup2_id, v_dfw_id,
    'Lone Star — Mesquite', '1800 N Galloway Ave', 'Mesquite', 'TX', '75149',
    '972-555-0200', 50, true, true
  ) returning id into v_yard2_id;

  -- Offerings from yard 2
  insert into supplier_offerings (
    supply_yard_id, material_catalog_id, unit, price_per_unit, minimum_order_quantity,
    typical_load_size, load_size_label, delivery_fee_base, delivery_fee_per_mile,
    max_delivery_miles, is_available, available_for_delivery, is_public,
    availability_confidence, data_source
  ) values
    (v_yard2_id, v_pea_id,      'ton', 35.00, 2, 14, '14-ton load', 100.00, 3.75, 50, true, true, true, 85, 'manual'),
    (v_yard2_id, v_roadbase_id, 'ton', 16.00, 14, 14, '14-ton load', 85.00, 3.00, 50, true, true, true, 87, 'manual'),
    (v_yard2_id, v_rr_id,       'ton', 42.00, 2, 12, '12-ton load', 105.00, 4.00, 50, true, true, true, 82, 'manual');

  select id into v_off_pea1      from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_pea_id;
  select id into v_off_roadbase2 from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_roadbase_id;
  select id into v_off_rr2       from supplier_offerings where supply_yard_id = v_yard2_id and material_catalog_id = v_rr_id;

  -- ── MARKET MATERIALS ──
  -- One per canonical material — controls customer-facing catalog
  insert into market_materials (
    market_id, material_catalog_id, is_visible, is_available, is_featured,
    price_display_mode, sort_order
  ) values
    (v_dfw_id, v_fill_id,    true, true, true,  'exact', 1),
    (v_dfw_id, v_select_id,  true, true, true,  'exact', 2),
    (v_dfw_id, v_topsoil_id, true, true, false, 'exact', 3),
    (v_dfw_id, v_csand_id,   true, true, false, 'exact', 4),
    (v_dfw_id, v_pea_id,     true, true, true,  'exact', 5),
    (v_dfw_id, v_flexbase_id,true, true, true,  'exact', 6),
    (v_dfw_id, v_roadbase_id,true, true, false, 'exact', 7),
    (v_dfw_id, v_rr_id,      true, true, false, 'exact', 8);

  select id into v_mm_fill     from market_materials where market_id = v_dfw_id and material_catalog_id = v_fill_id;
  select id into v_mm_select   from market_materials where market_id = v_dfw_id and material_catalog_id = v_select_id;
  select id into v_mm_topsoil  from market_materials where market_id = v_dfw_id and material_catalog_id = v_topsoil_id;
  select id into v_mm_csand    from market_materials where market_id = v_dfw_id and material_catalog_id = v_csand_id;
  select id into v_mm_pea      from market_materials where market_id = v_dfw_id and material_catalog_id = v_pea_id;
  select id into v_mm_flexbase from market_materials where market_id = v_dfw_id and material_catalog_id = v_flexbase_id;
  select id into v_mm_roadbase from market_materials where market_id = v_dfw_id and material_catalog_id = v_roadbase_id;
  select id into v_mm_rr       from market_materials where market_id = v_dfw_id and material_catalog_id = v_rr_id;

  -- ── SUPPLY POOL ──
  -- Wire preferred offerings to market materials
  -- NOTE: trigger validates market + material match, so order matters
  insert into market_supply_pool (
    market_material_id, offering_id, is_preferred, is_active,
    composite_score, price_score, distance_score, reliability_score, availability_score
  ) values
    (v_mm_fill,     v_off_fill1,     true,  true, 80, 75, 85, 75, 90),
    (v_mm_select,   v_off_select1,   true,  true, 80, 70, 85, 75, 90),
    (v_mm_topsoil,  v_off_topsoil1,  true,  true, 78, 68, 85, 75, 85),
    (v_mm_csand,    v_off_csand1,    true,  true, 79, 72, 85, 75, 88),
    (v_mm_pea,      v_off_pea1,      true,  true, 77, 65, 80, 75, 85),
    (v_mm_flexbase, v_off_flexbase1, true,  true, 82, 75, 85, 75, 92),
    (v_mm_roadbase, v_off_roadbase2, true,  true, 76, 70, 80, 75, 87),
    (v_mm_rr,       v_off_rr2,       true,  true, 75, 62, 80, 75, 82);

  raise notice 'DFW seed complete: 2 suppliers, 2 yards, 8 offerings, 8 market materials, 8 pool entries.';
end;
$$;
