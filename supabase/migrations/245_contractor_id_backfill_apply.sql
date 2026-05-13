-- 245_contractor_id_backfill_apply.sql
-- Phoenix unlock part 2 of 2: apply approved matches from mig 244 staging.
--
-- Scope decided after inspecting staging (mig 244 results):
--   * 20 exact_normalized_state matches across 7 real contractors (apply)
--   * 159 no_match_create_new rows — ALL synthetic forensic fixtures (skip)
--
-- This migration does NOT create new contractor rows. The 159 synthetic
-- rows (FTEST_*, FORENSIC_TEST_*) are not real businesses; they exist
-- only to validate trigger / scoring logic and should keep contractor_id
-- NULL forever.
--
-- The UPDATE is double-gated:
--   1) staging row must be exact_normalized_state with match_score=100
--   2) contractor_name must not match synthetic-fixture prefix patterns
-- Either gate failing → no mutation. Belt + suspenders.
--
-- Idempotent: WHERE r.contractor_id IS NULL guarantees re-runs no-op.

BEGIN;

DO $pre$
DECLARE
  staging_rows int;
  expected_real int;
  real_with_null_id int;
BEGIN
  SELECT count(*) INTO staging_rows FROM trust_contractor_id_backfill_candidates;
  IF staging_rows = 0 THEN
    RAISE EXCEPTION 'mig245 precondition: staging table is empty — mig 244 not applied?';
  END IF;

  SELECT count(*) INTO expected_real
    FROM trust_contractor_id_backfill_candidates
   WHERE match_strategy = 'exact_normalized_state'
     AND match_score = 100
     AND report_contractor_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock)';

  SELECT count(*) INTO real_with_null_id
    FROM trust_reports
   WHERE contractor_id IS NULL
     AND contractor_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock)';

  RAISE NOTICE 'mig245 pre-state: staging=%, expected_real_updates=%, real_null_id_reports=%',
    staging_rows, expected_real, real_with_null_id;
END $pre$;

WITH applied AS (
  UPDATE trust_reports r
     SET contractor_id = sc.candidate_contractor_id
    FROM trust_contractor_id_backfill_candidates sc
   WHERE r.id = sc.trust_report_id
     AND sc.match_strategy = 'exact_normalized_state'
     AND sc.match_score = 100
     AND sc.candidate_contractor_id IS NOT NULL
     AND r.contractor_id IS NULL
     AND r.contractor_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock)'
  RETURNING r.id AS report_id, sc.candidate_contractor_id AS contractor_id, r.contractor_name
)
SELECT count(*) AS rows_updated FROM applied;

DO $post$
DECLARE
  real_remaining_null int;
  synthetic_still_null int;
  total_real_linked int;
BEGIN
  SELECT count(*) INTO real_remaining_null
    FROM trust_reports
   WHERE contractor_id IS NULL
     AND contractor_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock)';

  SELECT count(*) INTO synthetic_still_null
    FROM trust_reports
   WHERE contractor_id IS NULL
     AND contractor_name ~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock)';

  SELECT count(*) INTO total_real_linked
    FROM trust_reports
   WHERE contractor_id IS NOT NULL
     AND contractor_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock)';

  RAISE NOTICE 'mig245 post-state: real_remaining_null=%, synthetic_still_null=% (expected positive — synthetics stay NULL), total_real_linked=%',
    real_remaining_null, synthetic_still_null, total_real_linked;

  IF real_remaining_null > 0 THEN
    RAISE EXCEPTION 'mig245 postcondition: % real reports still have contractor_id IS NULL — UPDATE did not link all expected rows', real_remaining_null;
  END IF;
END $post$;

COMMIT;
