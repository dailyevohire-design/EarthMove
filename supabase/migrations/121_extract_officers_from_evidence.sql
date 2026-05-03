-- Migration 121: extract_officers_from_evidence
-- Tier 3 #1 commit 1 — Officer extraction bridge
--
-- Reads extracted_facts->'officers' from a trust_evidence row, upserts each
-- officer via upsert_trust_officer, and links to the evidence's contractor via
-- link_contractor_officer (which auto-emits shared_officer edges in
-- trust_entity_edges to every other contractor sharing that officer).
--
-- Expected schema for extracted_facts.officers[]:
--   [{ "name": "John Q Smith",                  -- required
--      "role_hint": "manager",                  -- optional, must match enum
--      "is_natural_person": true,               -- optional boolean
--      "start_date": "2018-04-21",              -- optional ISO date
--      "end_date": null                         -- optional ISO date
--   }, ...]
--
-- Defensive: returns ok no-op for missing contractor_id, missing/non-array
-- officers payload, or empty array. Per-officer name validation skips bad rows
-- without aborting the batch.
--
-- Idempotent (delegates to upsert_trust_officer + link_contractor_officer
-- which both ON CONFLICT DO NOTHING / DO UPDATE).
-- SECURITY DEFINER + service_role-only EXECUTE (mirrors append_trust_evidence).

CREATE OR REPLACE FUNCTION public.extract_officers_from_evidence(p_evidence_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_evidence       trust_evidence%ROWTYPE;
  v_contractor     contractors%ROWTYPE;
  v_officers_raw   jsonb;
  v_officer_json   jsonb;
  v_officer_row    trust_officers%ROWTYPE;
  v_officer_ids    uuid[] := '{}';
  v_processed      int := 0;
  v_skipped        int := 0;
  v_role_hint      text;
  v_role_link      text;
  v_start_date     date;
  v_end_date       date;
BEGIN
  SELECT * INTO v_evidence FROM trust_evidence WHERE id = p_evidence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'evidence_id', p_evidence_id,
      'status', 'evidence_not_found',
      'officers_processed', 0,
      'officer_ids', '[]'::jsonb
    );
  END IF;

  IF v_evidence.contractor_id IS NULL THEN
    RETURN jsonb_build_object(
      'evidence_id', p_evidence_id,
      'status', 'skipped_no_contractor',
      'officers_processed', 0,
      'officer_ids', '[]'::jsonb
    );
  END IF;

  v_officers_raw := v_evidence.extracted_facts -> 'officers';
  IF v_officers_raw IS NULL
     OR jsonb_typeof(v_officers_raw) <> 'array'
     OR jsonb_array_length(v_officers_raw) = 0 THEN
    RETURN jsonb_build_object(
      'evidence_id', p_evidence_id,
      'status', 'no_officers',
      'officers_processed', 0,
      'officer_ids', '[]'::jsonb
    );
  END IF;

  SELECT * INTO v_contractor FROM contractors WHERE id = v_evidence.contractor_id;

  FOR v_officer_json IN SELECT * FROM jsonb_array_elements(v_officers_raw)
  LOOP
    -- name is required and non-empty
    IF (v_officer_json ? 'name') = false
       OR v_officer_json ->> 'name' IS NULL
       OR BTRIM(v_officer_json ->> 'name') = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_role_hint := NULLIF(BTRIM(COALESCE(v_officer_json ->> 'role_hint', '')), '');
    -- bound by trust_officers_officer_role_hint_check; coerce invalid to NULL
    IF v_role_hint IS NOT NULL AND v_role_hint NOT IN (
      'registered_agent','member','manager','officer','director',
      'principal','owner','incorporator','unknown'
    ) THEN
      v_role_hint := NULL;
    END IF;

    -- trust_officer_links.role is freeform NOT NULL text; mirror role_hint or 'unknown'
    v_role_link := COALESCE(v_role_hint, 'unknown');

    BEGIN
      v_start_date := NULLIF(v_officer_json ->> 'start_date', '')::date;
    EXCEPTION WHEN OTHERS THEN
      v_start_date := NULL;
    END;
    BEGIN
      v_end_date := NULLIF(v_officer_json ->> 'end_date', '')::date;
    EXCEPTION WHEN OTHERS THEN
      v_end_date := NULL;
    END;

    SELECT * INTO v_officer_row FROM upsert_trust_officer(
      p_name => v_officer_json ->> 'name',
      p_role_hint => v_role_hint,
      p_jurisdiction => v_contractor.state_code,
      p_source_evidence_id => p_evidence_id,
      p_is_likely_natural_person =>
        CASE
          WHEN (v_officer_json ? 'is_natural_person')
               AND jsonb_typeof(v_officer_json -> 'is_natural_person') = 'boolean'
          THEN (v_officer_json ->> 'is_natural_person')::boolean
          ELSE NULL
        END
    );

    PERFORM link_contractor_officer(
      p_contractor_id => v_evidence.contractor_id,
      p_officer_id => v_officer_row.id,
      p_role => v_role_link,
      p_source_evidence_id => p_evidence_id,
      p_start_date => v_start_date,
      p_end_date => v_end_date
    );

    v_officer_ids := array_append(v_officer_ids, v_officer_row.id);
    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'evidence_id', p_evidence_id,
    'status', 'ok',
    'officers_processed', v_processed,
    'officers_skipped', v_skipped,
    'officer_ids', to_jsonb(v_officer_ids)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.extract_officers_from_evidence(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extract_officers_from_evidence(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.extract_officers_from_evidence(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.extract_officers_from_evidence(uuid) TO service_role;
