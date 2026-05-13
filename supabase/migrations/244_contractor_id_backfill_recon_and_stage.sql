-- 244_contractor_id_backfill_recon_and_stage.sql
-- Phoenix unlock part 1 of 2: build a permanent ranked-candidate staging table
-- for the trust_reports rows where contractor_id IS NULL. No writes to
-- trust_reports here. The follow-up migration 245 reads this staging table
-- to apply approved matches and create new contractor rows as needed.
--
-- Match strategies, ranked by deterministic confidence:
--   100  exact_normalized_state    JOIN on contractors.normalized_name + state_code
--                                  (the contractors_normalized_state_uniq index
--                                  guarantees this is a 1:1 match)
--    70  normalized_match_no_state fallback for reports with NULL state_code
--                                  (multiple candidates possible — ranked by
--                                  contractors.first_seen_at)
--     0  no_match_create_new       no contractor row exists for this name +
--                                  state; mig 245 will INSERT a new one
--
-- Idempotent — safe to re-apply. The staging table is dropped + recreated.
-- Postcondition assert fails the migration if any NULL trust_reports row is
-- not represented in the staging table.

BEGIN;

-- ─── Discovery: log pre-state to MCP apply output ────────────────────────────
DO $disc$
DECLARE
  null_count int;
  contractor_count int;
  fn_present bool;
  uniq_present bool;
BEGIN
  SELECT count(*) INTO null_count FROM trust_reports WHERE contractor_id IS NULL;
  SELECT count(*) INTO contractor_count FROM contractors;
  SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname='normalize_contractor_name') INTO fn_present;
  SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='contractors_normalized_state_uniq') INTO uniq_present;

  RAISE NOTICE 'mig244 discovery: null_reports=%, contractors=%, normalize_fn_present=%, uniq_index_present=%',
    null_count, contractor_count, fn_present, uniq_present;

  IF NOT fn_present THEN
    RAISE EXCEPTION 'mig244 precondition failed: normalize_contractor_name(text) not found';
  END IF;
  IF NOT uniq_present THEN
    RAISE EXCEPTION 'mig244 precondition failed: contractors_normalized_state_uniq index not found';
  END IF;
END $disc$;

-- ─── Staging table (permanent — survives commit for MCP inspection) ──────────
DROP TABLE IF EXISTS trust_contractor_id_backfill_candidates;
CREATE TABLE trust_contractor_id_backfill_candidates (
  trust_report_id          uuid NOT NULL,
  candidate_contractor_id  uuid,
  match_strategy           text NOT NULL CHECK (match_strategy IN (
    'exact_normalized_state',
    'normalized_match_no_state',
    'no_match_create_new'
  )),
  match_score              smallint NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  rank_within_report       smallint NOT NULL,
  report_contractor_name   text NOT NULL,
  report_state_code        text,
  report_city              text,
  candidate_legal_name     text,
  candidate_normalized     text,
  candidate_slug           text,
  candidate_state_code     text,
  candidate_city           text,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trust_report_id, match_strategy, rank_within_report)
);

CREATE INDEX idx_tcibc_top_rank ON trust_contractor_id_backfill_candidates (trust_report_id, rank_within_report);
CREATE INDEX idx_tcibc_strategy ON trust_contractor_id_backfill_candidates (match_strategy, match_score DESC);
CREATE INDEX idx_tcibc_candidate ON trust_contractor_id_backfill_candidates (candidate_contractor_id) WHERE candidate_contractor_id IS NOT NULL;

COMMENT ON TABLE trust_contractor_id_backfill_candidates IS
  'Phoenix unlock staging: ranked contractor_id candidates for trust_reports rows where contractor_id IS NULL. Populated by mig 244. Consumed by mig 245 (apply phase). Safe to query after mig 245 lands for audit / second-pass review. Idempotent — re-applying mig 244 truncates + re-populates.';

