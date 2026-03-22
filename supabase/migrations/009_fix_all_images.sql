-- Fix ALL material images across all offerings and market_materials

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'fill-dirt');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'select-fill');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'topsoil');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'concrete-sand');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1547708915-f4a7dfe50bdf?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'masonry-sand');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1531496730074-83b227aab3e3?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'utility-sand');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'pea-gravel');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1568283096533-078a24bde253?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'base-gravel-57');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1590587521606-3394a0a1815a?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'flex-base');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1605106901227-991bd663255a?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'road-base');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1567095761054-7003d35e5350?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'washed-river-rock');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'limestone');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'rip-rap');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'crushed-concrete');

UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800&q=80&fit=crop'
WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'decomposed-granite');

-- Sync market_materials display images from offerings
UPDATE market_materials mm SET display_image_url = so.image_url
FROM (
  SELECT DISTINCT ON (material_catalog_id) material_catalog_id, image_url
  FROM supplier_offerings
  WHERE image_url IS NOT NULL
  ORDER BY material_catalog_id, created_at
) so
WHERE mm.material_catalog_id = so.material_catalog_id;
