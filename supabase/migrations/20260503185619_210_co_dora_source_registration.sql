-- 210_co_dora_source_registration
--
-- Registers source_key='co_dora' for the Colorado DORA Professional &
-- Occupational Licenses scraper. Uses Socrata SODA dataset 7s5z-vewr —
-- updated daily, has both licensure status AND disciplinary fields per
-- row (casenumber, programaction, disciplineeffectivedate). Bypasses
-- the apps2.colorado.gov ASPX VIEWSTATE form entirely.
--
-- Coverage: ALL CO professional/occupational licenses including
-- electricians, plumbers, CPAs, nurses, real estate. CO has no statewide
-- GC license — for general contractors, this scraper returns
-- license_no_record (which downstream synth treats as neutral, not
-- adverse, given the documented coverage scope).

INSERT INTO trust_source_registry (
  source_key, display_name, source_category, applicable_state_codes,
  access_method, base_url, query_template,
  auth_type, rate_limit_per_minute, cost_per_call_cents,
  is_active, confidence_weight, applicable_tiers,
  notes, metadata
) VALUES (
  'co_dora',
  'Colorado DORA Professional & Occupational Licenses',
  'state_license',
  ARRAY['CO'],
  'rest_api',
  'https://data.colorado.gov/resource/7s5z-vewr.json',
  '?$where=upper(entityname)%20like%20upper(%27%25{contractor_name}%25%27)%20OR%20upper(lastname)%20like%20upper(%27%25{contractor_name}%25%27)&$limit=10',
  'none',
  30,
  0.0000,
  true,
  0.95,
  ARRAY['standard','plus','deep_dive','forensic']::text[],
  'CO DORA Socrata SODA dataset 7s5z-vewr. Daily-updated roster of all CO professional/occupational licenses. Per-row fields: licensetype, licensenumber, licensestatusdescription, casenumber, programaction, disciplineeffectivedate, disciplinecompletedate, linktoverifylicense. License-status mapping: Active+no programaction → license_active; Active+programaction → license_disciplinary_action; Suspended → license_suspended; Revoked → license_revoked; Expired → license_expired.',
  jsonb_build_object(
    'jurisdiction', 'colorado',
    'soda_dataset', '7s5z-vewr',
    'agency', 'Colorado DORA',
    'license_types_covered', ARRAY['electrician','plumber','cpa','nurse','real_estate','other_occupational'],
    'launch_priority', 1
  )
)
ON CONFLICT (source_key) DO UPDATE SET
  applicable_tiers = EXCLUDED.applicable_tiers,
  is_active = EXCLUDED.is_active,
  base_url = EXCLUDED.base_url,
  query_template = EXCLUDED.query_template,
  notes = EXCLUDED.notes,
  metadata = trust_source_registry.metadata || EXCLUDED.metadata,
  updated_at = NOW();
