-- 249_homeowner_alerts_v2.sql
--
-- PROVENANCE NOTE
-- ----------------
-- This migration was applied to prod (gaawvpzzmotimblyesfp) out-of-band
-- via Supabase MCP before being committed to the repo. Captured here on
-- 2026-05-13 to restore repo↔prod symmetry per the established rule
-- (feedback_supabase_migrations_apply_via_mcp.md). The function body
-- below is a verbatim copy of pg_get_functiondef() against the live
-- compute_homeowner_alerts_v2 RPC in prod.
--
-- WHAT IT ADDS
-- ------------
-- compute_homeowner_alerts_v2(contractor_id, work_state_code, work_zip,
--   project_scope) wraps compute_homeowner_alerts_with_context() (mig 248)
-- and additionally yields up to 6 new alert codes when the relevant
-- upstream tables are populated:
--   HIGH      PERMIT_PORTFOLIO_MISMATCH
--   HIGH      NEIGHBORHOOD_COMPLAINT_VELOCITY        (requires work_zip)
--   HIGH      COMPLAINT_VELOCITY_SPIKE
--   CRITICAL  LICENSE_NOT_HELD_IN_JURISDICTION       (requires project_scope)
--   HIGH      LICENSE_SCOPE_MISMATCH                 (requires project_scope)
--   CRITICAL  COI_EXPIRED
--   HIGH      COI_UNVERIFIED
--   INFO      ESCROW_AVAILABLE
--
-- UPSTREAM TABLES THE FUNCTION READS (not in repo migrations as of mig 248)
-- ------------------------------------------------------------------------
--   contractor_portfolio_claims
--   small_claims_filings
--   contractor_held_licenses
--   license_scope_taxonomy
--   coi_verifications
-- These tables exist in prod but have no corresponding repo migration.
-- The precondition block below RAISEs with a clear message if any are
-- missing — fresh checkouts that haven't restored those tables will see
-- a named-table error pointing to the gap, not a confusing function-body
-- compile failure.
--
-- HOW TO APPLY
-- ------------
-- Prod already has this function; applying via MCP is a no-op (CREATE OR
-- REPLACE FUNCTION overwrites with the same body). New environments
-- need the upstream tables in place first.

BEGIN;

DO $pre$
DECLARE
  missing text[] := ARRAY[]::text[];
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'contractor_portfolio_claims',
    'small_claims_filings',
    'contractor_held_licenses',
    'license_scope_taxonomy',
    'coi_verifications',
    'contractor_risk_facets',
    'contractors'
  ]) LOOP
    IF NOT EXISTS(
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=t
    ) AND NOT EXISTS(
      SELECT 1 FROM pg_matviews
      WHERE schemaname='public' AND matviewname=t
    ) THEN
      missing := array_append(missing, t);
    END IF;
  END LOOP;

  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='compute_homeowner_alerts_with_context') THEN
    RAISE EXCEPTION 'mig249 precondition: compute_homeowner_alerts_with_context required (mig 248)';
  END IF;

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'mig249 precondition: upstream tables missing from this DB: %. These exist in prod (gaawvpzzmotimblyesfp) but are not yet captured in repo migrations. Restore from prod before applying mig 249.', array_to_string(missing, ', ');
  END IF;
END $pre$;

CREATE OR REPLACE FUNCTION public.compute_homeowner_alerts_v2(
  p_contractor_id uuid,
  p_work_state_code text DEFAULT NULL::text,
  p_work_zip text DEFAULT NULL::text,
  p_project_scope text DEFAULT NULL::text
)
RETURNS TABLE(
  alert_code text,
  severity text,
  headline text,
  body text,
  evidence_hint text,
  detected_at timestamp with time zone
)
LANGUAGE plpgsql STABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  f RECORD;
  work_state text;
  recent_zip_complaints int;
  any_held_scope_match boolean;
  any_held_in_jurisdiction boolean;
  expired_coi RECORD;
  unverified_coi RECORD;
