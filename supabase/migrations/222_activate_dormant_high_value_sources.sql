-- 222_activate_dormant_high_value_sources
-- Flips applicable_tiers from [] (dormant) to [standard,plus,deep_dive,forensic]
-- on 4 sources that already have scrapers/configs but were locked out of tier-mapping.
-- These are the highest-leverage activations available pre-launch — each fills a
-- known gap exposed by the Judge DFW $5M-fraud test (May 6, 2026).

UPDATE public.trust_source_registry
SET applicable_tiers = ARRAY['standard','plus','deep_dive','forensic']::text[],
    updated_at = now(),
    notes = COALESCE(notes, '') ||
            E'\n\n[2026-05-06] Activated across all 4 tiers (was dormant). ' ||
            'Tier-mapping unblocked; scorer wiring lands separately.'
WHERE source_key IN ('bbb_profile','courtlistener_fed','denver_cpd','ccb_or')
  AND applicable_tiers = ARRAY[]::text[];

DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.trust_source_registry
  WHERE source_key IN ('bbb_profile','courtlistener_fed','denver_cpd','ccb_or')
    AND array_length(applicable_tiers, 1) = 4;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Tier activation incomplete: expected 4 sources at 4-tier coverage, got %', v_count;
  END IF;
END $$;
