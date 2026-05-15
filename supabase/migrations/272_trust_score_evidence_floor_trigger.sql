-- ============================================================================
-- MIGRATION 272 — TRUST SCORE EVIDENCE FLOOR (PREVENTIVE ROOT-CAUSE FIX)
-- ============================================================================
-- Write-boundary trigger. Defamation-grade CRITICAL writes are physically NULL'd
-- before storage. Catches the historical pattern where pre-PR-40 synth could
-- store trust_score=40 CRITICAL with data_integrity_status='failed' on
-- ambiguous-identity refusals.
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_trust_score_evidence_floor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $func$
DECLARE
  v_adverse_count integer;
  v_blocked boolean := FALSE;
BEGIN
  IF NEW.trust_score IS NULL OR NEW.trust_score >= 40 THEN
    RETURN NEW;
  END IF;

  IF NEW.contractor_id IS NULL THEN
    NEW.trust_score := NULL;
    NEW.risk_level := NULL;
    NEW.biz_status := NULL;
    NEW.requires_re_review := TRUE;
    RAISE WARNING 'enforce_trust_score_evidence_floor: orphan report % CRITICAL score blocked (no contractor_id)', NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.data_integrity_status IN ('failed', 'partial', 'entity_not_found', 'degraded') THEN
    NEW.trust_score := NULL;
    NEW.risk_level := NULL;
    NEW.biz_status := NULL;
    NEW.requires_re_review := TRUE;
    v_blocked := TRUE;
    RAISE WARNING 'enforce_trust_score_evidence_floor: report % CRITICAL score blocked — data_integrity_status=%', NEW.id, NEW.data_integrity_status;
  END IF;

  IF NOT v_blocked THEN
    SELECT COUNT(DISTINCT source_key) INTO v_adverse_count
    FROM trust_evidence
    WHERE contractor_id = NEW.contractor_id
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

    IF COALESCE(v_adverse_count, 0) < 1 THEN
      NEW.trust_score := NULL;
      NEW.risk_level := NULL;
      NEW.biz_status := NULL;
      NEW.requires_re_review := TRUE;
      RAISE WARNING 'enforce_trust_score_evidence_floor: report % CRITICAL score blocked — zero adverse evidence for contractor %', NEW.id, NEW.contractor_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS tr_trust_reports_evidence_floor ON trust_reports;
CREATE TRIGGER tr_trust_reports_evidence_floor
  BEFORE INSERT OR UPDATE OF trust_score, risk_level, data_integrity_status ON trust_reports
  FOR EACH ROW
  EXECUTE FUNCTION enforce_trust_score_evidence_floor();

COMMENT ON FUNCTION enforce_trust_score_evidence_floor() IS
  'Defamation defense at the write boundary. Prevents storage of trust_score < 40 (CRITICAL) when (a) data_integrity_status indicates synth could not verify identity, OR (b) zero adverse-evidence sources exist for the contractor.';