BEGIN
  RETURN QUERY
    SELECT a.alert_code, a.severity, a.headline, a.body, a.evidence_hint, a.detected_at
      FROM compute_homeowner_alerts_with_context(p_contractor_id, p_work_state_code) a;

  SELECT * INTO f FROM contractor_risk_facets WHERE contractor_id = p_contractor_id;
  IF NOT FOUND THEN RETURN; END IF;
  work_state := COALESCE(p_work_state_code, f.state_code);

  IF EXISTS(SELECT 1 FROM contractor_portfolio_claims cpc WHERE cpc.contractor_id = p_contractor_id AND cpc.matches_known_permit = false) THEN
    alert_code := 'PERMIT_PORTFOLIO_MISMATCH';
    severity := 'HIGH';
    headline := 'Photos in this contractor''s portfolio do not match any permit they have pulled';
    body := 'At least one photo or address claimed in "' || f.legal_name || '"''s portfolio (website, social media, or contractor directory listing) does not correspond to any permit issued to this contractor in public records. Legitimate contractors pull permits for the kind of work they show in portfolios. Stolen-photo scams are common — verify that this contractor pulled a permit for the specific job they are showing you photos of.';
    evidence_hint := 'Ask the contractor for the permit number that corresponds to a recent portfolio job, and verify it with the issuing city.';
    detected_at := now();
    RETURN NEXT;
  END IF;

  IF p_work_zip IS NOT NULL THEN
    SELECT count(*) INTO recent_zip_complaints
      FROM small_claims_filings scf
     WHERE scf.contractor_id = p_contractor_id
       AND scf.plaintiff_zip = p_work_zip
       AND scf.case_filed_date >= CURRENT_DATE - INTERVAL '90 days';
    IF recent_zip_complaints > 0 THEN
      alert_code := 'NEIGHBORHOOD_COMPLAINT_VELOCITY';
      severity := 'HIGH';
      headline := recent_zip_complaints || ' recent small-claims filing(s) in your ZIP against this contractor';
      body := 'In the last 90 days, ' || recent_zip_complaints || ' homeowner(s) in ZIP ' || p_work_zip || ' filed small-claims actions against "' || f.legal_name || '" or a closely-matching name. State enforcement records typically lag actual harm by 6-18 months — same-neighborhood complaint clusters are the leading indicator. Ask the contractor directly about these cases before signing.';
      evidence_hint := 'Court filings are public — search your county court records portal for "' || f.legal_name || '" as defendant.';
      detected_at := now();
      RETURN NEXT;
    END IF;
  END IF;

  IF EXISTS(SELECT 1 FROM small_claims_filings scf WHERE scf.contractor_id = p_contractor_id AND scf.case_filed_date >= CURRENT_DATE - INTERVAL '60 days' HAVING count(*) >= 3) THEN
    alert_code := 'COMPLAINT_VELOCITY_SPIKE';
    severity := 'HIGH';
    headline := 'Multiple recent small-claims filings against this contractor';
    body := '"' || f.legal_name || '" has at least 3 small-claims filings as defendant in the last 60 days. This pattern is consistent with active-spree fraud where one contractor is harming many homeowners simultaneously. Treat any deposit request with extreme caution.';
    evidence_hint := 'Search court records by defendant name.';
    detected_at := now();
    RETURN NEXT;
  END IF;

  IF p_project_scope IS NOT NULL THEN
    SELECT bool_or(p_project_scope = ANY(lst.authorized_scopes)),
           bool_or(true)
      INTO any_held_scope_match, any_held_in_jurisdiction
      FROM contractor_held_licenses chl
      JOIN license_scope_taxonomy lst ON lst.jurisdiction = chl.jurisdiction AND lst.license_class_code = chl.license_class_code
     WHERE chl.contractor_id = p_contractor_id
       AND chl.license_status IN ('active','current');

    IF any_held_in_jurisdiction IS NULL OR NOT any_held_in_jurisdiction THEN
      alert_code := 'LICENSE_NOT_HELD_IN_JURISDICTION';
      severity := 'CRITICAL';
      headline := 'No active license on file for ' || COALESCE(work_state, 'this jurisdiction');
      body := 'Groundcheck has no record of an active contractor license held by "' || f.legal_name || '" in any tracked jurisdiction. This does not necessarily mean they are unlicensed — Groundcheck has not yet ingested every municipal registry — but ask the contractor for their license number and verify it directly with the issuing authority before paying any deposit.';
      evidence_hint := 'Ask for the license number and the issuing authority.';
      detected_at := now();
      RETURN NEXT;
    ELSIF any_held_scope_match IS NOT NULL AND NOT any_held_scope_match THEN
      alert_code := 'LICENSE_SCOPE_MISMATCH';
      severity := 'HIGH';
      headline := 'Contractor''s license may not cover ' || p_project_scope || ' work';
      body := '"' || f.legal_name || '" holds an active license, but the license class(es) Groundcheck has on file do not appear to authorize ' || p_project_scope || ' work. In many jurisdictions, contractors can only legally perform work within their license class scope. Ask the contractor which specific license class covers your project, and verify with the issuing authority.';
      evidence_hint := 'Many states publish license-class-to-scope mappings on the licensing agency website.';
      detected_at := now();
      RETURN NEXT;
    END IF;
  END IF;

  SELECT * INTO expired_coi FROM coi_verifications cv
   WHERE cv.contractor_id = p_contractor_id
     AND cv.policy_expiration_date < CURRENT_DATE
     AND cv.verification_status NOT IN ('verified_active')
   ORDER BY cv.observed_at DESC LIMIT 1;
  IF expired_coi.id IS NOT NULL THEN
    alert_code := 'COI_EXPIRED';
    severity := 'CRITICAL';
    headline := 'Insurance certificate on file has expired';
    body := 'A certificate of insurance previously provided by "' || f.legal_name || '" expired on ' || to_char(expired_coi.policy_expiration_date, 'FMMonth FMDD, YYYY') || '. Verbal claims of "we''re insured" are not sufficient. Demand a current COI naming you as certificate holder and call the carrier directly to confirm it is active.';
    evidence_hint := 'Call the listed carrier directly using a phone number from the carrier''s official website, not from the COI itself.';
    detected_at := now();
    RETURN NEXT;
  END IF;

  SELECT * INTO unverified_coi FROM coi_verifications cv
   WHERE cv.contractor_id = p_contractor_id
     AND cv.verification_status IN ('unverified','document_only')
   ORDER BY cv.observed_at DESC LIMIT 1;
  IF unverified_coi.id IS NOT NULL AND expired_coi.id IS NULL THEN
    alert_code := 'COI_UNVERIFIED';
    severity := 'HIGH';
    headline := 'Insurance certificate provided but not independently verified';
    body := '"' || f.legal_name || '" has provided a certificate of insurance from ' || COALESCE(unverified_coi.carrier_name, 'an unnamed carrier') || ' but Groundcheck has not independently verified the policy with the carrier. Fake COIs are common in construction. Before paying a deposit, call the carrier directly using a phone number from their official website (never the COI document) and confirm policy ' || unverified_coi.policy_number || ' is currently active for this contractor.';
    evidence_hint := 'Carrier name on COI: ' || COALESCE(unverified_coi.carrier_name, 'unspecified');
    detected_at := now();
    RETURN NEXT;
  END IF;

  IF f.has_critical_report OR f.shared_officer_count > 0 OR f.evidence_of_no_or_dissolved_state_record THEN
    alert_code := 'ESCROW_AVAILABLE';
    severity := 'INFO';
    headline := 'Consider an escrow service for your deposit';
    body := 'Given the risk signals on this report, consider using an independent escrow service rather than paying the contractor directly. Reputable services include Escrow.com and your local title company''s construction escrow service. Funds are held until milestones are verified (typically including pulling a permit and completing inspections). Most legitimate contractors will accept escrow terms; resistance to escrow is itself a signal.';
    evidence_hint := 'Search your title company''s website for "construction escrow" services.';
    detected_at := now();
    RETURN NEXT;
  END IF;
END $function$;

GRANT EXECUTE ON FUNCTION public.compute_homeowner_alerts_v2(uuid, text, text, text)
  TO authenticated, anon, service_role;

COMMIT;
