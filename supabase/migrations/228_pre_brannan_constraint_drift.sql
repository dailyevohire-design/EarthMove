-- Document schema drift introduced directly to live DB via MCP during the
-- NTNM Texas launch (2026-05-04), prior to migration 229 (Brannan Denver
-- seed) being authored.
--
-- This migration is intentionally written to be IDEMPOTENT:
--   * On prod, where the drift is already applied, every block is a no-op.
--   * On a fresh build (e.g. staging rebuilt from migrations), it brings
--     the schema to the same state prod was in before 229 runs.
--
-- Without this file, 229_brannan_denver_seed.sql relies on
-- supplier_offerings_yard_catalog_name_key existing — it would fail to
-- ON CONFLICT on a freshly-rebuilt DB.
--
-- Drift summary:
--   1. Dropped supplier_offerings_supply_yard_id_material_catalog_id_key
--      The old uniqueness on (supply_yard_id, material_catalog_id) was too
--      tight: NTNM stocks size variants like 1" Rock + 2" Rock that both
--      resolve to the Crushed Limestone catalog entry.
--   2. Added supplier_offerings_yard_catalog_name_key UNIQUE
--      (supply_yard_id, material_catalog_id, supplier_material_name) so
--      size variants can coexist under one catalog row.
--
-- Data drift not addressed here (NTNM market_materials + market_supply_pool
-- inserts) is treated as seed data, not schema. If staging is ever rebuilt,
-- those rows will need to be re-seeded separately.

BEGIN;

DO $$
BEGIN
  -- Drop the old (yard, catalog) uniqueness if it still exists.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.supplier_offerings'::regclass
      AND conname  = 'supplier_offerings_supply_yard_id_material_catalog_id_key'
  ) THEN
    ALTER TABLE public.supplier_offerings
      DROP CONSTRAINT supplier_offerings_supply_yard_id_material_catalog_id_key;
  END IF;

  -- Add the new (yard, catalog, supplier_material_name) uniqueness if missing.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.supplier_offerings'::regclass
      AND conname  = 'supplier_offerings_yard_catalog_name_key'
  ) THEN
    ALTER TABLE public.supplier_offerings
      ADD CONSTRAINT supplier_offerings_yard_catalog_name_key
      UNIQUE (supply_yard_id, material_catalog_id, supplier_material_name);
  END IF;
END $$;

COMMIT;
