-- 108_collections_kit_expansion.sql
-- Pivot from counsel-gated scope (v0) to the kit model. All property types are
-- accepted; kit_variant routes TX homestead without pre-work spouse-signed
-- contract to the demand-only variant.

BEGIN;

-- Drop v0 scope constraints — kit model accepts all property types + homestead.
ALTER TABLE collections_cases DROP CONSTRAINT IF EXISTS tx_v0_scope;
ALTER TABLE collections_cases DROP CONSTRAINT IF EXISTS co_v0_scope;

-- Kit variant tracks whether this case produces the full 4-document kit or
-- the demand-only 2-document variant.
CREATE TYPE collections_kit_variant AS ENUM ('full_kit', 'demand_only');

ALTER TABLE collections_cases
  ADD COLUMN kit_variant collections_kit_variant NOT NULL DEFAULT 'full_kit';

-- has_pre_work_contract = true iff TX-homestead gate is satisfied:
--   contract signed AND both spouses signed. Generated so intake + admin
--   dashboards query it without reimplementing the logic.
ALTER TABLE collections_cases
  ADD COLUMN has_pre_work_contract boolean
  GENERATED ALWAYS AS (
    original_contract_signed_date IS NOT NULL
    AND COALESCE(original_contract_both_spouses_signed, false) = true
  ) STORED;

-- Instruction packet PDF path — fourth artifact in the kit.
ALTER TABLE collections_cases
  ADD COLUMN instruction_packet_storage_path text;

CREATE INDEX IF NOT EXISTS idx_coll_cases_variant ON collections_cases(kit_variant, state_code);

COMMIT;
