-- 018: Launch promotions for 5 new markets
-- Pattern: each market gets a Deal of the Day, 2 Flash Sales, 2 Contractor Deals,
-- 2 Weekend Only specials, and 1 market-specific headline promo.

DO $$
DECLARE
  mkt RECORD;
  mc_fill UUID := 'ba7d5c6c-4595-4a3d-ac94-45f0b2003efa';
  mc_select UUID := '50069494-8f57-4f1c-8276-5d0847d6f9d4';
  mc_topsoil UUID := '5914c3ff-a3f9-45f6-8080-edccc1fd7396';
  mc_csand UUID := '6f05aa89-34f3-4ca5-898e-fba6e3ce4c55';
  mc_msand UUID := '0432f60f-9c40-4a90-823d-2f8913e979db';
  mc_usand UUID := 'f52bddd0-5b4a-48ed-8d17-1b05add79a0c';
  mc_pgravel UUID := '37473f74-b830-47dc-84a0-a12e2ca58045';
  mc_bgravel UUID := 'c07074ee-69be-4383-b1ee-f3957fea7ac1';
  mc_flexbase UUID := 'c6ec2458-99a2-45cd-8af4-43d58d87a9e0';
  mc_roadbase UUID := '00b032d1-f6b4-406f-bdad-6da3869f7241';
  mc_dg UUID := '1d712dbe-1701-44fb-9858-96a72e12f06f';
  mc_crushed UUID := 'ea3e57cb-a8eb-41d5-9c26-143517c57dcf';
  headline_titles JSONB := '{
    "orlando": "Orlando Launch Week — Fill Dirt 15% Off",
    "las-vegas": "Vegas Launch Special — Crushed Concrete 20% Off",
    "raleigh": "Raleigh Launch Week — Road Base $3 Off/Ton",
    "salt-lake-city": "SLC Grand Opening — Flex Base 15% Off",
    "boise": "Boise Launch Special — Fill Dirt $4 Off/Ton"
  }'::JSONB;
  headline_badges JSONB := '{
    "orlando": "LAUNCH WEEK",
    "las-vegas": "LAUNCH SPECIAL",
    "raleigh": "LAUNCH WEEK",
    "salt-lake-city": "GRAND OPENING",
    "boise": "LAUNCH SPECIAL"
  }'::JSONB;
BEGIN
  FOR mkt IN
    SELECT id, slug FROM markets WHERE slug IN ('orlando','las-vegas','raleigh','salt-lake-city','boise')
  LOOP
    -- Deal of the Day: Fill Dirt 25% off
    INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active)
    VALUES (mkt.id, mc_fill, 'Deal of the Day: Fill Dirt', 'Save 25% on fill dirt delivery today only', 'DEAL OF THE DAY', true, 'percentage', 25, NOW(), NOW() + interval '90 days', true);

    -- Flash Sale: Select Fill $8 off
    INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active)
    VALUES (mkt.id, mc_select, 'Flash Sale: Select Fill', 'Limited time — $8 off per ton', 'FLASH SALE', false, 'flat_amount', 8, NOW(), NOW() + interval '30 days', true);

    -- Flash Sale: Topsoil $12 off
    INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active)
    VALUES (mkt.id, mc_topsoil, 'Flash Sale: Topsoil', 'Limited time — $12 off per ton', 'FLASH SALE', false, 'flat_amount', 12, NOW(), NOW() + interval '30 days', true);

    -- Contractor Deal: Concrete Sand 15% off
    INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active)
    VALUES (mkt.id, mc_csand, 'Contractor Deal: Concrete Sand', '15% off for contractors — bulk orders welcome', 'CONTRACTOR', false, 'percentage', 15, NOW(), NOW() + interval '60 days', true);

    -- Contractor Deal: Masonry Sand 20% off
    INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active)
    VALUES (mkt.id, mc_msand, 'Contractor Deal: Masonry Sand', '20% off masonry sand for pros', 'CONTRACTOR', false, 'percentage', 20, NOW(), NOW() + interval '60 days', true);

    -- Weekend Only: Utility Sand (price override)
    INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, override_price, starts_at, ends_at, is_active)
    VALUES (mkt.id, mc_usand, 'Weekend Only: Utility Sand', 'Special weekend pricing', 'WEEKEND ONLY', false, 'price_override', 11.50, NOW(), NOW() + interval '90 days', true);

    -- Weekend Only: Pea Gravel (price override)
    INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, override_price, starts_at, ends_at, is_active)
    VALUES (mkt.id, mc_pgravel, 'Weekend Only: Pea Gravel', 'Special weekend pricing', 'WEEKEND ONLY', false, 'price_override', 24.00, NOW(), NOW() + interval '90 days', true);

    -- Market-specific headline promo
    IF mkt.slug = 'orlando' THEN
      INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active)
      VALUES (mkt.id, mc_fill, headline_titles ->> mkt.slug, 'Celebrate our Orlando launch — limited time offer', headline_badges ->> mkt.slug, true, 'percentage', 15, NOW(), NOW() + interval '14 days', true);
    ELSIF mkt.slug = 'las-vegas' THEN
      INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active)
      VALUES (mkt.id, mc_crushed, headline_titles ->> mkt.slug, 'Celebrate our Las Vegas launch — limited time offer', headline_badges ->> mkt.slug, true, 'percentage', 20, NOW(), NOW() + interval '14 days', true);
    ELSIF mkt.slug = 'raleigh' THEN
      INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active)
      VALUES (mkt.id, mc_roadbase, headline_titles ->> mkt.slug, 'Celebrate our Raleigh launch — limited time offer', headline_badges ->> mkt.slug, false, 'flat_amount', 3, NOW(), NOW() + interval '14 days', true);
    ELSIF mkt.slug = 'salt-lake-city' THEN
      INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active)
      VALUES (mkt.id, mc_flexbase, headline_titles ->> mkt.slug, 'Celebrate our Salt Lake City launch — limited time offer', headline_badges ->> mkt.slug, true, 'percentage', 15, NOW(), NOW() + interval '14 days', true);
    ELSIF mkt.slug = 'boise' THEN
      INSERT INTO promotions (market_id, material_catalog_id, title, description, badge_label, is_deal_of_day, promotion_type, discount_value, starts_at, ends_at, is_active)
      VALUES (mkt.id, mc_fill, headline_titles ->> mkt.slug, 'Celebrate our Boise launch — limited time offer', headline_badges ->> mkt.slug, false, 'flat_amount', 4, NOW(), NOW() + interval '14 days', true);
    END IF;
  END LOOP;
END;
$$;
