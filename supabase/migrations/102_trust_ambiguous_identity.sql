-- Adds AMBIGUOUS_IDENTITY support to trust_reports:
--   - trust_score and risk_level become nullable (model returns null when identity
--     cannot be disambiguated; no score is produced)
--   - risk_level CHECK extended to accept 'AMBIGUOUS' alongside existing values,
--     and NULL
-- trust_score CHECK (0..100) is NULL-safe in Postgres (CHECK evaluates NULL as
-- passing), so no change needed there.

ALTER TABLE public.trust_reports ALTER COLUMN trust_score DROP NOT NULL;

ALTER TABLE public.trust_reports ALTER COLUMN risk_level DROP NOT NULL;

ALTER TABLE public.trust_reports DROP CONSTRAINT trust_reports_risk_level_check;

ALTER TABLE public.trust_reports
  ADD CONSTRAINT trust_reports_risk_level_check
  CHECK (risk_level IS NULL OR risk_level = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text, 'CRITICAL'::text, 'AMBIGUOUS'::text]));
