-- LAUNCH DEFAMATION DEFENSE — canonical "safe to render publicly" gate.
-- Initial version. Superseded by mig 269 (tiered render decision).
-- Both kept in repo for schema_migrations parity with prod.

DROP VIEW IF EXISTS v_public_report_safe_render CASCADE;
CREATE VIEW v_public_report_safe_render AS
SELECT
  tr.id AS report_id,
  tr.contractor_id,
  tr.trust_score,
  tr.risk_level,
  tr.confidence_level,
  tr.biz_status,
  tr.requires_re_review,
  COALESCE((
    SELECT COUNT(DISTINCT te.source_key)
    FROM trust_evidence te
    WHERE te.contractor_id = tr.contractor_id
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
  ), 0) AS adverse_source_count,
  CASE
    WHEN tr.requires_re_review = TRUE THEN FALSE
    WHEN tr.trust_score IS NULL THEN FALSE
    WHEN tr.contractor_id IS NULL THEN FALSE
    WHEN tr.contractor_name ILIKE 'FTEST_%' THEN FALSE
    WHEN tr.trust_score < 40
         AND COALESCE((
           SELECT COUNT(DISTINCT te.source_key)
           FROM trust_evidence te
           WHERE te.contractor_id = tr.contractor_id
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
         ), 0) < 1
      THEN FALSE
    ELSE TRUE
  END AS safe_to_render,
  CASE
    WHEN tr.requires_re_review = TRUE THEN 'pending_re_review'
    WHEN tr.trust_score IS NULL THEN 'pending_score'
    WHEN tr.contractor_id IS NULL THEN 'orphaned_report'
    WHEN tr.contractor_name ILIKE 'FTEST_%' THEN 'forensic_fixture'
    WHEN tr.trust_score < 40
         AND COALESCE((
           SELECT COUNT(DISTINCT te.source_key)
           FROM trust_evidence te
           WHERE te.contractor_id = tr.contractor_id
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
         ), 0) < 1
      THEN 'critical_with_thin_evidence'
    ELSE NULL
  END AS suppress_reason
FROM trust_reports tr;

GRANT SELECT ON v_public_report_safe_render TO authenticated, anon, service_role;

COMMENT ON VIEW v_public_report_safe_render IS
  'Single canonical gate for "is this report safe to render in a public-facing context." Renderer should JOIN against this view and only render rows where safe_to_render=TRUE.';
