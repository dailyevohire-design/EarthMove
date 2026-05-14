-- 257_material_catalog_image_urls_round2b.sql
--
-- MCP-applied 2026-05-14. Addendum to 256_round2 — wires 2 asphalt slugs
-- to a shared Brannan RAP/RAS product photo. Both slugs represent
-- functionally the same material (Recycled Asphalt Pavement / Shingles),
-- so they share one image_url. If we ever want to differentiate visually
-- the swap is a single UPDATE.
--
-- Idempotent: IS DISTINCT FROM matches 0 rows once applied.

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/rap-ras-pitR-min.jpg'
WHERE slug = 'crushed-asphalt'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/rap-ras-pitR-min.jpg';

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/rap-ras-pitR-min.jpg'
WHERE slug = 'recycled-asphalt'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/rap-ras-pitR-min.jpg';

-- Expected post-state:
--   crushed-asphalt   → rap-ras-pitR-min.jpg
--   recycled-asphalt  → rap-ras-pitR-min.jpg
