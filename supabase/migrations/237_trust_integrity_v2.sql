-- 237_trust_integrity_v2.sql
--
-- Trust report integrity v2: six DB-level enforcement layers that make
-- trust_reports drift architecturally hard. Modified from the original
-- spec on two policies after data review:
--   • Summary handling: VERIFY-but-don't-rewrite (regex). LLM-generated
--     paid-tier summaries (555 rows) are preserved when they reference
--     the trust_score number; only drifting summaries are rewritten.
--   • Quorum violations: DEMOTE not REJECT. Score ≥60 without 5+ evidence
--     rows across 3+ source_categories is clamped to 59 + 'HIGH' +
--     requires_re_review=true. No RAISE — keeps the live free-tier write
--     path from breaking on sparse-evidence entities.
--
-- Layers:
--   A. Pure functions (band, confidence, summary template, red_flags extract, quorum)
--   B. verify_trust_report_integrity() BEFORE INSERT OR UPDATE trigger
--   C. trust_report_audit audit table + capture trigger
--   D. detect_trust_report_anomalies() invariant checker
--   E. scan_phoenix_network() forensic detector
--   F. trust_reports_daily_health_check() ops health JSONB
--   G. requires_re_review column + idempotent backfill
--   H. set_change_source(text) RPC helper (attribution best-effort; see Note)
--
-- Note on change_source attribution: supabase-js REST calls each open a
-- separate transaction, so `SET LOCAL app.change_source = ...` from an
-- RPC won't persist into a subsequent .insert(). The helper is included
-- for use from server-side contexts (Edge Functions, plpgsql blocks).
-- Default attribution is 'unknown' until callers are moved into single-
-- transaction RPCs. The audit table captures the change either way.

