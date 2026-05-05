-- 220: cache for real drive times from a customer ZIP to a supply yard
--
-- The pricing engine needs drive minutes (not just miles) to compute the
-- time-based delivery fee for time-based offerings — $175 covers ≤60 min,
-- +$75 per additional 30 min. Without this cache we'd hit the routing API
-- on every page render. Each (zip, yard) pair is small and stable, so a
-- thin lookup table is enough.
--
-- The application falls back to a miles-based heuristic when no row exists
-- (or when the row is missing minutes), so the table is purely an
-- optimization: presence improves accuracy and cuts API spend; absence is
-- not a bug.

CREATE TABLE IF NOT EXISTS zip_yard_drive_times (
  zip          text NOT NULL,
  yard_id      uuid NOT NULL REFERENCES supply_yards(id) ON DELETE CASCADE,
  miles        numeric(8, 2),
  drive_minutes numeric(7, 1),
  source       text NOT NULL DEFAULT 'mapbox',
  computed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (zip, yard_id)
);

CREATE INDEX IF NOT EXISTS zip_yard_drive_times_yard_idx
  ON zip_yard_drive_times (yard_id);

COMMENT ON TABLE zip_yard_drive_times IS
  'Cached drive minutes from US zip centroids to supply yards. Populated lazily by src/lib/eta.ts on first /browse render for a given (zip, yard) pair.';
