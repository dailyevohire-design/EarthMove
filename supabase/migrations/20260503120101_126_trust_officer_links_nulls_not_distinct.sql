-- 126_trust_officer_links_nulls_not_distinct
--
-- Bug:
--   trust_officer_links has UNIQUE (contractor_id, officer_id, role, start_date)
--   and link_contractor_officer() does ON CONFLICT … DO NOTHING, but CO SOS
--   registered_agent links are inserted with start_date = NULL. Postgres treats
--   each NULL as distinct in unique indexes (default semantics), so re-running
--   the same contractor inserts a duplicate (contractor_id, officer_id, role)
--   row instead of being a no-op. Observed 2026-05-03 with TEXCO+PCN BUILDERS
--   re-runs producing 2 rows each for JORDANA ESQUIVEL MENDEZ / MARIEL ACOSTA
--   SILVA registered_agent links.
--
-- Fix:
--   1. Dedupe existing duplicate groups, keeping the earliest-created row.
--   2. Drop the existing unique constraint and re-add it with NULLS NOT DISTINCT
--      so two NULL start_dates collide. Requires PG15+; prod is on 17.6.
--   3. link_contractor_officer() needs no change — its existing
--      ON CONFLICT (contractor_id, officer_id, role, start_date) DO NOTHING
--      now actually fires for NULL start_date links.

BEGIN;

-- 1. Dedupe — keep earliest row per (contractor_id, officer_id, role, start_date).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY contractor_id, officer_id, role,
                        COALESCE(start_date::text, '__null__')
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM trust_officer_links
)
DELETE FROM trust_officer_links
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Replace the unique constraint with a NULLS NOT DISTINCT version.
ALTER TABLE trust_officer_links
  DROP CONSTRAINT trust_officer_links_contractor_id_officer_id_role_start_dat_key;

ALTER TABLE trust_officer_links
  ADD CONSTRAINT trust_officer_links_uniq_contractor_officer_role_start
  UNIQUE NULLS NOT DISTINCT (contractor_id, officer_id, role, start_date);

COMMIT;