-- ─── Populate candidates ─────────────────────────────────────────────────────
WITH null_reports AS (
  SELECT
    id,
    contractor_name,
    state_code::text AS state_code,
    city,
    normalize_contractor_name(contractor_name) AS name_norm
  FROM trust_reports
  WHERE contractor_id IS NULL
    AND contractor_name IS NOT NULL
    AND length(trim(contractor_name)) > 0
),
exact_matches AS (
  SELECT
    r.id AS trust_report_id,
    c.id AS candidate_contractor_id,
    'exact_normalized_state'::text AS match_strategy,
    100::smallint AS match_score,
    1::smallint AS rank_within_report,
    r.contractor_name AS report_contractor_name,
    r.state_code AS report_state_code,
    r.city AS report_city,
    c.legal_name AS candidate_legal_name,
    c.normalized_name AS candidate_normalized,
    c.slug AS candidate_slug,
    c.state_code::text AS candidate_state_code,
    c.city AS candidate_city,
    'unique-index 1:1 match on (normalized_name, state_code)'::text AS notes
  FROM null_reports r
  JOIN contractors c
    ON c.normalized_name = r.name_norm
   AND upper(c.state_code::text) = upper(r.state_code)
  WHERE r.state_code IS NOT NULL
    AND r.name_norm IS NOT NULL
    AND length(r.name_norm) > 0
),
exact_matched_report_ids AS (
  SELECT DISTINCT trust_report_id FROM exact_matches
),
no_state_matches AS (
  SELECT
    r.id AS trust_report_id,
    c.id AS candidate_contractor_id,
    'normalized_match_no_state'::text AS match_strategy,
    70::smallint AS match_score,
    row_number() OVER (
      PARTITION BY r.id
      ORDER BY c.first_seen_at ASC NULLS LAST, c.id ASC
    )::smallint AS rank_within_report,
    r.contractor_name,
    r.state_code,
    r.city,
    c.legal_name,
    c.normalized_name,
    c.slug,
    c.state_code::text,
    c.city,
    'fallback: trust_report.state_code is NULL — multiple candidates possible, ranked by first_seen_at'::text
  FROM null_reports r
  JOIN contractors c ON c.normalized_name = r.name_norm
  WHERE r.state_code IS NULL
    AND r.name_norm IS NOT NULL
    AND length(r.name_norm) > 0
    AND r.id NOT IN (SELECT trust_report_id FROM exact_matched_report_ids)
),
unmatched_marker AS (
  SELECT
    r.id AS trust_report_id,
    NULL::uuid AS candidate_contractor_id,
    'no_match_create_new'::text AS match_strategy,
    0::smallint AS match_score,
    1::smallint AS rank_within_report,
    r.contractor_name,
    r.state_code,
    r.city,
    NULL::text AS candidate_legal_name,
    NULL::text AS candidate_normalized,
    NULL::text AS candidate_slug,
    NULL::text AS candidate_state_code,
    NULL::text AS candidate_city,
    'no contractors row matches (normalized_name, state_code) — mig 245 will INSERT new contractor and link'::text
  FROM null_reports r
  WHERE r.id NOT IN (SELECT trust_report_id FROM exact_matched_report_ids)
    AND r.id NOT IN (SELECT DISTINCT trust_report_id FROM no_state_matches)
)
INSERT INTO trust_contractor_id_backfill_candidates (
  trust_report_id, candidate_contractor_id, match_strategy, match_score, rank_within_report,
  report_contractor_name, report_state_code, report_city,
  candidate_legal_name, candidate_normalized, candidate_slug,
  candidate_state_code, candidate_city, notes
)
SELECT * FROM exact_matches
UNION ALL
SELECT * FROM no_state_matches
UNION ALL
SELECT * FROM unmatched_marker;

-- ─── Postcondition: every NULL trust_report must have at least one staging row
DO $post$
DECLARE
  exact_count int;
  no_state_count int;
  create_new_count int;
  total_null int;
  covered int;
  empty_name_skipped int;
BEGIN
  SELECT count(*) INTO exact_count
    FROM trust_contractor_id_backfill_candidates WHERE match_strategy='exact_normalized_state';
  SELECT count(*) INTO no_state_count
    FROM trust_contractor_id_backfill_candidates WHERE match_strategy='normalized_match_no_state';
  SELECT count(*) INTO create_new_count
    FROM trust_contractor_id_backfill_candidates WHERE match_strategy='no_match_create_new';
  SELECT count(*) INTO total_null
    FROM trust_reports WHERE contractor_id IS NULL;
  SELECT count(DISTINCT trust_report_id) INTO covered
    FROM trust_contractor_id_backfill_candidates;
  SELECT count(*) INTO empty_name_skipped
    FROM trust_reports
   WHERE contractor_id IS NULL
     AND (contractor_name IS NULL OR length(trim(contractor_name)) = 0);

  RAISE NOTICE 'mig244 staged: exact=% no_state=% create_new=% covered=%/% null total (% skipped: empty contractor_name)',
    exact_count, no_state_count, create_new_count, covered, total_null, empty_name_skipped;

  IF (covered + empty_name_skipped) < total_null THEN
    RAISE EXCEPTION 'mig244 postcondition failed: covered(%) + skipped(%) < total_null(%)',
      covered, empty_name_skipped, total_null;
  END IF;
END $post$;

COMMIT;
