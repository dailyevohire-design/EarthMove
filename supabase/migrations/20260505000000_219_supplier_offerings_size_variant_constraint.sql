-- 219: allow size variants of the same canonical material at one yard
--
-- Real quarries stock multiple size cuts of the same base material — e.g. a
-- limestone yard sells 1" Rock + 2" Rock + 3"x5" + 8"x12" all backed by the
-- same `crushed-limestone` catalog entry. The original UNIQUE(supply_yard_id,
-- material_catalog_id) blocked that. Loosen to also key on
-- supplier_material_name so true duplicates (same yard, same catalog, same
-- supplier name) are still rejected.
--
-- Idempotent: drops the old constraint by name (IF EXISTS) and adds the new
-- one only if absent.

ALTER TABLE supplier_offerings
  DROP CONSTRAINT IF EXISTS supplier_offerings_supply_yard_id_material_catalog_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'supplier_offerings_yard_catalog_name_key'
      AND conrelid = 'public.supplier_offerings'::regclass
  ) THEN
    ALTER TABLE supplier_offerings
      ADD CONSTRAINT supplier_offerings_yard_catalog_name_key
      UNIQUE (supply_yard_id, material_catalog_id, supplier_material_name);
  END IF;
END $$;
