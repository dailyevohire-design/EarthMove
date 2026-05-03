-- 202_trust_reports_industry_scoring_columns
--
-- Pre-allocates optional columns for industry-specific scoring (Tranche C)
-- and a forward reference to trust_score_history (table created in
-- migration 203). The FK on score_history_id is added in 203, after the
-- target table exists.

ALTER TABLE trust_reports
  ADD COLUMN IF NOT EXISTS primary_industry text NULL;

ALTER TABLE trust_reports
  ADD COLUMN IF NOT EXISTS industry_score_profile jsonb NULL;

ALTER TABLE trust_reports
  ADD COLUMN IF NOT EXISTS score_history_id uuid NULL;
