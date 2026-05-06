-- 221_osha_correct_apiprod_host
-- Migration 220 pointed at data.dol.gov which is the Drupal portal (returns HTML).
-- Curl probes confirmed actual JSON v4 host is apiprod.dol.gov, auth param is
-- X-API-KEY (uppercase, hyphenated) as query param, response shape is {"data":[...]},
-- and single-condition {field,operator:'gt',value} filter shape works on case_mod_date.

UPDATE public.trust_source_registry
SET
  base_url = 'https://apiprod.dol.gov/v4/get/OSHA/inspection/json',
  query_template = 'GET https://apiprod.dol.gov/v4/get/OSHA/inspection/json?X-API-KEY=$DOL_API_KEY&limit=10000&offset=$OFFSET&filter_object={"field":"case_mod_date","operator":"gt","value":"$SINCE"}&sort_by=open_date&sort=desc',
  notes = 'Pulled from DOL apiprod.dol.gov v4 JSON API (free key from dataportal.dol.gov/registration). Two-pass ingest: inspections filtered server-side by case_mod_date with NAICS 23% post-filtered in JS; violations pulled separately, JS-filtered to known activity_nrs. Mirrored locally into osha_establishments / osha_inspections / osha_violations. Score-time lookup via osha_lookup_findings() — no external HTTP at score time. 5yr lookback enforced in lookup function.',
  metadata = jsonb_build_object(
    'ingestion_strategy', 'mirror_two_pass',
    'incremental_field_inspection', 'case_mod_date',
    'incremental_field_violation', 'issuance_date',
    'api_key_env', 'DOL_API_KEY',
    'api_key_param', 'X-API-KEY',
    'response_shape', '{"data":[...]}',
    'naics_filter_strategy', 'js_post_filter',
    'naics_filter', '23%',
    'lookback_years', 5,
    'verified_filter_shape', '{"field":"<col>","operator":"gt","value":"<v>"}',
    'pivoted_at', '2026-05-06T19:00:00Z'
  ),
  updated_at = now()
WHERE source_key = 'osha_est_search';

DO $$
DECLARE v_url text;
BEGIN
  SELECT base_url INTO v_url FROM public.trust_source_registry WHERE source_key = 'osha_est_search';
  IF v_url <> 'https://apiprod.dol.gov/v4/get/OSHA/inspection/json' THEN
    RAISE EXCEPTION 'OSHA host correction failed: base_url is %', v_url;
  END IF;
END $$;
