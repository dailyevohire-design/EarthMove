-- 259_material_catalog_image_urls_round3b.sql
--
-- MCP-applied 2026-05-14. Addendum to 258_round3_co — wires class-6 base
-- (omitted from the Colorado photo batch because no CO-branded class-6
-- upload exists). Using Brannan's pre-existing May 8 virgin ABC product
-- photo. Single UPDATE flip if a CO-branded class-6 photo arrives later.
--
-- Idempotent: IS DISTINCT FROM matches 0 rows once applied.

UPDATE material_catalog
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/class6-abc-pitR-min.jpg'
WHERE slug = 'class-6'
  AND image_url IS DISTINCT FROM 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/class6-abc-pitR-min.jpg';
