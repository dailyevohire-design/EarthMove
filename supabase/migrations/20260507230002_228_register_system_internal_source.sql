-- Migration 228: register 'system_internal' source_key for orchestrator-emitted
-- evidence rows that aren't backed by an external scraper (name-discrepancy
-- observations from the disambiguation click-through path, future internal
-- inferences). Extends source_category CHECK to add 'system' category.

ALTER TABLE trust_source_registry DROP CONSTRAINT IF EXISTS trust_source_registry_source_category_check;
ALTER TABLE trust_source_registry ADD CONSTRAINT trust_source_registry_source_category_check
  CHECK (source_category = ANY (ARRAY[
    'state_license'::text, 'state_business_entity'::text, 'court_federal'::text,
    'court_state'::text, 'regulatory_osha'::text, 'bbb'::text, 'review_platform'::text,
    'news'::text, 'ag_fraud'::text, 'lien_recorder'::text, 'sanctions'::text,
    'sos_federal'::text, 'llm_search'::text, 'municipal_permits'::text,
    'system'::text
  ]));

INSERT INTO trust_source_registry (
  source_key, display_name, source_category, access_method, base_url,
  auth_type, rate_limit_per_minute, cost_per_call_cents, is_active,
  confidence_weight, applicable_state_codes, applicable_tiers, notes, metadata
) VALUES (
  'system_internal',
  'Groundcheck Internal Inference',
  'system',
  'rest_api',
  'internal://groundcheck',
  'none',
  10000,
  0,
  true,
  1.0,
  NULL,
  ARRAY['free','standard','plus','deep_dive','forensic'],
  'Orchestrator-emitted evidence rows: name-discrepancy observations from disambiguation click-through, future internal inference signals. Not an external data source.',
  '{"emits_finding_types": ["name_discrepancy_observed", "entity_disambiguation_candidates"]}'::jsonb
)
ON CONFLICT (source_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  source_category = EXCLUDED.source_category,
  is_active = true,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = now();
