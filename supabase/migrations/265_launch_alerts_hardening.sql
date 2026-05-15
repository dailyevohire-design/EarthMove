-- LAUNCH HARDENING — Three-part alerts cleanup.
--
-- 1. Tighten compute_homeowner_alerts_for_finalize: NO_VERIFIABLE_STATE_REGISTRATION
--    no longer fires for biz_status='Not Found'/'Unknown' (often scraper name-match
--    misses). Now requires explicit adverse evidence (no record, missing, dissol,
--    forfeit, inactive, cancel, delinquent).
-- 2. Repair old Gearheart contractor_id ce613526 — re-synth bug created a new contractor
--    row, leaving the old contractor's reports stuck at 34/CRITICAL biz_status=Inactive.
--    NULL out trust_score so renderer shows pending state instead of defamatory 34.
-- 3. Recompute alerts for the 22 affected contractors' latest reports via the tightened
--    function. Removes false DISSOLVED_OR_INACTIVE_ENTITY on biz_status='Not Found' rows
--    and false NO_VERIFIABLE_STATE_REGISTRATION on 'Not Found' rows (post-tighten).

-- =============================================================
-- Part 1: Tighten the function
-- =============================================================
CREATE OR REPLACE FUNCTION public.compute_homeowner_alerts_for_finalize(
  p_contractor_id uuid,
  p_work_state_code text,
  p_new_biz_status text,
  p_new_biz_formation_date text
)
RETURNS TABLE(alert_code text, severity text, headline text, body text, evidence_hint text, detected_at timestamp with time zone)
LANGUAGE plpgsql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  f RECORD;
  work_state text;
  d RECORD;
  cd RECORD;
  age_days int;
  anchor_name text;
  anchor_age_years int;
  v_biz_status text;
  v_formation_date date;
  v_has_parseable_formation boolean;
  v_evidence_of_no_record boolean;
BEGIN
  SELECT * INTO f FROM contractor_risk_facets WHERE contractor_id = p_contractor_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_biz_status := COALESCE(p_new_biz_status, f.canonical_biz_status);

  IF p_new_biz_formation_date IS NOT NULL THEN
    v_formation_date := CASE
      WHEN p_new_biz_formation_date ~ '^\d{4}-\d{2}-\d{2}$' THEN p_new_biz_formation_date::date
      WHEN p_new_biz_formation_date ~ '^\d{4}-\d{2}-\d{2}T' THEN p_new_biz_formation_date::date
      WHEN p_new_biz_formation_date ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN to_date(p_new_biz_formation_date, 'FMMM/FMDD/YYYY')
      ELSE NULL
    END;
  ELSE
    v_formation_date := f.earliest_parsed_formation;
  END IF;
  v_has_parseable_formation := v_formation_date IS NOT NULL;

  -- TIGHTENED (mig 265): 'not.*found' and 'unknown' removed from regex.
  -- These signals are too weak — biz_status='Not Found' often means scraper name-match
  -- miss, not actual absence of registration. CRITICAL alert on weak signal = defamation.
  -- Explicit adverse evidence required: dissolution, forfeiture, cancellation, etc.
  v_evidence_of_no_record := COALESCE(
    lower(COALESCE(v_biz_status, '')) ~ 'no.*record|missing|dissol|forfeit|inactive|cancel|delinquent',
    false
  );

  IF v_evidence_of_no_record AND NOT v_has_parseable_formation THEN
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

  IF v_biz_status IS NOT NULL
     AND lower(v_biz_status) ~ 'dissol|forfeit|inactive|cancel|delinquent' THEN
    alert_code    := 'DISSOLVED_OR_INACTIVE_ENTITY';
    severity      := 'CRITICAL';
    headline      := 'State records list this business as ' || v_biz_status;
    body          := '"' || f.legal_name || '" currently shows a status of ' || v_biz_status ||
                     ' in ' || f.state_code || ' Secretary of State records. Doing business with a dissolved or delinquent entity removes most consumer recourse — a contract you sign may be unenforceable, and the business may not legally exist to take responsibility if work goes wrong.';
    evidence_hint := f.state_code || ' Secretary of State public records.';
    detected_at   := now();
    RETURN NEXT;
  END IF;

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
    AND (v_formation_date IS NULL
         OR peer_facets.earliest_parsed_formation < v_formation_date - INTERVAL '1 year')
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

  IF v_formation_date IS NOT NULL THEN
    age_days := (CURRENT_DATE - v_formation_date);
    IF age_days < 30 THEN
      alert_code    := 'VERY_YOUNG_ENTITY';
      severity      := 'HIGH';
      headline      := 'Business was registered only ' || age_days || ' days ago';
      body          := '"' || f.legal_name || '" was registered with the ' || f.state_code ||
                       ' Secretary of State on ' || to_char(v_formation_date, 'FMMonth FMDD, YYYY') ||
                       '. Legitimate brand-new businesses do exist — but phoenix-LLC operators create fresh entities specifically to outrun complaint records from prior LLCs they ran. Before paying a deposit, ask the principals for verifiable references to prior work they personally completed (not under this LLC name), and contact those references directly.';
      evidence_hint := 'Request the principals'' personal work history, not the LLC''s.';
      detected_at   := now();
      RETURN NEXT;
    ELSIF age_days < 90 THEN
      alert_code    := 'VERY_YOUNG_ENTITY';
      severity      := 'MEDIUM';
      headline      := 'Business was registered ' || age_days || ' days ago';
      body          := '"' || f.legal_name || '" was registered with the ' || f.state_code ||
                       ' Secretary of State on ' || to_char(v_formation_date, 'FMMonth FMDD, YYYY') ||
                       ' — less than 90 days ago. Not automatically a red flag, but newer than typical for established contractors. Ask for references to prior work under any earlier business name the principals operated, and verify those.';
      evidence_hint := 'Ask whether the principals previously operated under different business names.';
      detected_at   := now();
      RETURN NEXT;
    END IF;
  END IF;

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

  work_state := COALESCE(p_work_state_code, f.state_code);

  SELECT adw.* INTO d FROM active_disaster_windows() adw
   WHERE work_state = ANY(adw.affected_state_codes)
   ORDER BY CASE adw.severity WHEN 'extreme' THEN 4 WHEN 'severe' THEN 3 WHEN 'moderate' THEN 2 ELSE 1 END DESC,
            adw.declared_at DESC
   LIMIT 1;

  SELECT adw.* INTO cd FROM active_disaster_windows() adw
   WHERE f.state_code = ANY(adw.affected_state_codes)
   ORDER BY CASE adw.severity WHEN 'extreme' THEN 4 WHEN 'severe' THEN 3 WHEN 'moderate' THEN 2 ELSE 1 END DESC,
            adw.declared_at DESC
   LIMIT 1;

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

  IF cd.id IS NOT NULL
     AND v_formation_date IS NOT NULL
     AND v_formation_date BETWEEN (cd.declared_at::date - 7) AND (cd.declared_at::date + 90) THEN
    alert_code    := 'ENTITY_FORMED_AFTER_DISASTER_DECLARATION';
    severity      := 'CRITICAL';
    headline      := 'Business registered around the time of a major disaster';
    body          := '"' || f.legal_name || '" was registered with the ' || f.state_code ||
                     ' Secretary of State on ' ||
                     to_char(v_formation_date, 'FMMonth FMDD, YYYY') ||
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
$function$;

