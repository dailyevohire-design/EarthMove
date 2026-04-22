-- Migration 038: drop zombie tables
--
-- All 5 tables verified 2026-04-22 via Supabase MCP against project
-- gaawvpzzmotimblyesfp to be:
--   - 0 rows
--   - zero inbound FK references
--   - zero function/trigger/view/RLS dependencies
--
-- Indexes owned by these tables will be dropped implicitly by DROP TABLE.
--
-- Rationale:
--   contractor_profiles  -> contractors live in profiles with role='gc'
--   driver_positions     -> superseded by location_pings (migration 032)
--   earnings             -> computed from dispatches.driver_pay + driver_bonus
--   security_alerts      -> T4-planned, never adopted, scaffolding only
--   canary_listings      -> T4-planned, never adopted, scaffolding only

BEGIN;

DROP TABLE IF EXISTS public.contractor_profiles CASCADE;
DROP TABLE IF EXISTS public.driver_positions    CASCADE;
DROP TABLE IF EXISTS public.earnings            CASCADE;
DROP TABLE IF EXISTS public.security_alerts     CASCADE;
DROP TABLE IF EXISTS public.canary_listings     CASCADE;

COMMIT;
