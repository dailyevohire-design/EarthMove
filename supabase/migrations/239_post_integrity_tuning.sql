-- ============================================================
-- Migration 239: post-integrity tuning
-- 1. detect_trust_report_anomalies — SUMMARY_SCORE_DRIFT switches to fuzzy
--    regex matching the trigger's logic (eliminates 42 false-positives on
--    LLM-written "45.6/100" rows when integer column shows 46).
-- 2. detect_trust_report_anomalies — EMPTY_FLAGS_LOW_SCORE excludes rows
--    already flagged requires_re_review (quorum-demoted rows have legitimately
--    empty red_flags — that's the by-design clamp, not anomaly).
-- 3. least_confidence — accepts any case (defense-in-depth against future
--    code paths writing lowercase 'medium'/'high'/'low').
-- All function bodies idempotent via CREATE OR REPLACE.
-- ============================================================

CREATE OR REPLACE FUNCTION public.detect_trust_report_anomalies(p_lookback interval DEFAULT '7 days'::interval)
 RETURNS TABLE(report_id uuid, contractor_name text, anomaly_type text, severity text, detail jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  WITH window_rows AS (
    SELECT * FROM trust_reports WHERE created_at >= NOW() - p_lookback
  ),
  summary_score_match AS (
    SELECT wr.id,
           bool_or(abs((m.match[1])::numeric - wr.trust_score::numeric) <= 2.0) AS has_fuzzy_match
    FROM window_rows wr
    LEFT JOIN LATERAL regexp_matches(COALESCE(wr.summary, ''), '([0-9]{1,3}(?:\.[0-9]+)?)\s*/\s*100', 'g') AS m(match) ON TRUE
    WHERE wr.trust_score IS NOT NULL
    GROUP BY wr.id
  )
  SELECT id, contractor_name, 'HIGH_SCORE_INACTIVE_BIZ'::TEXT, 'CRITICAL'::TEXT,
         jsonb_build_object('trust_score', trust_score, 'biz_status', biz_status)
  FROM window_rows WHERE trust_score >= 60 AND biz_status IN ('Inactive','Delinquent','Dissolved','Forfeited','Not Found')
  UNION ALL
  SELECT wr.id, wr.contractor_name, 'SUMMARY_SCORE_DRIFT'::TEXT, 'WARN'::TEXT,
         jsonb_build_object('trust_score', wr.trust_score, 'summary_head', substring(wr.summary for 240))
  FROM window_rows wr
  LEFT JOIN summary_score_match sm ON sm.id = wr.id
  WHERE wr.trust_score IS NOT NULL
    AND COALESCE(sm.has_fuzzy_match, FALSE) = FALSE
  UNION ALL
  SELECT id, contractor_name, 'RISK_BAND_MISMATCH'::TEXT, 'WARN'::TEXT,
         jsonb_build_object('trust_score', trust_score, 'risk_level', risk_level, 'expected', band_for_score(trust_score::INT))
  FROM window_rows WHERE trust_score IS NOT NULL AND risk_level IS DISTINCT FROM band_for_score(trust_score::INT)
  UNION ALL
  SELECT id, contractor_name, 'LOW_CONFIDENCE_HIGH_SCORE'::TEXT, 'WARN'::TEXT,
         jsonb_build_object('trust_score', trust_score, 'hit_rate', structured_source_hit_rate)
  FROM window_rows WHERE trust_score >= 75 AND structured_source_hit_rate IS NOT NULL AND structured_source_hit_rate < 0.50
  UNION ALL
  SELECT id, contractor_name, 'MISSING_QUORUM_HIGH_SCORE'::TEXT, 'CRITICAL'::TEXT,
         jsonb_build_object('trust_score', trust_score, 'job_id', job_id)
  FROM window_rows WHERE trust_score >= 60 AND NOT source_quorum_satisfied(job_id)
  UNION ALL
  SELECT id, contractor_name, 'EMPTY_FLAGS_LOW_SCORE'::TEXT, 'WARN'::TEXT,
         jsonb_build_object('trust_score', trust_score, 'red_flags_len', cardinality(COALESCE(red_flags, '{}')))
  FROM window_rows
  WHERE trust_score < 60
    AND cardinality(COALESCE(red_flags, '{}')) = 0
    AND COALESCE(requires_re_review, FALSE) = FALSE
  UNION ALL
  SELECT wr.id, wr.contractor_name, 'PHOENIX_SIGNAL_PRESENT'::TEXT, 'CRITICAL'::TEXT,
         jsonb_build_object('job_id', wr.job_id, 'phoenix_count', (SELECT COUNT(*) FROM trust_evidence WHERE job_id = wr.job_id AND finding_type = 'phoenix_signal'))
  FROM window_rows wr WHERE wr.contractor_id IS NULL
    AND EXISTS (SELECT 1 FROM trust_evidence WHERE job_id = wr.job_id AND finding_type = 'phoenix_signal');
$function$;

CREATE OR REPLACE FUNCTION public.least_confidence(p_a text, p_b text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  WITH normalized AS (
    SELECT UPPER(BTRIM(p_a)) AS na, UPPER(BTRIM(p_b)) AS nb
  ),
  ranks AS (
    SELECT na, nb,
           CASE na WHEN 'LOW' THEN 0 WHEN 'MEDIUM' THEN 1 WHEN 'HIGH' THEN 2 ELSE 1 END AS ra,
           CASE nb WHEN 'LOW' THEN 0 WHEN 'MEDIUM' THEN 1 WHEN 'HIGH' THEN 2 ELSE 1 END AS rb
    FROM normalized
  )
  SELECT CASE
    WHEN p_a IS NULL THEN (SELECT nb FROM normalized)
    WHEN p_b IS NULL THEN (SELECT na FROM normalized)
    WHEN ra <= rb THEN na
    ELSE nb
  END FROM ranks;
$function$;
