-- 260_material_catalog_image_urls_round4_brannan_backfill.sql
--
-- MCP-applied 2026-05-14. Backfills 8 catalog entries from existing Brannan
-- bucket assets (mostly small .jpg files, 25-200 KB each). These rows had
-- catalog.image_url=NULL and zero supplier_offerings with image_url, so they
-- appeared as gray placeholders on PDP cross-sells.
--
-- Skipped (no clean asset match): river-sand, gravel-1, crusher-run, mulch
-- variants, soil mixes, marble/slate/brick chips, polymeric-sand, beach-sand.
-- Those need real photos before wiring.
--
-- Idempotent: IS DISTINCT FROM matches 0 rows once applied.

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/class2-recycled-pitR-min.jpg'
WHERE slug = 'recycled-base'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/class2-recycled-pitR-min.jpg';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/class1-pitR-min.jpg'
WHERE slug = 'road-base'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/class1-pitR-min.jpg';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/recycled%20concrete%20co.png'
WHERE slug = 'crushed-concrete'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/recycled%20concrete%20co.png';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/c33-sand-pitR-min.jpg'
WHERE slug = 'playground-sand'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/c33-sand-pitR-min.jpg';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/wash%20sand.png'
WHERE slug = 'play-sand'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/wash%20sand.png';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/2x4-River-Rock-square-86266d9bc2ac66343771e8c28352930d-.jpg'
WHERE slug = 'washed-river-rock'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/2x4-River-Rock-square-86266d9bc2ac66343771e8c28352930d-.jpg';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/3X5-square-39f7f229342d63a49ca326b602a81df6-.jpg'
WHERE slug = 'river-rock-3-5'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/3X5-square-39f7f229342d63a49ca326b602a81df6-.jpg';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/Tejas-Black-square-d7ec3f156d17bdf87f8b2286caa371e0-.jpg'
WHERE slug = 'black-star-gravel'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/Tejas-Black-square-d7ec3f156d17bdf87f8b2286caa371e0-.jpg';

-- Expected post-state:
--   black-star-gravel → Tejas-Black-square
--   crushed-concrete  → recycled concrete co.png
--   play-sand         → wash sand.png
--   playground-sand   → c33-sand-pitR-min.jpg
--   recycled-base     → class2-recycled-pitR-min.jpg
--   river-rock-3-5    → 3X5-square
--   road-base         → class1-pitR-min.jpg
--   washed-river-rock → 2x4-River-Rock-square