GRANT EXECUTE ON FUNCTION public.compute_homeowner_alerts_for_finalize(uuid, text, text, text) TO authenticated, anon, service_role;

-- =============================================================
-- Part 2: Old Gearheart (ce613526) - NULL out trust_score
-- =============================================================
-- The integrity_v2 trigger's NULL-handling path is:
--   IF NEW.trust_score IS NULL THEN
--     NEW.risk_level := NULL;
--     IF NEW.summary IS NULL OR length(trim(NEW.summary)) = 0 THEN
--       NEW.summary := build_trust_summary_text(NULL, NULL, 0, 0);
--     END IF;
--     RETURN NEW;
--   END IF;
-- So setting trust_score=NULL clears risk_level, leaves summary, exits early.

UPDATE trust_reports
SET trust_score = NULL,
    requires_re_review = TRUE
WHERE contractor_id = 'ce613526-c193-400b-9ab2-63edd5a6cba8'
  AND contractor_name NOT ILIKE 'FTEST_%';

-- =============================================================
-- Part 3: Recompute alerts for the 22 affected contractors' latest reports
-- =============================================================
WITH affected AS (
  SELECT DISTINCT contractor_id FROM tx_sos_status_corrections_log
),
latest_per AS (
  SELECT DISTINCT ON (tr.contractor_id)
    tr.id, tr.contractor_id, tr.state_code, tr.biz_status, tr.biz_formation_date
  FROM trust_reports tr
  WHERE tr.contractor_id IN (SELECT contractor_id FROM affected)
    AND tr.contractor_name NOT ILIKE 'FTEST_%'
  ORDER BY tr.contractor_id, tr.created_at DESC
)
UPDATE trust_reports tr
SET score_breakdown = jsonb_set(
  COALESCE(tr.score_breakdown, '{}'::jsonb),
  '{homeowner_alerts}',
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
       'alert_code', a.alert_code, 'severity', a.severity,
       'headline', a.headline, 'body', a.body,
       'evidence_hint', a.evidence_hint, 'detected_at', a.detected_at
     ))
     FROM compute_homeowner_alerts_for_finalize(lp.contractor_id, lp.state_code, lp.biz_status, lp.biz_formation_date) a
    ),
    '[]'::jsonb
  )
)
FROM latest_per lp
WHERE tr.id = lp.id;
