-- Set/correct image_url on material_catalog for slugs surfacing on /browse.
--
-- Includes 1 correction (concrete-sand was mapped to 38-Minus-Concrete, which
-- is base material, not C-33 sand) and 10 new image assignments for previously
-- null entries — covering all 7 catalog rows added by 229 (Brannan Denver
-- seed) plus 3 pre-existing slugs that lacked images: cobblestone, rip-rap,
-- recycled-concrete.
--
-- All filenames verified to exist in storage bucket 'material-images'
-- (public bucket). 'wash sand.png' has a literal space and is URL-encoded
-- as 'wash%20sand.png' to match the form material_catalog.image_url stores
-- elsewhere (full public URL).
--
-- Rendering paths affected:
--   /browse index card        — pulls material_catalog.image_url first,
--                               falls back to offering.image_url
--   /browse/[slug] hero       — pulls offering.image_url first,
--                               falls back to material_catalog.image_url

BEGIN;

WITH updates(slug, filename) AS (VALUES
  ('concrete-sand',     'c33-sand-pitR-min.jpg'),
  ('crusher-fines',     'crusher-fines-pitR-min.jpg'),
  ('squeegee',          'squeegee-pitR-min.jpg'),
  ('vtc',               'vtc-pitR-min.jpg'),
  ('recycled-concrete', 'class6-recycled-pitR-min.jpg'),
  ('cobblestone',       'half-inch-cobblestone-min.jpg'),
  ('rip-rap',           '9-Inch-L-Rip-Rap-Pit-R-1.jpg'),
  ('fine-sand',         'wash%20sand.png'),
  ('washed-rock',       '2-inch-rock-square-21e71884cbeb0ad26c13858772d10ebc-.jpg'),
  ('crushed-rock',      '56-67-crushed-riprap-pit25-min.jpg'),
  ('chip-aggregate',    '3822-Chips-Chat-Rock-square-f66697f4fefeb94585d569597d97c4ca-.jpg')
)
UPDATE material_catalog mc
SET image_url = 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/' || u.filename
FROM updates u
WHERE mc.slug = u.slug;

COMMIT;
