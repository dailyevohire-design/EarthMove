-- Migration 275: Extend adverse-evidence requirement to HIGH band.
-- Final form. Any score < 60 (HIGH or CRITICAL) requires at least one
-- adverse-evidence source. LOW/MEDIUM (>=60) pass through.

CREATE OR REPLACE FUNCTION public.enforce_trust_score_evidence_floor()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE v_adverse_count integer;
BEGIN
  IF NEW.trust_score IS NULL THEN RETURN NEW; END IF;
  IF NEW.contractor_id IS NULL THEN
    NEW.trust_score := NULL; NEW.risk_level := NULL; NEW.biz_status := NULL;
    NEW.requires_re_review := TRUE;
    RAISE WARNING 'orphan report % score blocked (no contractor_id)', NEW.id;
    RETURN NEW;
  END IF;
  IF NEW.data_integrity_status IS DISTINCT FROM 'ok' THEN
    NEW.trust_score := NULL; NEW.risk_level := NULL; NEW.biz_status := NULL;
    NEW.requires_re_review := TRUE;
    RAISE WARNING 'report % score blocked — data_integrity_status=% (not ok)', NEW.id, NEW.data_integrity_status;
    RETURN NEW;
  END IF;
  IF NEW.trust_score < 60 THEN
    SELECT COUNT(DISTINCT source_key) INTO v_adverse_count FROM trust_evidence
    WHERE contractor_id = NEW.contractor_id AND finding_type IN (
      'court_judgment','court_judgment_against','court_judgment_for_plaintiff',
      'osha_citation_serious','osha_citation_willful','osha_citation_repeat',
      'bbb_complaint','bbb_rating_low','bbb_unresolved',
      'ag_enforcement','ag_action','lien_recorded','lien_against_debtor',
      'license_suspended','license_revoked','license_disciplinary',
      'sanctions_hit','ofac_hit','exclusion',
      'business_inactive','business_dissolved','business_forfeited',
      'address_reuse','officer_shared_with_dissolved'
    );
    IF COALESCE(v_adverse_count, 0) < 1 THEN
      NEW.trust_score := NULL; NEW.risk_level := NULL; NEW.biz_status := NULL;
      NEW.requires_re_review := TRUE;
      RAISE WARNING 'report % adverse-band score % blocked — zero adverse evidence for contractor %', NEW.id, NEW.trust_score, NEW.contractor_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.enforce_trust_score_evidence_floor() IS
  'Universal write-boundary evidence floor (mig 275). Any non-null trust_score requires data_integrity_status=ok. Any score < 60 (adverse band) requires at least one adverse-evidence source.';
