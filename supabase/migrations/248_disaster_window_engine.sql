-- 248_disaster_window_engine.sql
-- Ships the disaster-window state machine. Out-of-state storm chasers, fresh-LLC
-- chasers, and disaster-zone awareness alerts now fire automatically the moment
-- a worker upserts an NWS/FEMA event into disaster_windows.
--
-- Design: ADDITIVE to mig 247. The existing compute_homeowner_alerts(uuid)
-- function is unchanged. A new wrapper compute_homeowner_alerts_with_context(uuid, text)
-- returns mig 247's alerts PLUS three new disaster-context alerts. Existing
-- callers do not need to change. New callers (homeowner page with work_state)
-- get the richer surface.

BEGIN;

DO $pre$
DECLARE
  has_alerts_fn bool;
  has_facets bool;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname='compute_homeowner_alerts') INTO has_alerts_fn;
  SELECT EXISTS(SELECT 1 FROM pg_matviews WHERE matviewname='contractor_risk_facets') INTO has_facets;
  IF NOT has_alerts_fn THEN
    RAISE EXCEPTION 'mig248 precondition: compute_homeowner_alerts required (mig 247)';
  END IF;
  IF NOT has_facets THEN
    RAISE EXCEPTION 'mig248 precondition: contractor_risk_facets required (mig 247)';
  END IF;
END $pre$;

-- ─── disaster_windows: the state machine ─────────────────────────────────────
DROP TABLE IF EXISTS disaster_windows CASCADE;
CREATE TABLE disaster_windows (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source                text NOT NULL CHECK (source IN ('nws','fema','state_emergency','manual')),
  source_external_id    text NOT NULL,
  event_type            text NOT NULL CHECK (event_type IN (
    'hurricane','tropical_storm','tornado','wildfire','flood',
    'severe_storm','hail','winter_storm','earthquake',
    'volcanic_activity','tsunami','other'
  )),
  event_name            text,
  severity              text NOT NULL CHECK (severity IN ('minor','moderate','severe','extreme')),
  affected_state_codes  text[] NOT NULL CHECK (cardinality(affected_state_codes) > 0),
  affected_county_fips  text[],
  affected_zip_codes    text[],
  declared_at           timestamptz NOT NULL,
  effective_from        timestamptz NOT NULL,
  effective_until       timestamptz NOT NULL,
  metadata              jsonb NOT NULL DEFAULT '{}',
  raw_source            jsonb,
  ingested_at           timestamptz NOT NULL DEFAULT now(),
  superseded_at         timestamptz,
  CHECK (effective_until > effective_from),
  UNIQUE (source, source_external_id)
);

CREATE INDEX idx_dw_active_window
  ON disaster_windows (effective_from, effective_until)
  WHERE superseded_at IS NULL;
CREATE INDEX idx_dw_states
  ON disaster_windows USING gin (affected_state_codes)
  WHERE superseded_at IS NULL;
CREATE INDEX idx_dw_event_severity
  ON disaster_windows (event_type, severity, declared_at DESC)
  WHERE superseded_at IS NULL;

COMMENT ON TABLE disaster_windows IS
  'Active and historical disaster windows ingested from NWS, FEMA, state emergency declarations, or manual operator entry. Active filtering is by-time + not-superseded. Consumed by compute_homeowner_alerts_with_context().';

-- ─── Query helpers ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION active_disaster_windows()
RETURNS SETOF disaster_windows
LANGUAGE sql STABLE
SET search_path TO 'pg_catalog','public'
AS $func$
  SELECT * FROM disaster_windows
   WHERE superseded_at IS NULL
     AND effective_from <= now()
     AND effective_until >= now();
$func$;

