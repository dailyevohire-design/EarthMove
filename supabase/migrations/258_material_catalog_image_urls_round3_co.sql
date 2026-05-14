-- 258_material_catalog_image_urls_round3_co.sql
--
-- MCP-applied 2026-05-14. Colorado-branded photo batch — wires 11 catalog
-- rows (10 distinct materials; recycled-asphalt and crushed-asphalt share
-- one image to preserve the 257 sharing convention for functionally
-- identical materials).
--
-- 3 of the 11 fill a previous null (structural-fill, bull-rock, 57-stone);
-- the other 8 replace earlier non-CO product photos.
--
-- Idempotent: IS DISTINCT FROM matches 0 rows once applied.

UPDATE material_catalog SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/crusher%20fines%20co.png'
WHERE slug = 'crusher-fines' AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/crusher%20fines%20co.png';

UPDATE material_catalog SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/structural%20fill%20co.png'
WHERE slug = 'structural-fill' AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/structural%20fill%20co.png';

UPDATE material_catalog SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/concrete%20sand%20co.png'
WHERE slug = 'concrete-sand' AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/concrete%20sand%20co.png';

UPDATE material_catalog SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/crushed%20rock%20bull%20rock%20co.png'
WHERE slug = 'bull-rock' AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/crushed%20rock%20bull%20rock%20co.png';

UPDATE material_catalog SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/squeegee%20co.png'
WHERE slug = 'squeegee' AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/squeegee%20co.png';

UPDATE material_catalog SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/pea%20gravel%20co.png'
WHERE slug = 'pea-gravel' AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/pea%20gravel%20co.png';

UPDATE material_catalog SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/Colorado%2057%20stone.png'
WHERE slug = '57-stone' AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/Colorado%2057%20stone.png';

UPDATE material_catalog SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/cobblestone%20co.png'
WHERE slug = 'cobblestone' AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/cobblestone%20co.png';

UPDATE material_catalog SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/recycled%20asphalt%20co.png'
WHERE slug = 'recycled-asphalt' AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/recycled%20asphalt%20co.png';

UPDATE material_catalog SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/recycled%20asphalt%20co.png'
WHERE slug = 'crushed-asphalt' AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/recycled%20asphalt%20co.png';

UPDATE material_catalog SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/recycled%20concrete%20co.png'
WHERE slug = 'recycled-concrete' AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/recycled%20concrete%20co.png';
