-- System-wide cleanup: recompute alerts for all latest reports per contractor
-- whose stored alerts include NO_VERIFIABLE_STATE_REGISTRATION on a weak biz_status
-- (Not Found, Unknown, NULL) — i.e., reports where the tightened function (mig 265)
-- would suppress that alert.

WITH suspect_reports AS (
  SELECT tr.id, tr.contractor_id, tr.state_code, tr.biz_status, tr.biz_formation_date
  FROM trust_reports tr
  WHERE tr.contractor_name NOT ILIKE 'FTEST_%'
    AND tr.score_breakdown ? 'homeowner_alerts'
    AND tr.id IN (
      SELECT DISTINCT ON (contractor_id) id FROM trust_reports
      WHERE contractor_name NOT ILIKE 'FTEST_%'
      ORDER BY contractor_id, created_at DESC
    )
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(tr.score_breakdown->'homeowner_alerts') alert
      WHERE alert->>'alert_code' = 'NO_VERIFIABLE_STATE_REGISTRATION'
    )
    AND (
      tr.biz_status IS NULL
      OR lower(COALESCE(tr.biz_status, '')) ~ 'not.*found|unknown'
    )
    AND lower(COALESCE(tr.biz_status, '')) !~ 'no.*record|missing|dissol|forfeit|inactive|cancel|delinquent'
)
UPDATE trust_reports tr
SET score_breakdown = jsonb_set(
  COALESCE(tr.score_breakdown, '{}'::jsonb),
  '{homeowner_alerts}',
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
       'alert_code', a.alert_code, 'severity', a.severity,
       'headline', a.headline, 'body', a.body,
       'evidence_hint', a.evidence_hint, 'detected_at', a.detected_at
     ))
     FROM compute_homeowner_alerts_for_finalize(sr.contractor_id, sr.state_code, sr.biz_status, sr.biz_formation_date) a
    ),
    '[]'::jsonb
  )
)
FROM suspect_reports sr
WHERE tr.id = sr.id;
