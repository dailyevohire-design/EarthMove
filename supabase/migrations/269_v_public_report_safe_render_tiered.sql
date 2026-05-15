-- Refined safe-render gate: three tiers instead of binary suppress.
-- requires_re_review alone is NOT a defamation risk (integrity_v2 sets it on quorum demotion).
-- True suppression reserved for unrenderable content; "with_advisory" surfaces a UI badge.

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
    WHEN tr.trust_score IS NULL THEN 'suppress'
    WHEN tr.contractor_id IS NULL THEN 'suppress'
    WHEN tr.contractor_name ILIKE 'FTEST_%' THEN 'suppress'
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
      THEN 'suppress'
    WHEN tr.requires_re_review = TRUE THEN 'render_with_advisory'
    WHEN tr.confidence_level = 'LOW' AND tr.trust_score < 60 THEN 'render_with_advisory'
    ELSE 'render'
  END AS render_decision,
  CASE
    WHEN tr.trust_score IS NULL THEN 'pending_score_no_data'
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
  END AS suppress_reason,
  CASE
    WHEN tr.requires_re_review = TRUE
      THEN 'This report is undergoing additional verification. Please verify findings independently.'
    WHEN tr.confidence_level = 'LOW' AND tr.trust_score < 60
      THEN 'Limited data available for this contractor. Score reflects current evidence only and may change as more sources report.'
    ELSE NULL
  END AS advisory_message,
  CASE
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
  END AS safe_to_render
FROM trust_reports tr;

GRANT SELECT ON v_public_report_safe_render TO authenticated, anon, service_role;

COMMENT ON VIEW v_public_report_safe_render IS
  'Single canonical gate for public report rendering. Three tiers: "render" (show normally), "render_with_advisory" (show with banner), "suppress" (do not show).';
