-- ============================================================================
-- 119_disable_scraped_offerings_backfill_market_materials
-- Applied to prod via MCP at 2026-05-02 23:39:38 UTC.
--
-- BUG 1: 'scraped' offerings (placeholder yard names like "Thornton Yard",
--        random ZIPs, fabricated coords) were is_public=true and clogging
--        resolveOffering. Resolver picked synthetic yards with bogus coords,
--        zip_to_yard_miles RPC returned NULL, haversine fallback fired
--        constantly with garbage data.
--        FIX: soft-disable data_source='scraped' (485 rows).
--
-- BUG 2: 5 of 14 real (market, material) pairs missing from market_materials,
--        causing MARKET_MATERIAL_NOT_FOUND for those materials.
--        FIX: backfill the 5 missing pairs.
--
-- 'scraped' data preserved with is_public=false. Reversible.
-- ============================================================================

UPDATE supplier_offerings
SET is_public = false, updated_at = now()
WHERE data_source = 'scraped' AND is_public = true;

INSERT INTO market_materials (
  market_id, material_catalog_id, is_visible, is_available, is_featured,
  sort_order, price_display_mode, admin_notes, last_reviewed_at, created_at, updated_at
) VALUES
  ('a9f89572-50c3-4a59-bbdf-78219c5199d6', 'df7654e4-ffe7-4041-8c51-73e5299fce15',
   true, true, true, 10, 'exact',
   'Backfilled 2026-05-02 — Verdego Cushion Sand mapped to Bedding Sand catalog row.', now(), now(), now()),
  ('a9f89572-50c3-4a59-bbdf-78219c5199d6', '7b0cee52-a89a-4601-98b9-f027c809e529',
   true, true, true, 10, 'exact',
   'Backfilled 2026-05-02 — Silver Creek $89/yd + 20% markup.', now(), now(), now()),
  ('24ea7f05-50ce-4363-9ad1-97a699389a90', '068c70b3-d762-4543-b156-eeb368ac3b72',
   true, true, true, 10, 'exact',
   'Backfilled 2026-05-02 — Brannan Pit 14 + CAR Foothills + 20% markup.', now(), now(), now()),
  ('24ea7f05-50ce-4363-9ad1-97a699389a90', '7a94a030-e59a-4158-b15d-fb191b3d1cf4',
   true, true, true, 10, 'exact',
   'Backfilled 2026-05-02 — CAR Foothills $14.45/ton + 20% markup.', now(), now(), now()),
  ('24ea7f05-50ce-4363-9ad1-97a699389a90', '1bb6ef4d-97c5-47e6-a56f-52afda3c2257',
   true, true, true, 10, 'exact',
   'Backfilled 2026-05-02 — Brannan Pit 14/Pit 11 + CAR Foothills + 20% markup.', now(), now(), now())
ON CONFLICT (market_id, material_catalog_id) DO UPDATE SET
  is_visible = EXCLUDED.is_visible,
  is_available = EXCLUDED.is_available,
  is_featured = EXCLUDED.is_featured,
  last_reviewed_at = now(),
  admin_notes = EXCLUDED.admin_notes,
  updated_at = now();
