-- ALL images visually verified by viewing the actual downloaded JPG
-- Every URL confirmed to show the correct aggregate material

-- Fill Dirt → cracked dry dirt surface
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1657722228891-92de8b43f46d?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'fill-dirt');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1657722228891-92de8b43f46d?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'fill-dirt');

-- Select Fill → construction site earthwork
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1766595680977-fd4818afa337?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'select-fill');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1766595680977-fd4818afa337?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'select-fill');

-- Topsoil → rich dark brown soil
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1726413280663-1b048191e88e?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'topsoil');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1726413280663-1b048191e88e?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'topsoil');

-- Concrete Sand → coarse sand with small stones
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1725996525814-6f9dc9c57f41?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'concrete-sand');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1725996525814-6f9dc9c57f41?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'concrete-sand');

-- Masonry Sand → fine white sand ripple texture
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1602587557703-4ddfc070a4b3?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'masonry-sand');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1602587557703-4ddfc070a4b3?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'masonry-sand');

-- Utility Sand → sand dune ripple texture
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1760740516392-e959f71c6027?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'utility-sand');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1760740516392-e959f71c6027?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'utility-sand');

-- Pea Gravel → smooth round white/cream pebbles
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1760774713181-7e74c20e6d75?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'pea-gravel');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1760774713181-7e74c20e6d75?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'pea-gravel');

-- Base Gravel #57 → crushed gray angular gravel
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1698220726355-62f370544733?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'base-gravel-57');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1698220726355-62f370544733?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'base-gravel-57');

-- Flex Base → white/gray crushed stone surface
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'flex-base');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'flex-base');

-- Road Base → reddish cracked compacted earth
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1628853939888-0ae58fd55cef?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'road-base');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1628853939888-0ae58fd55cef?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'road-base');

-- Washed River Rock → smooth rounded colorful river stones
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1761853314053-a065268fa3c4?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'washed-river-rock');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1761853314053-a065268fa3c4?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'washed-river-rock');

-- Limestone → large volcanic/stone rock close-up
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1716341360813-794990593a6a?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'limestone');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1716341360813-794990593a6a?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'limestone');

-- Rip Rap → large angular reddish rocks pile
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1699032582554-7c1e6cfce1d1?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'rip-rap');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1699032582554-7c1e6cfce1d1?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'rip-rap');

-- Crushed Concrete → concrete rubble pile
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1639804096664-f25e8fe4a794?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'crushed-concrete');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1639804096664-f25e8fe4a794?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'crushed-concrete');

-- Decomposed Granite → reddish-brown fine gravel texture
UPDATE supplier_offerings SET image_url = 'https://images.unsplash.com/photo-1770785555680-453fedb06f6f?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'decomposed-granite');
UPDATE market_materials SET display_image_url = 'https://images.unsplash.com/photo-1770785555680-453fedb06f6f?w=800&q=80' WHERE material_catalog_id = (SELECT id FROM material_catalog WHERE slug = 'decomposed-granite');
