-- VERIFIED WORKING IMAGE URLs (all tested 200 status)
-- Fill Dirt (200 OK)
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'fill-dirt');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'fill-dirt');

-- Select Fill (200 OK)
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'select-fill');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'select-fill');

-- Topsoil (200 OK)
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'topsoil');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'topsoil');

-- Concrete Sand (200 OK - using verified sand image)
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'concrete-sand');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'concrete-sand');

-- Pea Gravel (200 OK - using verified gravel image)
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'pea-gravel');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'pea-gravel');

-- Flex Base (200 OK - using verified construction image)
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'flex-base');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'flex-base');

-- Road Base (200 OK)
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1596727362302-b8d891c42ab8?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'road-base');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1596727362302-b8d891c42ab8?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'road-base');

-- Washed River Rock (200 OK)
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'washed-river-rock');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?w=800&q=80'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'washed-river-rock');
