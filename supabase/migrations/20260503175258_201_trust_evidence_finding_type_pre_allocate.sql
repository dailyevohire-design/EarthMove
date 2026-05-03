-- 201_trust_evidence_finding_type_pre_allocate
--
-- Pre-allocates ALL finding_type values that future Tranche B/C scrapers
-- will emit. Without this, every license-board / insurance / OSHA / BBB /
-- court / federal-contractor scraper would need to extend the CHECK
-- constraint as part of its own migration, creating dependency hell when
-- 30+ agents work in parallel.
--
-- Idempotent via sentinel check: if 'license_revoked' is already in the
-- constraint, migration is a no-op.
--
-- Existing 41 values preserved verbatim. 31 new values appended.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'trust_evidence'
      AND c.conname = 'trust_evidence_finding_type_check'
      AND pg_get_constraintdef(c.oid) LIKE '%license_revoked%'
  ) THEN
    RAISE NOTICE 'Migration 201 already applied (license_revoked present in CHECK)';
    RETURN;
  END IF;

  ALTER TABLE trust_evidence DROP CONSTRAINT trust_evidence_finding_type_check;

  ALTER TABLE trust_evidence ADD CONSTRAINT trust_evidence_finding_type_check
    CHECK (finding_type = ANY (ARRAY[
      -- existing 41 values (preserved verbatim)
      'license_active', 'license_inactive', 'license_expired',
      'license_suspended', 'license_not_found',
      'business_active', 'business_inactive', 'business_dissolved',
      'business_not_found',
      'osha_violation', 'osha_serious_violation', 'osha_no_violations',
      'legal_action_found', 'legal_judgment_against', 'legal_no_actions',
      'bbb_accredited', 'bbb_rating', 'bbb_complaint', 'bbb_not_profiled',
      'review_aggregate', 'review_item_positive', 'review_item_negative',
      'phoenix_signal', 'officer_match', 'address_reuse', 'phone_reuse',
      'ein_match',
      'sanction_hit', 'sanction_clear',
      'news_mention_positive', 'news_mention_negative',
      'lien_found', 'lien_clear',
      'raw_source_response', 'source_error', 'source_not_applicable',
      'permit_history_clean', 'permit_history_robust', 'permit_history_low',
      'permit_history_stale', 'permit_scope_violation',

      -- new in migration 201 (31 values, future-scraper pre-allocation)
      -- license-board extensions
      'license_revoked', 'license_disciplinary_action',
      'license_penalty_assessed', 'license_no_record',
      'license_revoked_but_operating',
      -- insurance verification (Tranche B)
      'insurance_active_gl', 'insurance_active_wc', 'insurance_lapsed',
      'insurance_no_record', 'insurance_below_minimum',
      'insurance_carrier_name',
      -- OSHA finer-grained
      'osha_violations_clean', 'osha_serious_citation',
      'osha_willful_citation', 'osha_repeat_citation',
      'osha_fatality_finding', 'osha_inspection_no_violation',
      -- BBB rating granularity
      'bbb_rating_a_plus', 'bbb_rating_a', 'bbb_rating_b',
      'bbb_rating_c_or_below', 'bbb_complaints_high', 'bbb_no_profile',
      -- civil court / lien
      'civil_judgment_against', 'civil_settlement', 'civil_no_judgments',
      'mechanic_lien_filed', 'mechanic_lien_resolved',
      -- federal contractor
      'federal_contractor_active', 'federal_contractor_past_performance',
      'federal_contractor_no_record'
    ]));
END $$;
