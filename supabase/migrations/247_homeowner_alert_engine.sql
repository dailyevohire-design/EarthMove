-- 247_homeowner_alert_engine.sql
-- Closes the loop: signal-detection (mig 242-246) → homeowner-facing red flags.
-- All data tonight's migrations produced becomes plain-English consumer alerts
-- via compute_homeowner_alerts(contractor_id).

BEGIN;

DO $pre$
DECLARE
  has_peer_findings bool;
  has_contractors bool;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='trust_peer_network_findings') INTO has_peer_findings;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='contractors') INTO has_contractors;
  IF NOT has_peer_findings THEN
    RAISE EXCEPTION 'mig247 precondition: trust_peer_network_findings required (mig 246)';
  END IF;
  IF NOT has_contractors THEN
    RAISE EXCEPTION 'mig247 precondition: contractors required';
  END IF;
END $pre$;

-- ─── Materialized view: one row per real contractor with all derived signals ─
DROP MATERIALIZED VIEW IF EXISTS contractor_risk_facets;
CREATE MATERIALIZED VIEW contractor_risk_facets AS
WITH report_agg AS (
  SELECT
    r.contractor_id,
    min(CASE
      WHEN r.biz_formation_date ~ '^\d{4}-\d{2}-\d{2}'
        THEN substring(r.biz_formation_date, 1, 10)::date
      WHEN r.biz_formation_date ~ '^\d{2}/\d{2}/\d{4}'
        THEN to_date(substring(r.biz_formation_date, 1, 10), 'MM/DD/YYYY')
      ELSE NULL
    END) AS earliest_parsed_formation,
    bool_or(r.biz_formation_date ~ '^\d{4}-\d{2}-\d{2}'
         OR r.biz_formation_date ~ '^\d{2}/\d{2}/\d{4}') AS has_parseable_formation_date,
    (array_agg(r.biz_status ORDER BY r.created_at DESC)
       FILTER (WHERE r.biz_status IS NOT NULL))[1] AS canonical_biz_status,
    bool_or(r.risk_level = 'CRITICAL') AS has_critical_report,
    min(r.trust_score) AS min_trust_score,
    count(*) AS report_count
  FROM trust_reports r
  WHERE r.contractor_id IS NOT NULL
    AND r.contractor_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
  GROUP BY r.contractor_id
),
evidence_agg AS (
  SELECT
    tr.contractor_id,
    bool_or(
      te.finding_type IN ('business_not_found','business_dissolved','business_inactive')
        AND te.confidence IN ('verified_structured','high_llm')
    ) AS evidence_of_no_or_dissolved_state_record
  FROM trust_evidence te
  JOIN trust_reports tr ON tr.job_id = te.job_id
  WHERE tr.contractor_id IS NOT NULL
    AND tr.contractor_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
  GROUP BY tr.contractor_id
),
peer_agg AS (
  SELECT
    contractor_id,
    count(*) AS peer_finding_count,
    count(*) FILTER (WHERE signal_type='shared_officer') AS shared_officer_count,
    count(*) FILTER (WHERE signal_type='name_similarity' AND signal_strength >= 0.70) AS strong_name_similarity_count
  FROM (
    SELECT contractor_id, signal_type, signal_strength FROM trust_peer_network_findings
    UNION ALL
    SELECT peer_contractor_id, signal_type, signal_strength FROM trust_peer_network_findings
  ) bi
  GROUP BY contractor_id
)
SELECT
  c.id AS contractor_id,
  c.legal_name,
  c.normalized_name,
  c.state_code::text AS state_code,
  c.city,
  c.first_seen_at AS gc_first_seen,
  ra.earliest_parsed_formation,
  COALESCE(ra.has_parseable_formation_date, false) AS has_parseable_formation_date,
  ra.canonical_biz_status,
  COALESCE(ea.evidence_of_no_or_dissolved_state_record, false) AS evidence_of_no_or_dissolved_state_record,
  COALESCE(ra.report_count, 0) > 0 AS has_report,
  ra.min_trust_score,
  COALESCE(ra.has_critical_report, false) AS has_critical_report,
  COALESCE(pa.peer_finding_count, 0) AS peer_finding_count,
  COALESCE(pa.shared_officer_count, 0) AS shared_officer_count,
  COALESCE(pa.strong_name_similarity_count, 0) AS strong_name_similarity_count
