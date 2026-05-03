-- Migration 122: detect_contractor_phoenix_signals_enriched
-- Tier 3 #1 commit 3 prep — citation-aware phoenix signal wrapper
--
-- Wraps detect_contractor_phoenix_signals(contractor_id). For every
-- shared_officer_* signal, joins on trust_officer_links keyed by
-- (p_contractor_id, officer_id) and promotes that row's
-- source_evidence_id to evidence.source_evidence_id on the signal.
--
-- Critical: we use trust_officer_links, NOT trust_entity_edges. The
-- edge stores whichever contractor's officer write triggered edge
-- creation (always the second-written, since the first write has no
-- counterpart yet). Citing the edge's evidence_ids[] would break the
-- validator's "evidence_ids ⊆ current job's pool" invariant for the
-- first-written contractor. trust_officer_links has one row per
-- (contractor, officer) pair, each carrying THAT contractor's own
-- source_evidence_id — guaranteed in-pool when generating that
-- contractor's report.
--
-- Non-officer signals (shared_phone, shared_address_*, shared_ein,
-- shared_website, similar_name_same_state) pass through unchanged.
-- They have no edge_id, no per-contractor evidence chain — they're
-- aggregate counts and remain narrative-only.
--
-- Officer signals where the link's source_evidence_id is NULL (seed
-- data, pre-migration-121 writes) also pass through unchanged. The
-- synth layer treats absence of source_evidence_id as
-- "narrative-only, not eligible for first-class red_flag citation."
--
-- STABLE (no side effects, deterministic per snapshot).
-- service_role-only EXECUTE; no SECURITY DEFINER (synth path runs as
-- service_role and bypasses RLS on all referenced tables).

CREATE OR REPLACE FUNCTION public.detect_contractor_phoenix_signals_enriched(p_contractor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_signals       jsonb;
  v_enriched      jsonb := '[]'::jsonb;
  v_signal        jsonb;
  v_officer_id    uuid;
  v_source_eid    uuid;
BEGIN
  v_signals := detect_contractor_phoenix_signals(p_contractor_id);

  IF v_signals IS NULL OR jsonb_typeof(v_signals) <> 'array' OR jsonb_array_length(v_signals) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR v_signal IN SELECT * FROM jsonb_array_elements(v_signals)
  LOOP
    IF v_signal->>'signal' LIKE 'shared_officer%' THEN
      BEGIN
        v_officer_id := (v_signal->'evidence'->>'officer_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_officer_id := NULL;
      END;

      IF v_officer_id IS NOT NULL THEN
        SELECT source_evidence_id INTO v_source_eid
        FROM trust_officer_links
        WHERE contractor_id = p_contractor_id
          AND officer_id = v_officer_id
          AND source_evidence_id IS NOT NULL
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_source_eid IS NOT NULL THEN
          v_signal := jsonb_set(
            v_signal,
            '{evidence,source_evidence_id}',
            to_jsonb(v_source_eid::text),
            true
          );
        END IF;
      END IF;
    END IF;

    v_enriched := v_enriched || v_signal;
  END LOOP;

  RETURN v_enriched;
END;
$function$;

REVOKE ALL ON FUNCTION public.detect_contractor_phoenix_signals_enriched(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_contractor_phoenix_signals_enriched(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.detect_contractor_phoenix_signals_enriched(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.detect_contractor_phoenix_signals_enriched(uuid) TO service_role;
