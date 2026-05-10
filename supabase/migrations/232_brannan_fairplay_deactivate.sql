-- 232_brannan_fairplay_deactivate.sql
--
-- Documents the MCP-applied fix on 2026-05-10 deactivating Brannan Pit 23 Fairplay
-- (yard id 22222222-2222-4222-a222-222222222209, lat 39.226, lng -105.998).
--
-- Pit 23 sits in the deep mountain corridor ~70mi from Denver via US-285.
-- The 229 seed inserted it with is_active=true, but the original Brannan launch
-- spec (May 7) called for excluding Fairplay until Denver-mountain-corridor
-- pricing semantics exist or market scoping is wired. Without scoping, the
-- 30mi delivery radius bleeds into south-of-Denver pricing along 285.
--
-- Idempotent: re-running matches 0 rows once is_active is already false.
--
-- Also captures verification_status convention discovered during this audit:
--   verification_status='verified'   pairs with data_source='manual'
--     (we entered + confirmed the price)
--   verification_status='unverified' pairs with data_source='supplier_provided'
--     (supplier submitted, we haven't independently confirmed)
-- NTNM's 62 offerings are intentionally 'unverified' under this convention.
-- Do not blanket-promote unverified rows; promote per-offering as confirmation lands.

UPDATE supply_yards
SET is_active = false,
    updated_at = now()
WHERE id = '22222222-2222-4222-a222-222222222209'
  AND is_active = true;

-- Expected post-state for Brannan supplier (11111111-1111-4111-a111-111111111104):
--   4 active yards: Pit 11 Ft. Lupton, Pit 14 Commerce City, Pit 21 Central City, Pit 26 Platteville
--   1 inactive yard: Pit 23 Fairplay
