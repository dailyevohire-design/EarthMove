-- 224: data_integrity_status canonical enum + backfill + NOT NULL
--
-- Today trust_reports.data_integrity_status is a free-form text column
-- with a long tail of NULL/'unknown'/'legacy'/'stale' values. PR #24
-- requires it to be the load-bearing branch point for the
-- NoEntityFoundCard render path, so we lock it down to the canonical
-- five values and backfill every existing row.
--
-- Status values:
--   ok                 — sources succeeded, mixed/positive findings
--   partial            — some sources errored OR core profile fields NULL
--   entity_not_found   — every meaningful finding was *_not_found / *_clear
--   degraded           — >50% of sources errored
--   failed             — every source errored OR trust_score NULL with searches > 0
--
-- Also adds the same column to trust_jobs for parity (orchestrator-v2
-- writes it on completion).
--
-- Idempotent: drops the constraint first if it already exists, so the
-- migration can be re-applied across rebases.

-- Backfill all NULL or non-canonical rows
UPDATE trust_reports SET data_integrity_status = CASE
  WHEN trust_score IS NULL AND COALESCE(searches_performed, 0) > 0 THEN 'failed'
  WHEN trust_score IS NULL                                        THEN 'entity_not_found'
  WHEN biz_status IS NULL AND lic_status IS NULL                  THEN 'partial'
  ELSE 'ok'
END
WHERE data_integrity_status IS NULL
   OR data_integrity_status NOT IN ('ok','partial','entity_not_found','degraded','failed');

-- Enforce enum + NOT NULL on trust_reports
ALTER TABLE trust_reports
  DROP CONSTRAINT IF EXISTS trust_reports_data_integrity_status_check;
ALTER TABLE trust_reports
  ADD CONSTRAINT trust_reports_data_integrity_status_check
  CHECK (data_integrity_status IN ('ok','partial','entity_not_found','degraded','failed'));
ALTER TABLE trust_reports ALTER COLUMN data_integrity_status SET DEFAULT 'partial';
ALTER TABLE trust_reports ALTER COLUMN data_integrity_status SET NOT NULL;

-- Add data_integrity_status to trust_jobs for parity (orchestrator-v2 writes
-- it on the completed/failed update).
ALTER TABLE trust_jobs
  ADD COLUMN IF NOT EXISTS data_integrity_status text;
ALTER TABLE trust_jobs
  DROP CONSTRAINT IF EXISTS trust_jobs_data_integrity_status_check;
ALTER TABLE trust_jobs
  ADD CONSTRAINT trust_jobs_data_integrity_status_check
  CHECK (data_integrity_status IS NULL
      OR data_integrity_status IN ('ok','partial','entity_not_found','degraded','failed'));