-- ============================================================
-- LAYER A: Pure functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.band_for_score(p_score INT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT CASE
    WHEN p_score IS NULL THEN NULL
    WHEN p_score >= 75 THEN 'LOW'
    WHEN p_score >= 60 THEN 'MEDIUM'
    WHEN p_score >= 45 THEN 'HIGH'
    ELSE 'CRITICAL'
  END;
$$;

CREATE OR REPLACE FUNCTION public.confidence_for_hit_rate(p_rate NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT CASE
    WHEN p_rate IS NULL OR p_rate < 0.40 THEN 'LOW'
    WHEN p_rate < 0.70 THEN 'MEDIUM'
    ELSE 'HIGH'
  END;
$$;

-- LEAST of two confidence ranks (LOW<MEDIUM<HIGH). NULL passthrough.
CREATE OR REPLACE FUNCTION public.least_confidence(p_a TEXT, p_b TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  WITH ranks AS (
    SELECT CASE p_a WHEN 'LOW' THEN 0 WHEN 'MEDIUM' THEN 1 WHEN 'HIGH' THEN 2 ELSE 1 END AS ra,
           CASE p_b WHEN 'LOW' THEN 0 WHEN 'MEDIUM' THEN 1 WHEN 'HIGH' THEN 2 ELSE 1 END AS rb
  )
  SELECT CASE
    WHEN p_a IS NULL THEN p_b
    WHEN p_b IS NULL THEN p_a
    WHEN ra <= rb THEN p_a
    ELSE p_b
  END FROM ranks;
$$;

CREATE OR REPLACE FUNCTION public.build_trust_summary_text(
  p_score INT, p_risk TEXT, p_red_n INT, p_pos_n INT
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT CASE
    WHEN p_score IS NULL THEN
      'Insufficient public records to score this entity. Verify directly with state.'
    WHEN p_risk = 'CRITICAL' THEN
      format('Trust score %s/100 — CRITICAL risk. %s red flag(s) on record. Recommend caution before contracting.', p_score, p_red_n)
    WHEN p_risk = 'HIGH' THEN
      format('Trust score %s/100 — HIGH risk. %s red flag(s) and %s positive indicator(s) on record.', p_score, p_red_n, p_pos_n)
    WHEN p_risk = 'MEDIUM' THEN
      format('Trust score %s/100 — MEDIUM risk. %s red flag(s) and %s positive indicator(s) on record.', p_score, p_red_n, p_pos_n)
    WHEN p_risk = 'LOW' THEN
      format('Trust score %s/100 — verified active operator. %s positive indicator(s) on record.', p_score, p_pos_n)
    ELSE
      format('Trust score %s/100.', p_score)
  END;
$$;

-- Map finding_types → human-readable red flag strings. Templated; never
-- trusts externally-supplied prose. Deduplicates, returns severity-ordered.
CREATE OR REPLACE FUNCTION public.extract_red_flags_from_evidence(p_job_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_result TEXT[] := '{}';
  v_severity_map JSONB := jsonb_build_object(
    'sanction_hit',                    jsonb_build_array(0, 'Federal exclusion or sanction on record'),
    'osha_fatality_finding',           jsonb_build_array(1, 'OSHA fatality finding on record'),
    'license_revoked_but_operating',   jsonb_build_array(2, 'License revoked but entity may still operate'),
    'license_revoked',                 jsonb_build_array(3, 'Occupational license revoked'),
    'license_suspended',               jsonb_build_array(4, 'Occupational license suspended'),
    'business_dissolved',              jsonb_build_array(5, 'Business entity dissolved or no longer operating'),
    'business_inactive',               jsonb_build_array(6, 'Business entity inactive in state registry'),
    'business_not_found',              jsonb_build_array(7, 'Business entity not found in state registry'),
    'osha_willful_citation',           jsonb_build_array(8, 'OSHA willful safety citation on record'),
    'osha_repeat_citation',            jsonb_build_array(9, 'OSHA repeat safety citation on record'),
    'license_disciplinary_action',     jsonb_build_array(10, 'Occupational license under disciplinary action'),
    'phoenix_signal',                  jsonb_build_array(11, 'Possible phoenix-entity pattern detected'),
    'legal_judgment_against',          jsonb_build_array(12, 'Civil judgment on record against entity'),
    'civil_judgment_against',          jsonb_build_array(13, 'Civil judgment on record against entity'),
    'mechanic_lien_filed',             jsonb_build_array(14, 'Unresolved mechanic lien filed against entity'),
    'license_expired',                 jsonb_build_array(15, 'Occupational license expired')
  );
BEGIN
  IF p_job_id IS NULL THEN
    RETURN '{}';
  END IF;

  SELECT array_agg(DISTINCT v_severity_map->finding_type->>1 ORDER BY v_severity_map->finding_type->>1)
  INTO v_result
  FROM (
    SELECT DISTINCT finding_type
    FROM trust_evidence
    WHERE job_id = p_job_id
      AND v_severity_map ? finding_type
  ) sub;

  RETURN COALESCE(v_result, '{}');
END;
$$;

CREATE OR REPLACE FUNCTION public.source_quorum_satisfied(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT CASE
    WHEN p_job_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM (
        SELECT COUNT(*) AS evidence_rows,
               COUNT(DISTINCT tsr.source_category) AS distinct_cats
        FROM trust_evidence te
        LEFT JOIN trust_source_registry tsr ON tsr.source_key = te.source_key
        WHERE te.job_id = p_job_id
          AND te.finding_type NOT IN ('source_error', 'source_not_applicable')
      ) s
      WHERE s.evidence_rows >= 5 AND s.distinct_cats >= 3
    )
  END;
$$;

-- ============================================================
-- LAYER G (part 1): Add requires_re_review column FIRST so trigger can write it.
-- ============================================================

ALTER TABLE trust_reports ADD COLUMN IF NOT EXISTS requires_re_review BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_trust_reports_re_review
  ON trust_reports (requires_re_review) WHERE requires_re_review = TRUE;

-- ============================================================
-- LAYER B: verify_trust_report_integrity() trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_trust_report_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_red_n INT;
  v_pos_n INT;
  v_extracted_red TEXT[];
  v_summary_mentions_score BOOLEAN;
BEGIN
  -- Step 1: NULL-score short-circuit (entity_not_found, disambiguation, failed)
  IF NEW.trust_score IS NULL THEN
    NEW.risk_level := NULL;
    NEW.summary := COALESCE(NEW.summary, build_trust_summary_text(NULL, NULL, 0, 0));
    -- Don't overwrite a richer null-score summary if one was supplied
    IF NEW.summary IS NULL OR length(trim(NEW.summary)) = 0 THEN
      NEW.summary := build_trust_summary_text(NULL, NULL, 0, 0);
    END IF;
    RETURN NEW;
  END IF;

  -- Step 2: Force risk_level to band (unconditional override — display
  -- consistency is non-negotiable)
  NEW.risk_level := band_for_score(NEW.trust_score::INT);

  -- Step 3: Source quorum gate. DEMOTE, don't REJECT. Score ≥60 without
  -- 5+ evidence rows across 3+ source_categories gets clamped to 59 +
  -- HIGH + requires_re_review. Live writes keep working; anomaly detector
  -- + ops dashboard surface the demotions for review.
  IF NEW.trust_score >= 60 AND NOT source_quorum_satisfied(NEW.job_id) THEN
    NEW.trust_score := 59;
    NEW.risk_level := 'HIGH';
    NEW.requires_re_review := TRUE;
  END IF;

  -- Step 4: Red_flags non-empty for <60 scores. Auto-extract from
  -- evidence as a fallback when the caller didn't populate. If extract
  -- comes back empty too, mark for re-review (don't reject).
  IF NEW.trust_score < 60 AND cardinality(COALESCE(NEW.red_flags, '{}')) = 0 THEN
    v_extracted_red := extract_red_flags_from_evidence(NEW.job_id);
    IF cardinality(v_extracted_red) > 0 THEN
      NEW.red_flags := v_extracted_red;
    ELSE
      NEW.requires_re_review := TRUE;
    END IF;
  END IF;

  -- Step 5: Confidence floor — downgrade to match structured_source_hit_rate
  IF NEW.structured_source_hit_rate IS NOT NULL THEN
    NEW.confidence_level := least_confidence(
      NEW.confidence_level,
      confidence_for_hit_rate(NEW.structured_source_hit_rate)
    );
  END IF;

  -- Step 6: Summary verify-but-don't-rewrite. Preserves LLM-generated
  -- paid-tier summaries when they correctly reference the score. Only
  -- rewrites drifting summaries (e.g., the 16 mig-235 backfill cases).
  -- Heuristic: trust_score digits must appear word-bounded in the first
  -- 240 characters of summary. False positives (e.g., score=5 matching
  -- "5 violations") favor preserving the LLM summary; that's the right
  -- bias since the trigger is meant to catch drift, not police LLM prose.
  v_red_n := cardinality(COALESCE(NEW.red_flags, '{}'));
  v_pos_n := cardinality(COALESCE(NEW.positive_indicators, '{}'));

  v_summary_mentions_score := COALESCE(
    substring(COALESCE(NEW.summary, '') for 240) ~ ('\m' || NEW.trust_score::TEXT || '\M'),
    FALSE
  );

  IF NOT v_summary_mentions_score THEN
    NEW.summary := build_trust_summary_text(NEW.trust_score::INT, NEW.risk_level, v_red_n, v_pos_n);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trust_reports_integrity_v2 ON trust_reports;
CREATE TRIGGER trust_reports_integrity_v2
  BEFORE INSERT OR UPDATE OF trust_score, risk_level, summary, red_flags,
                              positive_indicators, confidence_level,
                              structured_source_hit_rate
  ON trust_reports
  FOR EACH ROW EXECUTE FUNCTION verify_trust_report_integrity();

-- ============================================================
-- LAYER C: trust_report_audit audit + capture trigger
-- ============================================================

CREATE TABLE IF NOT EXISTS public.trust_report_audit (
  id                 BIGSERIAL PRIMARY KEY,
  report_id          UUID REFERENCES trust_reports(id) ON DELETE CASCADE,
  job_id             UUID,
  contractor_name    TEXT,
  trust_score_before SMALLINT,
  trust_score_after  SMALLINT,
  risk_level_before  TEXT,
  risk_level_after   TEXT,
  summary_before     TEXT,
  summary_after      TEXT,
  red_flags_before   TEXT[],
  red_flags_after    TEXT[],
  change_source      TEXT NOT NULL DEFAULT 'unknown',
  changed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_report ON trust_report_audit (report_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_name   ON trust_report_audit (contractor_name, changed_at DESC);

CREATE OR REPLACE FUNCTION public.capture_trust_report_score_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF (NEW.trust_score IS DISTINCT FROM OLD.trust_score)
     OR (NEW.risk_level IS DISTINCT FROM OLD.risk_level)
     OR (NEW.summary IS DISTINCT FROM OLD.summary)
     OR (NEW.red_flags IS DISTINCT FROM OLD.red_flags) THEN
    INSERT INTO trust_report_audit (
      report_id, job_id, contractor_name,
      trust_score_before, trust_score_after,
      risk_level_before, risk_level_after,
      summary_before, summary_after,
      red_flags_before, red_flags_after,
      change_source
    ) VALUES (
      NEW.id, NEW.job_id, NEW.contractor_name,
      OLD.trust_score, NEW.trust_score,
      OLD.risk_level, NEW.risk_level,
      OLD.summary, NEW.summary,
      OLD.red_flags, NEW.red_flags,
      COALESCE(current_setting('app.change_source', TRUE), 'unknown')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trust_reports_audit_capture ON trust_reports;
CREATE TRIGGER trust_reports_audit_capture
  AFTER UPDATE ON trust_reports
  FOR EACH ROW EXECUTE FUNCTION capture_trust_report_score_change();

-- ============================================================
-- LAYER D: detect_trust_report_anomalies()
-- ============================================================

CREATE OR REPLACE FUNCTION public.detect_trust_report_anomalies(
  p_lookback INTERVAL DEFAULT '7 days'
)
RETURNS TABLE (
  report_id    UUID,
  contractor_name TEXT,
  anomaly_type TEXT,
  severity     TEXT,
  detail       JSONB
)
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  WITH window_rows AS (
    SELECT * FROM trust_reports
    WHERE created_at >= NOW() - p_lookback
  )
  -- HIGH_SCORE_INACTIVE_BIZ: score ≥60 but biz_status indicates non-operating
  SELECT id, contractor_name, 'HIGH_SCORE_INACTIVE_BIZ' AS anomaly_type, 'CRITICAL' AS severity,
         jsonb_build_object('trust_score', trust_score, 'biz_status', biz_status)
  FROM window_rows
  WHERE trust_score >= 60
    AND biz_status IN ('Inactive', 'Delinquent', 'Dissolved', 'Forfeited', 'Not Found')

  UNION ALL
  -- SUMMARY_SCORE_DRIFT: trust_score number not present in first 240 chars of summary
  SELECT id, contractor_name, 'SUMMARY_SCORE_DRIFT', 'WARN',
         jsonb_build_object('trust_score', trust_score, 'summary_head', substring(summary for 240))
  FROM window_rows
  WHERE trust_score IS NOT NULL
    AND COALESCE(substring(summary for 240), '') !~ ('\m' || trust_score::TEXT || '\M')

  UNION ALL
  -- RISK_BAND_MISMATCH: risk_level doesn't match band_for_score
  SELECT id, contractor_name, 'RISK_BAND_MISMATCH', 'WARN',
         jsonb_build_object('trust_score', trust_score, 'risk_level', risk_level, 'expected', band_for_score(trust_score::INT))
  FROM window_rows
  WHERE trust_score IS NOT NULL
    AND risk_level IS DISTINCT FROM band_for_score(trust_score::INT)

  UNION ALL
  -- LOW_CONFIDENCE_HIGH_SCORE
  SELECT id, contractor_name, 'LOW_CONFIDENCE_HIGH_SCORE', 'WARN',
         jsonb_build_object('trust_score', trust_score, 'hit_rate', structured_source_hit_rate)
  FROM window_rows
  WHERE trust_score >= 75
    AND structured_source_hit_rate IS NOT NULL
    AND structured_source_hit_rate < 0.50

  UNION ALL
  -- MISSING_QUORUM_HIGH_SCORE
  SELECT id, contractor_name, 'MISSING_QUORUM_HIGH_SCORE', 'CRITICAL',
         jsonb_build_object('trust_score', trust_score, 'job_id', job_id)
  FROM window_rows
  WHERE trust_score >= 60
    AND NOT source_quorum_satisfied(job_id)

  UNION ALL
  -- EMPTY_FLAGS_LOW_SCORE
  SELECT id, contractor_name, 'EMPTY_FLAGS_LOW_SCORE', 'WARN',
         jsonb_build_object('trust_score', trust_score, 'red_flags_len', cardinality(COALESCE(red_flags, '{}')))
  FROM window_rows
  WHERE trust_score < 60
    AND cardinality(COALESCE(red_flags, '{}')) = 0

  UNION ALL
  -- PHOENIX_SIGNAL_PRESENT: evidence has phoenix_signal but report contractor_id is null
  SELECT wr.id, wr.contractor_name, 'PHOENIX_SIGNAL_PRESENT', 'CRITICAL',
         jsonb_build_object('job_id', wr.job_id, 'phoenix_count', (SELECT COUNT(*) FROM trust_evidence WHERE job_id = wr.job_id AND finding_type = 'phoenix_signal'))
  FROM window_rows wr
  WHERE wr.contractor_id IS NULL
    AND EXISTS (SELECT 1 FROM trust_evidence WHERE job_id = wr.job_id AND finding_type = 'phoenix_signal');
$$;

-- ============================================================
-- LAYER E: scan_phoenix_network() + normalization helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_phone(p TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    WHEN length(regexp_replace(p, '\D', '', 'g')) = 0 THEN NULL
    ELSE right(regexp_replace(p, '\D', '', 'g'), 10)
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_address(a TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT CASE
    WHEN a IS NULL OR length(trim(a)) = 0 THEN NULL
    ELSE regexp_replace(
      regexp_replace(
        regexp_replace(lower(trim(a)), '[^a-z0-9 ]', ' ', 'g'),
        '\m(street|str|st)\M', 'st', 'g'),
      '\s+', ' ', 'g')
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_person(n TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT CASE
    WHEN n IS NULL OR length(trim(n)) = 0 THEN NULL
    ELSE regexp_replace(
      regexp_replace(lower(trim(n)), '\s+[a-z]\.?\s+', ' ', 'g'),
      '\s+', ' ', 'g')
  END;
$$;

CREATE OR REPLACE FUNCTION public.scan_phoenix_network(p_window INTERVAL DEFAULT '90 days')
RETURNS TABLE (
  cluster_id        TEXT,
  contractor_names  TEXT[],
  shared_attribute  TEXT,
  attribute_value   TEXT,
  job_ids           UUID[],
  member_count      INT,
  combined_risk     TEXT
)
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  WITH window_evidence AS (
    SELECT te.job_id, tr.contractor_name,
           normalize_address(te.extracted_facts->>'principal_address') AS addr,
           normalize_address(te.extracted_facts->>'address') AS addr2,
           normalize_phone(te.extracted_facts->>'phone') AS phone,
           normalize_person(te.extracted_facts->>'registered_agent_organization') AS agent_org,
           normalize_person(te.extracted_facts->>'registered_agent') AS agent
    FROM trust_evidence te
    JOIN trust_reports tr ON tr.job_id = te.job_id
    WHERE te.pulled_at >= NOW() - p_window
  ),
  officers AS (
    SELECT te.job_id, tr.contractor_name,
           normalize_person(officer->>'name') AS officer_name
    FROM trust_evidence te
    JOIN trust_reports tr ON tr.job_id = te.job_id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(te.extracted_facts->'officers', '[]'::jsonb)) AS officer
    WHERE te.pulled_at >= NOW() - p_window
  ),
  by_address AS (
    SELECT 'addr:' || addr AS cluster_id,
           array_agg(DISTINCT contractor_name ORDER BY contractor_name) AS contractor_names,
           'principal_address' AS shared_attribute,
           addr AS attribute_value,
           array_agg(DISTINCT job_id) AS job_ids,
           COUNT(DISTINCT contractor_name)::INT AS member_count
    FROM window_evidence
    WHERE addr IS NOT NULL
    GROUP BY addr
    HAVING COUNT(DISTINCT contractor_name) >= 2
  ),
  by_phone AS (
    SELECT 'phone:' || phone, array_agg(DISTINCT contractor_name ORDER BY contractor_name),
           'phone', phone, array_agg(DISTINCT job_id), COUNT(DISTINCT contractor_name)::INT
    FROM window_evidence
    WHERE phone IS NOT NULL
    GROUP BY phone
    HAVING COUNT(DISTINCT contractor_name) >= 2
  ),
  by_agent AS (
    SELECT 'agent:' || COALESCE(agent_org, agent), array_agg(DISTINCT contractor_name ORDER BY contractor_name),
           'registered_agent', COALESCE(agent_org, agent), array_agg(DISTINCT job_id), COUNT(DISTINCT contractor_name)::INT
    FROM window_evidence
    WHERE COALESCE(agent_org, agent) IS NOT NULL
    GROUP BY COALESCE(agent_org, agent)
    HAVING COUNT(DISTINCT contractor_name) >= 2
  ),
  by_officer AS (
    SELECT 'officer:' || officer_name, array_agg(DISTINCT contractor_name ORDER BY contractor_name),
           'officer', officer_name, array_agg(DISTINCT job_id), COUNT(DISTINCT contractor_name)::INT
    FROM officers
    WHERE officer_name IS NOT NULL
    GROUP BY officer_name
    HAVING COUNT(DISTINCT contractor_name) >= 2
  ),
  unioned AS (
    SELECT * FROM by_address
    UNION ALL SELECT * FROM by_phone
    UNION ALL SELECT * FROM by_agent
    UNION ALL SELECT * FROM by_officer
  )
  SELECT u.cluster_id, u.contractor_names, u.shared_attribute, u.attribute_value, u.job_ids, u.member_count,
         (SELECT CASE
            WHEN bool_or(tr.risk_level = 'CRITICAL') THEN 'CRITICAL'
            WHEN bool_or(tr.risk_level = 'HIGH') THEN 'HIGH'
            WHEN bool_or(tr.risk_level = 'MEDIUM') THEN 'MEDIUM'
            WHEN bool_or(tr.risk_level = 'LOW') THEN 'LOW'
            ELSE NULL
          END
          FROM trust_reports tr WHERE tr.job_id = ANY(u.job_ids)) AS combined_risk
  FROM unioned u;
$$;

-- ============================================================
-- LAYER F: trust_reports_daily_health_check()
-- ============================================================

CREATE OR REPLACE FUNCTION public.trust_reports_daily_health_check()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT jsonb_build_object(
    'as_of', NOW(),
    'reports_24h', (SELECT COUNT(*) FROM trust_reports WHERE created_at >= NOW() - INTERVAL '24 hours'),
    'score_distribution_24h', (
      SELECT jsonb_build_object(
        'LOW',      COUNT(*) FILTER (WHERE risk_level = 'LOW'),
        'MEDIUM',   COUNT(*) FILTER (WHERE risk_level = 'MEDIUM'),
        'HIGH',     COUNT(*) FILTER (WHERE risk_level = 'HIGH'),
        'CRITICAL', COUNT(*) FILTER (WHERE risk_level = 'CRITICAL'),
        'NULL',     COUNT(*) FILTER (WHERE risk_level IS NULL)
      )
      FROM trust_reports WHERE created_at >= NOW() - INTERVAL '24 hours'
    ),
    'anomalies_detected', (SELECT COUNT(*) FROM detect_trust_report_anomalies('24 hours'::INTERVAL)),
    'phoenix_clusters_detected', (SELECT COUNT(*) FROM scan_phoenix_network('30 days'::INTERVAL)),
    'requires_re_review_count', (SELECT COUNT(*) FROM trust_reports WHERE requires_re_review = TRUE),
    'templated_evidence_derived_24h', (
      SELECT COUNT(*) FROM trust_reports
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND synthesis_model = 'templated_evidence_derived'
    ),
    'top_anomalies', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT report_id, contractor_name, anomaly_type, severity, detail
        FROM detect_trust_report_anomalies('24 hours'::INTERVAL)
        ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'WARN' THEN 1 ELSE 2 END
        LIMIT 10
      ) t
    )
  );
$$;

-- ============================================================
-- LAYER H: set_change_source RPC helper (best-effort; see header note)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_change_source(p_source TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  PERFORM set_config('app.change_source', p_source, TRUE);
END;
$$;

-- ============================================================
-- LAYER G (part 2): Backfill — fire trigger on every row via UPDATE.
-- SAVEPOINT-guarded so a single row's failure flags requires_re_review
-- instead of blocking the migration.
-- ============================================================

DO $$
DECLARE
  r RECORD;
  rows_clean INT := 0;
  rows_reviewed INT := 0;
  rows_failed INT := 0;
BEGIN
  PERFORM set_config('app.change_source', 'migration-237-backfill', TRUE);

  FOR r IN
    SELECT id FROM trust_reports ORDER BY created_at DESC
  LOOP
    BEGIN
      -- Touch summary to force the integrity trigger to fire. The trigger
      -- itself decides whether to rewrite, demote, or flag the row.
      UPDATE trust_reports
      SET summary = summary
      WHERE id = r.id;
      rows_clean := rows_clean + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Defensive: any unexpected error → flag for review, don't fail migration
      BEGIN
        UPDATE trust_reports SET requires_re_review = TRUE WHERE id = r.id;
        rows_reviewed := rows_reviewed + 1;
      EXCEPTION WHEN OTHERS THEN
        rows_failed := rows_failed + 1;
      END;
    END;
  END LOOP;

  RAISE NOTICE 'mig 237 backfill: % clean, % flagged for review, % failed', rows_clean, rows_reviewed, rows_failed;
END $$;

-- ============================================================
-- COMMENTS & GRANTS
-- ============================================================

COMMENT ON TRIGGER trust_reports_integrity_v2 ON trust_reports IS
  'Mandatory integrity invariants: risk_level=band(score), summary references score (else rewritten), red_flags non-empty when score<60 (auto-extracted from evidence as fallback), score≥60 without source quorum demoted to 59/HIGH/requires_re_review. NULL-score rows skipped. Cannot be bypassed.';

COMMENT ON TRIGGER trust_reports_audit_capture ON trust_reports IS
  'Captures every change to trust_score/risk_level/summary/red_flags into trust_report_audit with before/after + change_source from app.change_source session var.';

COMMENT ON FUNCTION band_for_score IS 'Pure function — score → risk band. NULL passthrough.';
COMMENT ON FUNCTION confidence_for_hit_rate IS 'Pure function — structured_source_hit_rate → confidence_level.';
COMMENT ON FUNCTION build_trust_summary_text IS 'Pure function — score+risk+counts → templated summary string. Source of truth for templated summaries; TS twin in src/lib/trust/summary-template.ts must stay in sync.';
COMMENT ON FUNCTION extract_red_flags_from_evidence IS 'Pure function — job_id → severity-ordered red_flag strings derived from trust_evidence finding_types.';
COMMENT ON FUNCTION source_quorum_satisfied IS 'Pure function — TRUE iff job has ≥5 evidence rows across ≥3 source_categories.';
COMMENT ON FUNCTION verify_trust_report_integrity IS 'BEFORE INSERT OR UPDATE trigger fn on trust_reports. Enforces 6 invariants; demotes (not rejects) on quorum failure.';
COMMENT ON FUNCTION detect_trust_report_anomalies IS 'Returns rows violating integrity invariants within p_lookback. Designed for daily ops dashboard.';
COMMENT ON FUNCTION scan_phoenix_network IS 'Forensic phoenix detector — groups contractor entities by shared normalized address/phone/agent/officer in trust_evidence.extracted_facts. Works without contractor_id wiring.';
COMMENT ON FUNCTION trust_reports_daily_health_check IS 'Returns ops health snapshot JSONB. Designed for Inngest cron → Slack/SMS.';

GRANT EXECUTE ON FUNCTION band_for_score(INT)                    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION confidence_for_hit_rate(NUMERIC)       TO authenticated, anon;
GRANT EXECUTE ON FUNCTION build_trust_summary_text(INT, TEXT, INT, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION extract_red_flags_from_evidence(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION source_quorum_satisfied(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION detect_trust_report_anomalies(INTERVAL) TO authenticated;
GRANT EXECUTE ON FUNCTION scan_phoenix_network(INTERVAL)         TO authenticated;
GRANT EXECUTE ON FUNCTION trust_reports_daily_health_check()     TO service_role;
GRANT EXECUTE ON FUNCTION set_change_source(TEXT)                TO authenticated, service_role;
