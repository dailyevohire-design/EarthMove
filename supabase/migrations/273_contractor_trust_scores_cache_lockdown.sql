-- ============================================================================
-- MIGRATION 273 — contractor_trust_scores CACHE HARDENING
-- ============================================================================
-- Renderer reads trust_reports directly. But search API and other future code
-- paths might read contractor_trust_scores. Stale cache rows are a defamation
-- surface. Also: non-contractor entities (City of X, etc.) suppressed.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contractor_trust_scores_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid,
  legal_name text,
  state_code text,
  prior_composite_score numeric,
  prior_grade text,
  prior_risk_level text,
  prior_calculated_at timestamptz,
  cleanup_reason text NOT NULL,
  cleaned_at timestamptz DEFAULT now()
);

WITH stale AS (
  SELECT
    cts.id AS cts_id, cts.contractor_id,
    cts.composite_score, cts.grade, cts.risk_level, cts.calculated_at,
    c.legal_name, c.state_code
  FROM contractor_trust_scores cts
  JOIN contractors c ON c.id = cts.contractor_id
  WHERE c.state_code IN ('TX','CO')
    AND EXISTS (
      SELECT 1 FROM trust_reports tr
      WHERE tr.contractor_id = cts.contractor_id
        AND tr.created_at > cts.calculated_at
    )
)
INSERT INTO contractor_trust_scores_cleanup_log
  (contractor_id, legal_name, state_code, prior_composite_score, prior_grade,
   prior_risk_level, prior_calculated_at, cleanup_reason)
SELECT contractor_id, legal_name, state_code, composite_score, grade,
       risk_level, calculated_at, 'stale_vs_latest_trust_report'
FROM stale;

DELETE FROM contractor_trust_scores
WHERE id IN (
  SELECT cts.id FROM contractor_trust_scores cts
  JOIN contractors c ON c.id = cts.contractor_id
  WHERE c.state_code IN ('TX','CO')
    AND EXISTS (
      SELECT 1 FROM trust_reports tr
      WHERE tr.contractor_id = cts.contractor_id
        AND tr.created_at > cts.calculated_at
    )
);

WITH non_contractor AS (
  SELECT cts.id AS cts_id, cts.contractor_id, cts.composite_score, cts.grade,
         cts.risk_level, cts.calculated_at, c.legal_name, c.state_code
  FROM contractor_trust_scores cts
  JOIN contractors c ON c.id = cts.contractor_id
  WHERE c.legal_name ILIKE 'city of %'
     OR c.legal_name ILIKE 'town of %'
     OR c.legal_name ILIKE 'county of %'
     OR c.legal_name ILIKE 'state of %'
     OR c.legal_name ILIKE '%department of %'
     OR c.legal_name ILIKE '%municipal %'
     OR c.legal_name ILIKE 'u.s. %'
     OR c.legal_name ILIKE 'united states %'
)
INSERT INTO contractor_trust_scores_cleanup_log
  (contractor_id, legal_name, state_code, prior_composite_score, prior_grade,
   prior_risk_level, prior_calculated_at, cleanup_reason)
SELECT contractor_id, legal_name, state_code, composite_score, grade,
       risk_level, calculated_at, 'non_contractor_entity'
FROM non_contractor;

DELETE FROM contractor_trust_scores
WHERE id IN (
  SELECT cts.id FROM contractor_trust_scores cts
  JOIN contractors c ON c.id = cts.contractor_id
  WHERE c.legal_name ILIKE 'city of %'
     OR c.legal_name ILIKE 'town of %'
     OR c.legal_name ILIKE 'county of %'
     OR c.legal_name ILIKE 'state of %'
     OR c.legal_name ILIKE '%department of %'
     OR c.legal_name ILIKE '%municipal %'
     OR c.legal_name ILIKE 'u.s. %'
     OR c.legal_name ILIKE 'united states %'
);

WITH non_contractor_reports AS (
  SELECT tr.id, tr.trust_score, tr.risk_level, tr.biz_status, tr.confidence_level,
         tr.requires_re_review, c.legal_name, c.state_code, c.id AS contractor_id, tr.contractor_name
  FROM trust_reports tr
  JOIN contractors c ON c.id = tr.contractor_id
  WHERE (c.legal_name ILIKE 'city of %'
      OR c.legal_name ILIKE 'town of %'
      OR c.legal_name ILIKE 'county of %'
      OR c.legal_name ILIKE 'state of %'
      OR c.legal_name ILIKE '%department of %'
      OR c.legal_name ILIKE '%municipal %'
      OR c.legal_name ILIKE 'u.s. %'
      OR c.legal_name ILIKE 'united states %')
    AND tr.trust_score IS NOT NULL
)
INSERT INTO launch_data_lockdown_log
  (report_id, contractor_id, contractor_name, state_code, lockdown_reason,
   prior_trust_score, prior_risk_level, prior_biz_status, prior_confidence_level,
   prior_requires_re_review, applied_by)
SELECT id, contractor_id, contractor_name, state_code, 'non_contractor_entity',
       trust_score, risk_level, biz_status, confidence_level, requires_re_review,
       'mig_273_non_contractor'
FROM non_contractor_reports;

UPDATE trust_reports tr
SET trust_score = NULL,
    risk_level = NULL,
    biz_status = NULL,
    requires_re_review = TRUE
FROM contractors c
WHERE tr.contractor_id = c.id
  AND tr.trust_score IS NOT NULL
  AND (c.legal_name ILIKE 'city of %'
    OR c.legal_name ILIKE 'town of %'
    OR c.legal_name ILIKE 'county of %'
    OR c.legal_name ILIKE 'state of %'
    OR c.legal_name ILIKE '%department of %'
    OR c.legal_name ILIKE '%municipal %'
    OR c.legal_name ILIKE 'u.s. %'
    OR c.legal_name ILIKE 'united states %');
