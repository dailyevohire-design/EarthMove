-- ============================================================================
-- 117_zip_centroids_distance_fn
-- 1. zip_centroids table (US ZIP → lat/lng/geog) — seeded by separate script
-- 2. supply_yards.location_geog generated column (PostGIS geography from lat/lng)
-- 3. zip_to_yard_miles(zip TEXT, yard_id UUID) RETURNS NUMERIC RPC
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---- 1. zip_centroids table -----------------------------------------------
CREATE TABLE IF NOT EXISTS zip_centroids (
  zip TEXT PRIMARY KEY,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  city TEXT,
  state TEXT,
  geog GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS
    (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zip_centroids_geog
  ON zip_centroids USING GIST (geog);
CREATE INDEX IF NOT EXISTS idx_zip_centroids_state
  ON zip_centroids (state);

-- Public read (it's reference data, no PII)
ALTER TABLE zip_centroids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS zip_centroids_public_read ON zip_centroids;
CREATE POLICY zip_centroids_public_read ON zip_centroids
  FOR SELECT TO public USING (true);

-- ---- 2. supply_yards.location_geog generated geography --------------------
-- Generated col so it's always in sync with lat/lng. Skipped if already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='supply_yards' AND column_name='location_geog'
  ) THEN
    ALTER TABLE supply_yards
      ADD COLUMN location_geog GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        CASE
          WHEN lat IS NOT NULL AND lng IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
          ELSE NULL
        END
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supply_yards_location_geog
  ON supply_yards USING GIST (location_geog);

-- ---- 3. zip_to_yard_miles RPC ---------------------------------------------
-- Returns straight-line miles from ZIP centroid to supply yard centroid.
-- Returns NULL if either lookup fails (caller decides fallback policy).
CREATE OR REPLACE FUNCTION zip_to_yard_miles(p_zip TEXT, p_yard_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ROUND(
    (ST_Distance(z.geog, y.location_geog) / 1609.344)::numeric,
    2
  )
  FROM zip_centroids z, supply_yards y
  WHERE z.zip = p_zip
    AND y.id = p_yard_id
    AND y.location_geog IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION zip_to_yard_miles(TEXT, UUID) TO authenticated, anon, service_role;

COMMENT ON FUNCTION zip_to_yard_miles IS
  'Straight-line miles from ZIP centroid to supply yard. NULL if zip not found or yard has no coords. Uses PostGIS geography ST_Distance.';
