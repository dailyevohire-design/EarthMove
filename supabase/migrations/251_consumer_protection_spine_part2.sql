-- consumer_protection_spine_part2.sql
--
-- DOC-SYNC PART 2: completes the repo<->prod drift closure begun in the
-- mig 249/250 reconstruction. Adds the 5 tables that the earlier
-- reconstruction missed:
--   contractor_portfolio_claims    feature 1 (portfolio cross-ref)
--   small_claims_filings           feature 2 (neighborhood signal)
--   contractor_held_licenses       feature 3 (license scope)
--   license_scope_taxonomy         feature 3 (license scope, with 12 seed rows)
--   coi_verifications              feature 4 (insurance verification)
--
-- All 5 tables already exist in production. DDL extracted verbatim from
-- pg_class + information_schema + pg_constraint via Supabase MCP at
-- commit time. Re-applying this migration on a fresh checkout produces
-- the exact prod schema state. The 12 license_scope_taxonomy seed rows
-- are extracted from prod and idempotent-inserted via ON CONFLICT
-- DO NOTHING.
--
-- NOT FOR RE-APPLICATION on existing prod: every statement is idempotent
-- (IF NOT EXISTS, ON CONFLICT DO NOTHING) so re-running produces no net
-- change.

BEGIN;

-- ─── contractor_portfolio_claims ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contractor_portfolio_claims (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id            uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  claim_source             text NOT NULL CHECK (claim_source = ANY (ARRAY[
                             'website','facebook','google_business','yelp','angi','manual'])),
  source_url               text,
  claimed_address          text,
  claimed_address_geocoded jsonb,
  image_url                text,
  image_exif_address       text,
  observed_at              timestamptz NOT NULL DEFAULT now(),
  matches_known_permit     boolean
);
CREATE INDEX IF NOT EXISTS idx_cpc_contractor ON contractor_portfolio_claims (contractor_id);

-- ─── small_claims_filings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS small_claims_filings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id            uuid REFERENCES contractors(id) ON DELETE SET NULL,
  defendant_name_raw       text NOT NULL,
  plaintiff_name_raw       text,
  plaintiff_zip            text,
  court_jurisdiction       text NOT NULL,
  case_number              text NOT NULL,
  case_status              text,
  case_filed_date          date NOT NULL,
  case_resolved_date       date,
  resolution_type          text,
  amount_in_controversy    numeric,
  source                   text NOT NULL,
  raw_record               jsonb,
  ingested_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (court_jurisdiction, case_number)
);
CREATE INDEX IF NOT EXISTS idx_scf_contractor     ON small_claims_filings (contractor_id);
CREATE INDEX IF NOT EXISTS idx_scf_zip_filed      ON small_claims_filings (plaintiff_zip, case_filed_date DESC);
CREATE INDEX IF NOT EXISTS idx_scf_defendant_trgm ON small_claims_filings USING gin (defendant_name_raw gin_trgm_ops);

-- ─── contractor_held_licenses ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contractor_held_licenses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id       uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  jurisdiction        text NOT NULL,
  license_class_code  text NOT NULL,
  license_number      text NOT NULL,
  license_status      text NOT NULL,
  issued_date         date,
  expires_date        date,
  source              text NOT NULL,
  raw_record          jsonb,
  observed_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contractor_id, jurisdiction, license_number)
);
CREATE INDEX IF NOT EXISTS idx_chl_contractor ON contractor_held_licenses (contractor_id);
CREATE INDEX IF NOT EXISTS idx_chl_status     ON contractor_held_licenses (license_status);

-- ─── license_scope_taxonomy (table + 12 seed rows) ───────────────────────────
CREATE TABLE IF NOT EXISTS license_scope_taxonomy (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction        text NOT NULL,
  license_class_code  text NOT NULL,
  license_class_label text NOT NULL,
  authorized_scopes   text[] NOT NULL,
  source_url          text,
  effective_from      date NOT NULL DEFAULT CURRENT_DATE,
  effective_until     date,
  notes               text,
  UNIQUE (jurisdiction, license_class_code)
);
CREATE INDEX IF NOT EXISTS idx_lst_jurisdiction ON license_scope_taxonomy (jurisdiction);
CREATE INDEX IF NOT EXISTS idx_lst_scopes       ON license_scope_taxonomy USING gin (authorized_scopes);

