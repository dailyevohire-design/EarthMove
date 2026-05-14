-- 234_material_catalog_image_urls_round2.sql
--
-- MCP-applied 2026-05-14. Documents 5 image wirings via direct UPDATE on
-- material_catalog.image_url. Pattern matches 230 / b39fb45 — the website
-- reads catalog.image_url directly, so direct update is canonical until the
-- material_images gallery table convention is unified (mixed in prod today).
--
-- Filenames with spaces are URL-encoded (%20) for canonical form.
-- Idempotent: IS DISTINCT FROM matches 0 rows once applied. Re-runs are no-ops.

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/basecoursee.png'
WHERE slug = 'base-course'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/basecoursee.png';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/filldirt.png'
WHERE slug = 'fill-dirt'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/filldirt.png';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/utility%20sand.png'
WHERE slug = 'utility-sand'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/utility%20sand.png';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/manufactured%20sand.png'
WHERE slug = 'manufactured-sand'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/manufactured%20sand.png';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/bedding%20sand.png'
WHERE slug = 'bedding-sand'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/bedding%20sand.png';

-- Expected post-state (verified via MCP at apply time):
--   base-course       → basecoursee.png
--   bedding-sand      → bedding%20sand.png
--   fill-dirt         → filldirt.png (replaced prior Select-Fill image)
--   manufactured-sand → manufactured%20sand.png
--   utility-sand      → utility%20sand.png
