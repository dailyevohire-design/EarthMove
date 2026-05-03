-- 203_parallel_agent_coordination_and_score_history
--
-- Two new tables + an FK back to trust_reports.score_history_id (column
-- added in migration 202).
--
-- 1. parallel_agent_coordination — tracks the up-to-100 agent fleet's
--    state, scope, migration ranges, and lifecycle. EXCLUDE constraint
--    prevents two active/idle/blocked agents from claiming overlapping
--    migration_range int4range values; this is the schema-level
--    enforcement of the "no two agents touch the same migration number"
--    rule. Requires btree_gist extension.
--
-- 2. trust_score_history — append-only audit of trust_score / risk_level
--    per (contractor_id, captured_at). Backfilled from existing
--    trust_reports rows; trigger keeps it populated going forward.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ────────────────────────────────────────────────────────────────────────
-- parallel_agent_coordination
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parallel_agent_coordination (
  agent_id          text PRIMARY KEY,
  stream            text NOT NULL,
  branch            text NOT NULL,
  scope_files       text[] NOT NULL,
  migration_range   int4range NOT NULL,
  status            text NOT NULL CHECK (status IN
                      ('idle','active','blocked','merged','reverted','failed')),
  spec_doc_path     text,
  blocked_by        text[] DEFAULT '{}',
  started_at        timestamptz,
  merged_at         timestamptz,
  reverted_at       timestamptz,
  cost_usd_estimate numeric(8,2) DEFAULT 0,
  cost_usd_actual   numeric(8,2) DEFAULT 0,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pac_status ON parallel_agent_coordination(status);
CREATE INDEX IF NOT EXISTS idx_pac_stream ON parallel_agent_coordination(stream);

DROP TRIGGER IF EXISTS trg_pac_updated ON parallel_agent_coordination;
CREATE TRIGGER trg_pac_updated
  BEFORE UPDATE ON parallel_agent_coordination
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Migration-range mutual exclusion: two active/idle/blocked agents cannot
-- both claim overlapping migration ranges. Merged/reverted/failed rows are
-- excluded from the constraint so historical claims don't block future ones.
ALTER TABLE parallel_agent_coordination
  DROP CONSTRAINT IF EXISTS pac_no_migration_range_overlap;
ALTER TABLE parallel_agent_coordination
  ADD CONSTRAINT pac_no_migration_range_overlap
  EXCLUDE USING gist (migration_range WITH &&)
  WHERE (status IN ('active','idle','blocked'));

-- ────────────────────────────────────────────────────────────────────────
-- trust_score_history
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trust_score_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id    uuid NOT NULL REFERENCES contractors(id),
  trust_score      smallint NOT NULL,
  risk_level       text NOT NULL,
  captured_at      timestamptz NOT NULL DEFAULT now(),
  source_report_id uuid REFERENCES trust_reports(id)
);

CREATE INDEX IF NOT EXISTS idx_tsh_contractor_captured
  ON trust_score_history(contractor_id, captured_at DESC);

-- Backfill from existing trust_reports. Idempotent: skips rows already
-- present (matched by source_report_id) so re-running is safe.
INSERT INTO trust_score_history (contractor_id, trust_score, risk_level, captured_at, source_report_id)
SELECT r.contractor_id, r.trust_score, r.risk_level, r.created_at, r.id
FROM trust_reports r
WHERE r.trust_score IS NOT NULL
  AND r.contractor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM trust_score_history h WHERE h.source_report_id = r.id
  );

-- Going-forward trigger: every new trust_reports row that has a non-null
-- trust_score + contractor_id appends to trust_score_history.
CREATE OR REPLACE FUNCTION populate_trust_score_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trust_score IS NOT NULL AND NEW.contractor_id IS NOT NULL THEN
    INSERT INTO trust_score_history(contractor_id, trust_score, risk_level, captured_at, source_report_id)
    VALUES (NEW.contractor_id, NEW.trust_score, NEW.risk_level, NEW.created_at, NEW.id);
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_trust_reports_score_history ON trust_reports;
CREATE TRIGGER trg_trust_reports_score_history
  AFTER INSERT ON trust_reports
  FOR EACH ROW EXECUTE FUNCTION populate_trust_score_history();

-- ────────────────────────────────────────────────────────────────────────
-- FK from trust_reports.score_history_id (column added in migration 202)
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE trust_reports
  DROP CONSTRAINT IF EXISTS fk_trust_reports_score_history;
ALTER TABLE trust_reports
  ADD CONSTRAINT fk_trust_reports_score_history
  FOREIGN KEY (score_history_id)
  REFERENCES trust_score_history(id)
  ON DELETE SET NULL;
