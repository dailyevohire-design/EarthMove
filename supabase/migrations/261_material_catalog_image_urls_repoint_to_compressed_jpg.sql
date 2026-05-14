-- 261_material_catalog_image_urls_repoint_to_compressed_jpg.sql
--
-- MCP-applied 2026-05-14. F-007 from /design-review: 16 oversized PNGs
-- (3-4 MB each, ~62.5 MB total) compressed to JPEG q82 1280px max →
-- 5.2 MB total (92% reduction). This migration repoints catalog rows from
-- the old .png URLs to the new .jpg URLs. Old PNGs to be deleted from the
-- material-images bucket after deploy verification.
--
-- Idempotent: REPLACE matches 0 rows once applied.

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/basecoursee.png', '/basecoursee.jpg')
WHERE image_url LIKE '%/basecoursee.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/bedding%20sand.png', '/bedding%20sand.jpg')
WHERE image_url LIKE '%/bedding%20sand.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/cobblestone%20co.png', '/cobblestone%20co.jpg')
WHERE image_url LIKE '%/cobblestone%20co.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/Colorado%2057%20stone.png', '/Colorado%2057%20stone.jpg')
WHERE image_url LIKE '%/Colorado%2057%20stone.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/concrete%20sand%20co.png', '/concrete%20sand%20co.jpg')
WHERE image_url LIKE '%/concrete%20sand%20co.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/crushed%20rock%20bull%20rock%20co.png', '/crushed%20rock%20bull%20rock%20co.jpg')
WHERE image_url LIKE '%/crushed%20rock%20bull%20rock%20co.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/crusher%20fines%20co.png', '/crusher%20fines%20co.jpg')
WHERE image_url LIKE '%/crusher%20fines%20co.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/filldirt.png', '/filldirt.jpg')
WHERE image_url LIKE '%/filldirt.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/manufactured%20sand.png', '/manufactured%20sand.jpg')
WHERE image_url LIKE '%/manufactured%20sand.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/pea%20gravel%20co.png', '/pea%20gravel%20co.jpg')
WHERE image_url LIKE '%/pea%20gravel%20co.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/recycled%20asphalt%20co.png', '/recycled%20asphalt%20co.jpg')
WHERE image_url LIKE '%/recycled%20asphalt%20co.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/recycled%20concrete%20co.png', '/recycled%20concrete%20co.jpg')
WHERE image_url LIKE '%/recycled%20concrete%20co.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/squeegee%20co.png', '/squeegee%20co.jpg')
WHERE image_url LIKE '%/squeegee%20co.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/structural%20fill%20co.png', '/structural%20fill%20co.jpg')
WHERE image_url LIKE '%/structural%20fill%20co.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/utility%20sand.png', '/utility%20sand.jpg')
WHERE image_url LIKE '%/utility%20sand.png';

UPDATE material_catalog
SET image_url = REPLACE(image_url, '/wash%20sand.png', '/wash%20sand.jpg')
WHERE image_url LIKE '%/wash%20sand.png';

-- Verify zero remaining .png references for these 16 files
-- SELECT slug, image_url FROM material_catalog
-- WHERE image_url ~ '/material-images/(basecoursee|bedding|cobblestone|Colorado|concrete%20sand|crushed%20rock|crusher%20fines|filldirt|manufactured|pea%20gravel|recycled|squeegee|structural|utility|wash)[^/]*\.png';