INSERT INTO license_scope_taxonomy (jurisdiction, license_class_code, license_class_label, authorized_scopes, source_url, notes) VALUES
  ('CO_DORA',   'EC',  'Electrical Contractor',      ARRAY['electrical','wiring','lighting','panel_upgrade'],                                                                                                              'https://apps.colorado.gov/dora/licensing/Lookup/LicenseLookup.aspx',                                                                                                                'CO state-level electrical only'),
  ('CO_DORA',   'PC',  'Plumbing Contractor',        ARRAY['plumbing','water_heater','drain','sewer','gas_line'],                                                                                                          'https://apps.colorado.gov/dora/licensing/Lookup/LicenseLookup.aspx',                                                                                                                'CO state-level plumbing only'),
  ('CO_DORA',   'ME',  'Master Electrician',         ARRAY['electrical','wiring','lighting','panel_upgrade','industrial_electrical'],                                                                                      'https://apps.colorado.gov/dora/licensing/Lookup/LicenseLookup.aspx',                                                                                                                NULL),
  ('CO_DORA',   'MP',  'Master Plumber',             ARRAY['plumbing','water_heater','drain','sewer','gas_line','industrial_plumbing'],                                                                                    'https://apps.colorado.gov/dora/licensing/Lookup/LicenseLookup.aspx',                                                                                                                NULL),
  ('DENVER_CPD','A',   'General Contractor A',       ARRAY['general','structural','foundation','framing','roofing','siding','kitchen_remodel','bath_remodel','addition','new_construction'],                               'https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Community-Planning-and-Development/Contractor-Licensing',                  'Denver Class A — unlimited'),
  ('DENVER_CPD','B',   'General Contractor B',       ARRAY['general','structural','foundation','framing','roofing','siding','kitchen_remodel','bath_remodel','addition'],                                                  NULL,                                                                                                                                                                                'Denver Class B — buildings up to 3 stories'),
  ('DENVER_CPD','C',   'General Contractor C',       ARRAY['general','kitchen_remodel','bath_remodel','siding','interior_remodel'],                                                                                        NULL,                                                                                                                                                                                'Denver Class C — residential non-structural'),
  ('DENVER_CPD','D',   'Home Improvement',           ARRAY['kitchen_remodel','bath_remodel','siding','interior_remodel','flooring','painting'],                                                                            NULL,                                                                                                                                                                                'Denver Class D — cosmetic only'),
  ('TX_TDLR',   'AC',  'AC/Refrigeration',           ARRAY['hvac','ac','refrigeration','furnace'],                                                                                                                         'https://www.tdlr.texas.gov/cimsfo/fosearch.asp',                                                                                                                                    'TX state-level HVAC'),
  ('TX_TDLR',   'ELC', 'Electrical Contractor',      ARRAY['electrical','wiring','lighting','panel_upgrade'],                                                                                                              'https://www.tdlr.texas.gov/cimsfo/fosearch.asp',                                                                                                                                    'TX state-level electrical'),
  ('TX_TSBPE',  'MP',  'Master Plumber TX',          ARRAY['plumbing','water_heater','drain','sewer','gas_line'],                                                                                                          'https://www.tsbpe.texas.gov/',                                                                                                                                                      'TX state-level plumbing'),
  ('DALLAS',    'GC',  'Dallas General Contractor',  ARRAY['general','structural','foundation','framing','roofing','siding','kitchen_remodel','bath_remodel','addition','new_construction'],                               NULL,                                                                                                                                                                                'Dallas requires GC registration >$50K')
ON CONFLICT (jurisdiction, license_class_code) DO NOTHING;

-- ─── coi_verifications ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coi_verifications (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id            uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  carrier_name             text NOT NULL,
  carrier_naic_code        text,
  policy_number            text NOT NULL,
  coverage_type            text NOT NULL CHECK (coverage_type = ANY (ARRAY[
                             'general_liability','workers_comp','commercial_auto','umbrella',
                             'professional_liability','other'])),
  coverage_limit           numeric,
  policy_effective_date    date,
  policy_expiration_date   date,
  certificate_holder       text,
  verification_status      text NOT NULL DEFAULT 'unverified' CHECK (verification_status = ANY (ARRAY[
                             'unverified','verified_active','verified_lapsed','verified_canceled',
                             'carrier_unreachable','suspected_fraudulent'])),
  verification_method      text CHECK (verification_method = ANY (ARRAY[
                             'carrier_api','agent_portal','phone_callback','fax_back','document_only','none'])),
  verified_at              timestamptz,
  verified_by              text,
  raw_coi_document_url     text,
  raw_carrier_response     jsonb,
  notes                    text,
  observed_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contractor_id, carrier_name, policy_number)
);
CREATE INDEX IF NOT EXISTS idx_coi_contractor ON coi_verifications (contractor_id);
CREATE INDEX IF NOT EXISTS idx_coi_status     ON coi_verifications (verification_status);
CREATE INDEX IF NOT EXISTS idx_coi_expiration ON coi_verifications (policy_expiration_date);

-- ─── Post-condition: confirm all 5 tables exist + 12 seed rows ──────────────
DO $post$
DECLARE
  table_count int;
  seed_count int;
BEGIN
  SELECT count(*) INTO table_count FROM pg_tables
    WHERE schemaname='public' AND tablename IN (
      'contractor_portfolio_claims','small_claims_filings',
      'contractor_held_licenses','license_scope_taxonomy','coi_verifications'
    );
  SELECT count(*) INTO seed_count FROM license_scope_taxonomy;

  IF table_count <> 5 THEN
    RAISE EXCEPTION 'doc-sync part2 postcondition: expected 5 tables, found %', table_count;
  END IF;
  IF seed_count < 12 THEN
    RAISE EXCEPTION 'doc-sync part2 postcondition: license_scope_taxonomy has % rows, expected >=12', seed_count;
  END IF;
  RAISE NOTICE 'doc-sync part2: % tables present, % seed rows', table_count, seed_count;
END $post$;

COMMIT;
