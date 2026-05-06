-- 225_deactivate_bbb_profile_legal_risk
-- Already applied via MCP. Repo mirror.
--
-- Reverses bbb_profile tier activation from mig 222.
-- Reason: BBB ToS explicitly prohibits automated scraping. Documented track
-- record of cease-and-desist + litigation against scrapers. Contradicts
-- groundcheck_launch_kit BBB outreach pledge to drive traffic back to BBB
-- profiles, not away.
--
-- Other 3 sources from mig 222 remain active (legally clean):
--   - courtlistener_fed (free government API, public-domain data)
--   - denver_cpd (Denver municipal licensing, public record)
--   - ccb_or (Oregon CCB licensing, public record)
--
-- BBB signal will be acquired via legitimate paths post-launch:
--   - BBB data partnership program (paid, contractual)
--   - llm_web_search fallback (Anthropic's licensed search tool)
--
-- Score function still reads bbb_* finding types — wiring preserved for if/
-- when BBB findings flow through legitimate channels.

-- DB state at apply: [{"source_key":"bbb_profile","is_active":false,"applicable_tiers":[]}]


UPDATE public.trust_source_registry
SET applicable_tiers = ARRAY[]::text[],
    is_active = false,
    notes = COALESCE(notes, '') ||
            E'\n\n[2026-05-06] Deactivated. BBB ToS prohibits automated access; ' ||
            'history of C&D against scrapers; contradicts launch_kit outreach pledge ' ||
            'to drive traffic back to BBB profiles. Re-activate ONLY via legitimate ' ||
            'paths: BBB data partnership, llm_web_search fallback, or accredited-member API.',
    updated_at = now()
WHERE source_key = 'bbb_profile';

DO $$
DECLARE v_tiers text[];
BEGIN
  SELECT applicable_tiers INTO v_tiers
  FROM public.trust_source_registry WHERE source_key = 'bbb_profile';
  IF array_length(v_tiers, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'BBB deactivation failed: applicable_tiers = %', v_tiers;
  END IF;
END $$;
