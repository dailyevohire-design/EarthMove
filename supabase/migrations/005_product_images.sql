-- Add product images to all supplier offerings based on material catalog slug

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'fill-dirt');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1543674892-7d64d45df18b?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'select-fill');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'topsoil');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'concrete-sand');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'masonry-sand');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'utility-sand');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1595514535116-9b9b5db7cd22?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'pea-gravel');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'base-gravel-57');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'flex-base');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'road-base');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'washed-river-rock');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1564419320461-6870880221ad?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'limestone');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'rip-rap');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'crushed-concrete');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'decomposed-granite');
