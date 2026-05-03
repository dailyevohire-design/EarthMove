-- ============================================================================
-- 120_disable_offerings_with_null_yard_coords
-- Applied to prod via MCP at 2026-05-02 23:40:31 UTC.
--
-- After mig 119 disabled scraped data, 150 public offerings remained whose
-- yards have lat IS NULL or lng IS NULL. zip_to_yard_miles RPC returns NULL
-- for these (no geog), haversine fallback fires. Same class of pollution as
-- scraped rows, smaller scale.
--
-- Soft-disable. Reversible: flip is_public back once yards have real coords.
-- ============================================================================

UPDATE supplier_offerings o
SET is_public = false, updated_at = now()
FROM supply_yards sy
WHERE o.supply_yard_id = sy.id
  AND o.is_public = true
  AND (sy.lat IS NULL OR sy.lng IS NULL);