FROM contractors c
LEFT JOIN report_agg ra ON ra.contractor_id = c.id
LEFT JOIN evidence_agg ea ON ea.contractor_id = c.id
LEFT JOIN peer_agg pa ON pa.contractor_id = c.id
WHERE c.legal_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)';

CREATE UNIQUE INDEX idx_crf_contractor_id ON contractor_risk_facets (contractor_id);
CREATE INDEX idx_crf_state             ON contractor_risk_facets (state_code);
CREATE INDEX idx_crf_high_risk         ON contractor_risk_facets (contractor_id)
  WHERE has_critical_report OR evidence_of_no_or_dissolved_state_record OR shared_officer_count > 0;

COMMENT ON MATERIALIZED VIEW contractor_risk_facets IS
  'Per-contractor aggregated risk signals derived from contractors, trust_reports, trust_evidence, and trust_peer_network_findings. Refresh via refresh_contractor_risk_facets(). Read by compute_homeowner_alerts().';

-- ─── The homeowner-facing alert engine ───────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_homeowner_alerts(p_contractor_id uuid)
RETURNS TABLE (
  alert_code    text,
  severity      text,
  headline      text,
  body          text,
  evidence_hint text,
  detected_at   timestamptz
)
LANGUAGE plpgsql STABLE
SET search_path TO 'pg_catalog','public'
AS $func$
DECLARE
  f RECORD;
  age_days int;
  anchor_name text;
  anchor_age_years int;
