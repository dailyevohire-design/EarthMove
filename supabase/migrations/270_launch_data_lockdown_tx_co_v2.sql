-- ============================================================================
-- MIGRATION 270 v2 — LAUNCH DATA LOCKDOWN (TX/CO PHYSICAL HARDENING)
-- ============================================================================
-- Wrong data physically cannot surface. The data IS the gate.
-- Renderer NULL-handling converges to safe rendering when trust_score is NULL.
-- ============================================================================

CREATE TABLE IF NOT EXISTS launch_emergency_controls (
  control_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT TRUE,
  description text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by text
);

INSERT INTO launch_emergency_controls (control_key, enabled, description) VALUES
  ('public_render_enabled', TRUE,
   'MASTER KILL SWITCH. UPDATE to FALSE to suppress all public renders.'),
  ('tx_co_strict_lockdown', TRUE,
   'TX/CO physical lockdown applied. Suspect reports have NULL public-facing fields.'),
  ('freeze_new_synth_renders', FALSE,
   'When TRUE, new trust_reports INSERTs auto-flag requires_re_review=TRUE.')
ON CONFLICT (control_key) DO NOTHING;

GRANT SELECT ON launch_emergency_controls TO authenticated, anon, service_role;

CREATE TABLE IF NOT EXISTS launch_data_lockdown_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  contractor_id uuid,
  contractor_name text,
  state_code text,
  lockdown_reason text NOT NULL,
  prior_trust_score numeric,
  prior_risk_level text,
  prior_biz_status text,
  prior_confidence_level text,
  prior_requires_re_review boolean,
  adverse_source_count integer,
  applied_at timestamptz DEFAULT now(),
  applied_by text DEFAULT 'mig_270_launch_lockdown'
);

CREATE INDEX IF NOT EXISTS idx_lockdown_log_contractor ON launch_data_lockdown_log(contractor_id);
CREATE INDEX IF NOT EXISTS idx_lockdown_log_reason ON launch_data_lockdown_log(lockdown_reason);
CREATE INDEX IF NOT EXISTS idx_lockdown_log_state ON launch_data_lockdown_log(state_code);