GRANT EXECUTE ON FUNCTION active_disaster_windows() TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION is_state_in_disaster(p_state_code text)
RETURNS TABLE (
  disaster_id        uuid,
  event_type         text,
  event_name         text,
  severity           text,
  declared_at        timestamptz,
  effective_until    timestamptz
)
LANGUAGE sql STABLE
SET search_path TO 'pg_catalog','public'
AS $func$
  SELECT id, event_type, event_name, severity, declared_at, effective_until
    FROM disaster_windows
   WHERE superseded_at IS NULL
     AND effective_from <= now()
     AND effective_until >= now()
     AND p_state_code = ANY(affected_state_codes)
   ORDER BY CASE severity WHEN 'extreme' THEN 4 WHEN 'severe' THEN 3 WHEN 'moderate' THEN 2 ELSE 1 END DESC,
            declared_at DESC;
$func$;

GRANT EXECUTE ON FUNCTION is_state_in_disaster(text) TO authenticated, anon, service_role;

-- ─── Idempotent ingest API for NWS/FEMA workers ──────────────────────────────
CREATE OR REPLACE FUNCTION upsert_disaster_window(
  p_source               text,
  p_source_external_id   text,
  p_event_type           text,
  p_event_name           text,
  p_severity             text,
  p_affected_state_codes text[],
  p_affected_county_fips text[],
  p_affected_zip_codes   text[],
  p_declared_at          timestamptz,
  p_effective_from       timestamptz,
  p_effective_until      timestamptz,
  p_metadata             jsonb DEFAULT '{}'::jsonb,
  p_raw_source           jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $func$
DECLARE
  result_id uuid;
BEGIN
  INSERT INTO disaster_windows (
    source, source_external_id, event_type, event_name, severity,
    affected_state_codes, affected_county_fips, affected_zip_codes,
    declared_at, effective_from, effective_until, metadata, raw_source
  )
  VALUES (
    p_source, p_source_external_id, p_event_type, p_event_name, p_severity,
    p_affected_state_codes, p_affected_county_fips, p_affected_zip_codes,
    p_declared_at, p_effective_from, p_effective_until, p_metadata, p_raw_source
  )
  ON CONFLICT (source, source_external_id) DO UPDATE
    SET event_type           = EXCLUDED.event_type,
        event_name           = EXCLUDED.event_name,
        severity             = EXCLUDED.severity,
        affected_state_codes = EXCLUDED.affected_state_codes,
        affected_county_fips = EXCLUDED.affected_county_fips,
        affected_zip_codes   = EXCLUDED.affected_zip_codes,
        effective_until      = GREATEST(disaster_windows.effective_until, EXCLUDED.effective_until),
        metadata             = EXCLUDED.metadata,
        raw_source           = EXCLUDED.raw_source,
        ingested_at          = now(),
        superseded_at        = NULL
  RETURNING id INTO result_id;
  RETURN result_id;
END
$func$;

GRANT EXECUTE ON FUNCTION upsert_disaster_window(
  text, text, text, text, text, text[], text[], text[],
  timestamptz, timestamptz, timestamptz, jsonb, jsonb
) TO service_role;

-- ─── compute_homeowner_alerts_with_context: mig 247 alerts + disaster alerts ─
CREATE OR REPLACE FUNCTION compute_homeowner_alerts_with_context(
  p_contractor_id     uuid,
  p_work_state_code   text DEFAULT NULL
)
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
  work_state text;
  d RECORD;
  cd RECORD;
BEGIN
  -- Base alerts from mig 247 (unchanged)
  RETURN QUERY
    SELECT a.alert_code, a.severity, a.headline, a.body, a.evidence_hint, a.detected_at
      FROM compute_homeowner_alerts(p_contractor_id) a;

  SELECT * INTO f FROM contractor_risk_facets WHERE contractor_id = p_contractor_id;
  IF NOT FOUND THEN RETURN; END IF;

  work_state := COALESCE(p_work_state_code, f.state_code);

  -- Active disaster in work state
  SELECT * INTO d FROM active_disaster_windows()
   WHERE work_state = ANY(affected_state_codes)
   ORDER BY CASE severity WHEN 'extreme' THEN 4 WHEN 'severe' THEN 3 WHEN 'moderate' THEN 2 ELSE 1 END DESC,
            declared_at DESC
   LIMIT 1;

  -- Active disaster in contractor's home state
  SELECT * INTO cd FROM active_disaster_windows()
   WHERE f.state_code = ANY(affected_state_codes)
   ORDER BY CASE severity WHEN 'extreme' THEN 4 WHEN 'severe' THEN 3 WHEN 'moderate' THEN 2 ELSE 1 END DESC,
            declared_at DESC
   LIMIT 1;

  -- CRITICAL: OUT_OF_STATE_CONTRACTOR_DURING_DISASTER
  IF d.id IS NOT NULL AND f.state_code <> work_state THEN
    alert_code    := 'OUT_OF_STATE_CONTRACTOR_DURING_DISASTER';
    severity      := 'CRITICAL';
    headline      := 'Out-of-state contractor offering work in a disaster zone';
    body          := work_state || ' is currently in an active disaster window (' ||
                     COALESCE(d.event_name, d.event_type) ||
                     ', ' || d.severity || ' severity, declared ' ||
                     to_char(d.declared_at, 'FMMonth FMDD, YYYY') ||
                     '). "' || f.legal_name || '" is registered in ' || f.state_code ||
                     ', not ' || work_state ||
                     '. Out-of-state contractors flood disaster zones in the days following declaration. Many take deposits, perform little or no work, then leave the state with no forwarding address. If you must hire an out-of-state contractor, verify they hold a current ' ||
                     work_state || '-specific contractor license (separate from their home-state registration), demand verifiable local references, and consider an escrow service rather than a direct deposit.';
    evidence_hint := 'Verify a ' || work_state || '-specific contractor license, not just the home-state registration.';
    detected_at   := now();
    RETURN NEXT;
  END IF;

  -- HIGH: DISASTER_ZONE_ACTIVE (in-state context)
  IF d.id IS NOT NULL AND f.state_code = work_state THEN
    alert_code    := 'DISASTER_ZONE_ACTIVE';
    severity      := 'HIGH';
    headline      := 'Active disaster window in ' || work_state || ': ' ||
                     COALESCE(d.event_name, d.event_type);
    body          := work_state || ' is currently in a disaster window declared ' ||
                     to_char(d.declared_at, 'FMMonth FMDD, YYYY') || ' (' || d.severity ||
                     ' severity). During disaster windows, contractor fraud spikes sharply across the affected region. Take more time than usual to verify references. Demand a written contract with milestone-based payment. Avoid paying more than 10% of the total contract price as an initial deposit. Insurance settlements should be paid by the carrier to a joint check, not to the contractor alone.';
    evidence_hint := 'Source: ' || d.source || ' / ' || d.source_external_id;
    detected_at   := now();
    RETURN NEXT;
  END IF;

  -- CRITICAL: ENTITY_FORMED_AFTER_DISASTER_DECLARATION
  IF cd.id IS NOT NULL
     AND f.earliest_parsed_formation IS NOT NULL
     AND f.earliest_parsed_formation BETWEEN (cd.declared_at::date - 7) AND (cd.declared_at::date + 90) THEN
    alert_code    := 'ENTITY_FORMED_AFTER_DISASTER_DECLARATION';
    severity      := 'CRITICAL';
    headline      := 'Business registered around the time of a major disaster';
    body          := '"' || f.legal_name || '" was registered with the ' || f.state_code ||
                     ' Secretary of State on ' ||
                     to_char(f.earliest_parsed_formation, 'FMMonth FMDD, YYYY') ||
                     ', within 90 days of a major ' || f.state_code || ' disaster declaration (' ||
                     COALESCE(cd.event_name, cd.event_type) || ', declared ' ||
                     to_char(cd.declared_at, 'FMMonth FMDD, YYYY') ||
                     '). Storm-chasers commonly form fresh LLCs in disaster states to capture insurance-claim work. The fresh LLC lets them outrun complaint records from prior storm-chase operations. Ask the principals to disclose their individual work history under any prior business name and contact those references directly before paying any deposit.';
    evidence_hint := 'Ask the principals: "What businesses did you operate in ' || f.state_code ||
                     ' before this one?" Then look up those entities in ' || f.state_code ||
                     ' SOS records.';
    detected_at   := now();
    RETURN NEXT;
  END IF;
END
$func$;

GRANT EXECUTE ON FUNCTION compute_homeowner_alerts_with_context(uuid, text)
  TO authenticated, anon, service_role;

-- ─── Self-cleaning canary: validates new disaster alerts fire end-to-end ────
DO $post$
DECLARE
  test_disaster_id uuid;
  test_contractor_id uuid;
  baseline_count int;
  with_disaster_count int;
  out_of_state_fired bool;
  in_state_fired bool;
BEGIN
  -- Pick any real CO contractor (Bedrock excavating Corp is a known target)
  SELECT id INTO test_contractor_id
    FROM contractors
   WHERE state_code = 'CO'
     AND legal_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
   LIMIT 1;

  IF test_contractor_id IS NULL THEN
    RAISE NOTICE 'mig248 canary skipped: no real CO contractor available';
    RETURN;
  END IF;

  -- Baseline (no disaster context)
  SELECT count(*) INTO baseline_count
    FROM compute_homeowner_alerts_with_context(test_contractor_id, NULL);

  -- Insert a test CO disaster window
  test_disaster_id := upsert_disaster_window(
    'manual',
    'mig248_self_test_' || gen_random_uuid()::text,
    'severe_storm',
    'mig248 self-test event (auto-deleted)',
    'severe',
    ARRAY['CO']::text[],
    NULL,
    NULL,
    now(),
    now() - INTERVAL '1 minute',
    now() + INTERVAL '1 hour',
    '{"canary": true}'::jsonb,
    NULL
  );

  -- With disaster context, in-state (work_state = CO, contractor in CO)
  SELECT count(*),
         bool_or(alert_code = 'DISASTER_ZONE_ACTIVE')
    INTO with_disaster_count, in_state_fired
    FROM compute_homeowner_alerts_with_context(test_contractor_id, 'CO');

  -- With disaster context, out-of-state (work_state = CO, but pretend contractor is TX)
  -- Simulated by passing work_state different from contractor.state_code: pass 'TX' for
  -- a CO-registered contractor — but inversely. Easier: pretend work is in CO while
  -- using a TX contractor.
  SELECT bool_or(alert_code = 'OUT_OF_STATE_CONTRACTOR_DURING_DISASTER')
    INTO out_of_state_fired
    FROM compute_homeowner_alerts_with_context(
      (SELECT id FROM contractors WHERE state_code='TX'
        AND legal_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
        LIMIT 1),
      'CO'
    );

  RAISE NOTICE 'mig248 canary: baseline=%, with_disaster=%, in_state_alert=%, out_of_state_alert=%',
    baseline_count, with_disaster_count, in_state_fired, out_of_state_fired;

  -- Clean up the test disaster window
  DELETE FROM disaster_windows WHERE id = test_disaster_id;

  -- Assertions
  IF with_disaster_count <= baseline_count THEN
    RAISE EXCEPTION 'mig248 canary failed: disaster context did not add alerts (baseline=%, with=%)',
      baseline_count, with_disaster_count;
  END IF;

  IF NOT COALESCE(in_state_fired, false) THEN
    RAISE EXCEPTION 'mig248 canary failed: DISASTER_ZONE_ACTIVE did not fire for in-state contractor';
  END IF;

  IF NOT COALESCE(out_of_state_fired, false) THEN
    RAISE EXCEPTION 'mig248 canary failed: OUT_OF_STATE_CONTRACTOR_DURING_DISASTER did not fire for cross-state contractor';
  END IF;

  RAISE NOTICE 'mig248: disaster engine validated end-to-end';
END $post$;

COMMIT;
