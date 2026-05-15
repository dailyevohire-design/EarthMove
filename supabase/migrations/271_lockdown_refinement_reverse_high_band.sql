-- Refine lockdown: HIGH band (40-59) with MEDIUM/HIGH confidence is honest "limited info"
-- not defamation. Restore those. Keep CRITICAL band (<40) thin-evidence locks + LOW-confidence locks.

CREATE TEMP TABLE _to_restore AS
SELECT report_id, prior_trust_score, prior_risk_level, prior_biz_status, prior_requires_re_review, prior_confidence_level
FROM launch_data_lockdown_log
WHERE applied_at >= now() - interval '30 minutes'
  AND prior_trust_score >= 40
  AND prior_confidence_level IN ('MEDIUM','HIGH');

UPDATE trust_reports tr
SET trust_score = r.prior_trust_score::smallint,
    risk_level = r.prior_risk_level,
    biz_status = r.prior_biz_status,
    requires_re_review = COALESCE(r.prior_requires_re_review, FALSE)
FROM _to_restore r
WHERE tr.id = r.report_id;

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

  IF v_score < 40 THEN
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
  END IF;

  IF v_score < 60 AND v_confidence = 'LOW' THEN RETURN FALSE; END IF;

  RETURN TRUE;
END;
$func$;

UPDATE launch_data_lockdown_log
SET lockdown_reason = lockdown_reason || ' [REVERSED]',
    applied_by = applied_by || ' / reverted_mig_271'
WHERE report_id IN (SELECT report_id FROM _to_restore)
  AND lockdown_reason NOT LIKE '%[REVERSED]%';