CREATE OR REPLACE FUNCTION is_press_window_safe(p_report_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $func$
DECLARE
  v_master_enabled boolean;
  v_score numeric;
  v_contractor_id uuid;
  v_contractor_name text;
  v_confidence text;
  v_adverse_count integer;
BEGIN
  SELECT enabled INTO v_master_enabled
  FROM launch_emergency_controls WHERE control_key = 'public_render_enabled';
  IF v_master_enabled IS NOT TRUE THEN RETURN FALSE; END IF;

  SELECT trust_score, contractor_id, contractor_name, confidence_level
  INTO v_score, v_contractor_id, v_contractor_name, v_confidence
  FROM trust_reports WHERE id = p_report_id;

  IF v_score IS NULL THEN RETURN FALSE; END IF;
  IF v_contractor_id IS NULL THEN RETURN FALSE; END IF;
  IF v_contractor_name ILIKE 'FTEST_%' THEN RETURN FALSE; END IF;
  IF v_contractor_name ILIKE 'SEED_%' THEN RETURN FALSE; END IF;
  IF v_contractor_name ILIKE 'DEMO_%' THEN RETURN FALSE; END IF;

  IF v_score < 60 THEN
    SELECT COUNT(DISTINCT source_key) INTO v_adverse_count
    FROM trust_evidence
    WHERE contractor_id = v_contractor_id
      AND finding_type IN (
        'court_judgment','court_judgment_against','court_judgment_for_plaintiff',
        'osha_citation_serious','osha_citation_willful','osha_citation_repeat',
        'bbb_complaint','bbb_rating_low','bbb_unresolved',
        'ag_enforcement','ag_action',
        'lien_recorded','lien_against_debtor',
        'license_suspended','license_revoked','license_disciplinary',
        'sanctions_hit','ofac_hit','exclusion',
        'business_inactive','business_dissolved','business_forfeited',
        'address_reuse','officer_shared_with_dissolved'
      );
    IF COALESCE(v_adverse_count, 0) < 1 THEN RETURN FALSE; END IF;
    IF v_confidence = 'LOW' THEN RETURN FALSE; END IF;
  END IF;

  RETURN TRUE;
END;
$func$;

GRANT EXECUTE ON FUNCTION is_press_window_safe(uuid) TO authenticated, anon, service_role;
COMMENT ON FUNCTION is_press_window_safe(uuid) IS
  'Single canonical predicate: is this trust report safe to render in a public context right now? Honors master kill switch.';

CREATE OR REPLACE FUNCTION enforce_press_window_freeze()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
DECLARE
  v_freeze boolean;
BEGIN
  SELECT enabled INTO v_freeze
  FROM launch_emergency_controls WHERE control_key = 'freeze_new_synth_renders';
  IF v_freeze IS TRUE AND TG_OP = 'INSERT' THEN
    NEW.requires_re_review := TRUE;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS tr_trust_reports_press_window_freeze ON trust_reports;
CREATE TRIGGER tr_trust_reports_press_window_freeze
  BEFORE INSERT ON trust_reports
  FOR EACH ROW
  EXECUTE FUNCTION enforce_press_window_freeze();

WITH latest_per AS (
  SELECT DISTINCT ON (tr.contractor_id)
    tr.id, tr.contractor_id, tr.trust_score, tr.risk_level, tr.biz_status,
    tr.confidence_level, tr.requires_re_review, tr.contractor_name,
    c.state_code, c.legal_name
  FROM trust_reports tr
  JOIN contractors c ON c.id = tr.contractor_id
  WHERE c.state_code IN ('TX','CO')
    AND tr.trust_score IS NOT NULL
    AND tr.contractor_name NOT ILIKE 'FTEST_%'
    AND tr.contractor_name NOT ILIKE 'SEED_%'
    AND tr.contractor_name NOT ILIKE 'DEMO_%'
  ORDER BY tr.contractor_id, tr.created_at DESC
),
suspect AS (
  SELECT
    lp.*,
    (SELECT COUNT(DISTINCT te.source_key) FROM trust_evidence te
     WHERE te.contractor_id = lp.contractor_id
       AND te.finding_type IN (
         'court_judgment','court_judgment_against','court_judgment_for_plaintiff',
         'osha_citation_serious','osha_citation_willful','osha_citation_repeat',
         'bbb_complaint','bbb_rating_low','bbb_unresolved',
         'ag_enforcement','ag_action',
         'lien_recorded','lien_against_debtor',
         'license_suspended','license_revoked','license_disciplinary',
         'sanctions_hit','ofac_hit','exclusion',
         'business_inactive','business_dissolved','business_forfeited',
         'address_reuse','officer_shared_with_dissolved'
       )
    ) AS adverse_count
  FROM latest_per lp
),
classified AS (
  SELECT
    id, contractor_id, contractor_name, state_code,
    trust_score, risk_level, biz_status, confidence_level, requires_re_review, adverse_count,
    CASE
      WHEN trust_score < 60 AND COALESCE(adverse_count, 0) < 1
        THEN 'hot_score_no_adverse_evidence'
      WHEN trust_score < 60 AND confidence_level = 'LOW'
        THEN 'hot_score_low_confidence'
      ELSE NULL
    END AS lockdown_reason
  FROM suspect
)
INSERT INTO launch_data_lockdown_log (
  report_id, contractor_id, contractor_name, state_code, lockdown_reason,
  prior_trust_score, prior_risk_level, prior_biz_status, prior_confidence_level,
  prior_requires_re_review, adverse_source_count
)
SELECT
  id, contractor_id, contractor_name, state_code, lockdown_reason,
  trust_score, risk_level, biz_status, confidence_level, requires_re_review, adverse_count
FROM classified
WHERE lockdown_reason IS NOT NULL;

UPDATE trust_reports
SET trust_score = NULL,
    risk_level = NULL,
    biz_status = NULL,
    requires_re_review = TRUE
WHERE id IN (
  SELECT report_id FROM launch_data_lockdown_log
  WHERE applied_at >= now() - interval '5 minutes'
);