BEGIN
  SELECT * INTO f FROM contractor_risk_facets WHERE contractor_id = p_contractor_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- CRITICAL: No verifiable state registration
  IF f.evidence_of_no_or_dissolved_state_record AND NOT f.has_parseable_formation_date THEN
    alert_code    := 'NO_VERIFIABLE_STATE_REGISTRATION';
    severity      := 'CRITICAL';
    headline      := 'No state business registration on file';
    body          := 'Groundcheck could not verify a current business registration for "' || f.legal_name ||
                     '" with the ' || f.state_code || ' Secretary of State. Construction businesses in ' ||
                     f.state_code || ' are required to register. Before signing or paying a deposit, ask the contractor for their state entity ID and verify it directly with the Secretary of State.';
    evidence_hint := 'Search the ' || f.state_code || ' Secretary of State business database for the exact entity name.';
    detected_at   := now();
    RETURN NEXT;
  END IF;

  -- CRITICAL: Dissolved / inactive entity
  IF f.canonical_biz_status IS NOT NULL
     AND lower(f.canonical_biz_status) ~ 'dissol|forfeit|inactive|cancel|delinquent' THEN
    alert_code    := 'DISSOLVED_OR_INACTIVE_ENTITY';
    severity      := 'CRITICAL';
    headline      := 'State records list this business as ' || f.canonical_biz_status;
    body          := '"' || f.legal_name || '" currently shows a status of ' || f.canonical_biz_status ||
                     ' in ' || f.state_code || ' Secretary of State records. Doing business with a dissolved or delinquent entity removes most consumer recourse — a contract you sign may be unenforceable, and the business may not legally exist to take responsibility if work goes wrong.';
    evidence_hint := f.state_code || ' Secretary of State public records.';
    detected_at   := now();
    RETURN NEXT;
  END IF;

  -- CRITICAL: Prior Groundcheck report flagged this entity critical
  IF f.has_critical_report THEN
    alert_code    := 'EXISTING_CRITICAL_RISK_REPORT';
    severity      := 'CRITICAL';
    headline      := 'A previous Groundcheck report flagged this business as CRITICAL risk';
    body          := 'At least one prior trust report on "' || f.legal_name ||
                     '" surfaced a critical-severity finding from public records. See the detailed report below for the underlying evidence.';
    evidence_hint := 'See full trust report on this page.';
    detected_at   := now();
    RETURN NEXT;
  END IF;

  -- HIGH: Name confusingly similar to a longstanding business (this is the killer alert)
  SELECT c.legal_name,
         GREATEST(1, (CURRENT_DATE - peer_facets.earliest_parsed_formation) / 365)
    INTO anchor_name, anchor_age_years
  FROM trust_peer_network_findings pf
  JOIN contractors c
    ON c.id = CASE WHEN pf.contractor_id = p_contractor_id
                   THEN pf.peer_contractor_id ELSE pf.contractor_id END
  JOIN contractor_risk_facets peer_facets ON peer_facets.contractor_id = c.id
  WHERE (pf.contractor_id = p_contractor_id OR pf.peer_contractor_id = p_contractor_id)
    AND pf.signal_type = 'name_similarity'
    AND pf.signal_strength >= 0.65
    AND peer_facets.earliest_parsed_formation IS NOT NULL
    AND peer_facets.earliest_parsed_formation < CURRENT_DATE - INTERVAL '5 years'
    AND (f.earliest_parsed_formation IS NULL
         OR peer_facets.earliest_parsed_formation < f.earliest_parsed_formation - INTERVAL '1 year')
  ORDER BY peer_facets.earliest_parsed_formation ASC
  LIMIT 1;

  IF anchor_name IS NOT NULL THEN
    alert_code    := 'NAME_CONFUSINGLY_SIMILAR_TO_LONGSTANDING_ENTITY';
    severity      := 'HIGH';
    headline      := 'Name is very similar to "' || anchor_name || '" — an established business';
    body          := '"' || f.legal_name || '" has a name confusingly similar to "' || anchor_name ||
                     '", a ' || f.state_code || ' business established ' || anchor_age_years ||
                     '+ years ago. Phoenix-LLC and impersonation scams often operate under names confusingly similar to longstanding legitimate businesses to capture confused traffic. Confirm which entity you are actually about to hire before you pay any deposit. Compare the EIN, license number, and registered address on the quote against the official record.';
    evidence_hint := 'Ask the contractor for their EIN or state entity ID, then look it up directly with the ' || f.state_code || ' Secretary of State.';
    detected_at   := now();
    RETURN NEXT;
  END IF;

  -- HIGH/MEDIUM: Very young entity (feature 5)
  IF f.earliest_parsed_formation IS NOT NULL THEN
    age_days := (CURRENT_DATE - f.earliest_parsed_formation);
    IF age_days < 30 THEN
      alert_code    := 'VERY_YOUNG_ENTITY';
      severity      := 'HIGH';
      headline      := 'Business was registered only ' || age_days || ' days ago';
      body          := '"' || f.legal_name || '" was registered with the ' || f.state_code ||
                       ' Secretary of State on ' || to_char(f.earliest_parsed_formation, 'FMMonth FMDD, YYYY') ||
                       '. Legitimate brand-new businesses do exist — but phoenix-LLC operators create fresh entities specifically to outrun complaint records from prior LLCs they ran. Before paying a deposit, ask the principals for verifiable references to prior work they personally completed (not under this LLC name), and contact those references directly.';
      evidence_hint := 'Request the principals'' personal work history, not the LLC''s.';
      detected_at   := now();
      RETURN NEXT;
    ELSIF age_days < 90 THEN
      alert_code    := 'VERY_YOUNG_ENTITY';
      severity      := 'MEDIUM';
      headline      := 'Business was registered ' || age_days || ' days ago';
      body          := '"' || f.legal_name || '" was registered with the ' || f.state_code ||
                       ' Secretary of State on ' || to_char(f.earliest_parsed_formation, 'FMMonth FMDD, YYYY') ||
                       ' — less than 90 days ago. Not automatically a red flag, but newer than typical for established contractors. Ask for references to prior work under any earlier business name the principals operated, and verify those.';
      evidence_hint := 'Ask whether the principals previously operated under different business names.';
      detected_at   := now();
      RETURN NEXT;
    END IF;
  END IF;

  -- MEDIUM/HIGH: Shares principal with other entities (phoenix detector core)
  IF f.shared_officer_count > 0 THEN
    alert_code    := 'SHARES_PRINCIPAL_WITH_OTHER_ENTITIES';
    severity      := CASE WHEN f.shared_officer_count >= 2 THEN 'HIGH' ELSE 'MEDIUM' END;
    headline      := 'Owner or registered agent is tied to ' || f.shared_officer_count ||
                     ' other ' || f.state_code || ' business' ||
                     (CASE WHEN f.shared_officer_count > 1 THEN 'es' ELSE '' END);
    body          := 'A person listed as principal or registered agent of "' || f.legal_name ||
                     '" is also listed on ' || f.shared_officer_count || ' other ' || f.state_code ||
                     ' business record' || (CASE WHEN f.shared_officer_count > 1 THEN 's' ELSE '' END) ||
                     '. This pattern shows up in two very different situations: (a) legitimate operators who run multiple businesses, and (b) phoenix-LLC fraud where a single operator cycles through a chain of shell entities to outrun complaints. Ask the contractor to disclose their other businesses by name, and check whether any are dissolved or have active consumer complaints.';
    evidence_hint := 'Ask: "What other businesses do you or your registered agent operate in ' || f.state_code || '?"';
    detected_at   := now();
    RETURN NEXT;
  END IF;
