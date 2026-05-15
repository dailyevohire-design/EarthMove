-- Clear old Gearheart's biz_status='Inactive' (since we know from new contractor's re-synth
-- that it's actually Active in TX Comptroller — old reports were poisoned by tx-sos-biz bug).
-- Set to NULL to indicate "no current evidence available" rather than serving the wrong value.

UPDATE trust_reports
SET biz_status = NULL,
    biz_formation_date = NULL
WHERE contractor_id = 'ce613526-c193-400b-9ab2-63edd5a6cba8'
  AND contractor_name NOT ILIKE 'FTEST_%';

-- Recompute alerts now that biz_status is NULL
WITH gearheart_reports AS (
  SELECT id, state_code FROM trust_reports
  WHERE contractor_id = 'ce613526-c193-400b-9ab2-63edd5a6cba8'
    AND contractor_name NOT ILIKE 'FTEST_%'
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
     FROM compute_homeowner_alerts_for_finalize(tr.contractor_id, tr.state_code, NULL, NULL) a
    ),
    '[]'::jsonb
  )
)
FROM gearheart_reports gr
WHERE tr.id = gr.id;