END
$func$;

GRANT EXECUTE ON FUNCTION compute_homeowner_alerts(uuid) TO authenticated, anon, service_role;

-- ─── Refresh function for the materialized view ──────────────────────────────
CREATE OR REPLACE FUNCTION refresh_contractor_risk_facets()
RETURNS void
LANGUAGE sql
AS $func$
  REFRESH MATERIALIZED VIEW CONCURRENTLY contractor_risk_facets;
$func$;

GRANT EXECUTE ON FUNCTION refresh_contractor_risk_facets() TO service_role;

-- ─── Postcondition: Bedrock excavation canary ────────────────────────────────
DO $post$
DECLARE
  facet_count int;
  bedrock_excavation_id uuid;
  bedrock_alerts int;
  bedrock_critical int;
BEGIN
  SELECT count(*) INTO facet_count FROM contractor_risk_facets;
  IF facet_count = 0 THEN
    RAISE EXCEPTION 'mig247 postcondition: 0 rows in contractor_risk_facets — view did not materialize';
  END IF;
  RAISE NOTICE 'mig247: contractor_risk_facets materialized with % rows', facet_count;

  SELECT id INTO bedrock_excavation_id
    FROM contractors
   WHERE normalized_name = 'bedrock excavation' AND state_code = 'CO'
   LIMIT 1;

  IF bedrock_excavation_id IS NOT NULL THEN
    SELECT count(*), count(*) FILTER (WHERE severity = 'CRITICAL')
      INTO bedrock_alerts, bedrock_critical
      FROM compute_homeowner_alerts(bedrock_excavation_id);
    RAISE NOTICE 'mig247 canary: Bedrock excavation produces % alerts (% CRITICAL)',
      bedrock_alerts, bedrock_critical;
    IF bedrock_alerts = 0 THEN
      RAISE EXCEPTION 'mig247 canary failed: Bedrock excavation should produce at least 1 alert';
    END IF;
  ELSE
    RAISE NOTICE 'mig247 canary skipped: Bedrock excavation contractor row not found';
  END IF;
END $post$;

COMMIT;
