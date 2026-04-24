-- 107_collections_assist.sql
-- Collections Assist v0 — CO + TX commercial demand letter + pre-lien/intent + mechanic's lien.
-- Feature-flagged OFF at the app layer (NEXT_PUBLIC_COLLECTIONS_ENABLED). This migration
-- is safe to apply under the flag-off posture: no route can touch these tables until the
-- flag flips.

BEGIN;

CREATE TYPE collections_status AS ENUM (
  'draft','pending_payment','paid','documents_ready','downloaded','refunded','counsel_review'
);

CREATE TYPE collections_state AS ENUM ('CO','TX');
CREATE TYPE collections_contractor_role AS ENUM (
  'original_contractor','subcontractor','sub_subcontractor','material_supplier','other'
);
CREATE TYPE collections_property_type AS ENUM (
  'commercial','residential_non_homestead','residential_homestead','mixed_use','industrial','other'
);

CREATE TABLE collections_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status collections_status NOT NULL DEFAULT 'draft',
  state_code collections_state NOT NULL,

  -- Role + property type drive state-specific template + deadline logic
  contractor_role collections_contractor_role NOT NULL,
  property_type collections_property_type NOT NULL,
  is_homestead boolean NOT NULL DEFAULT false,

  -- Claimant
  claimant_name text NOT NULL,
  claimant_address text NOT NULL,
  claimant_phone text,
  claimant_email text,
  claimant_entity_type text CHECK (claimant_entity_type IN ('individual','llc','corporation','partnership','sole_proprietor','other')),

  -- Respondent (the party who owes money directly)
  respondent_name text NOT NULL,
  respondent_address text NOT NULL,
  respondent_relationship text CHECK (respondent_relationship IN ('general_contractor','subcontractor','property_owner','developer','other')),

  -- Property
  property_street_address text NOT NULL,
  property_city text NOT NULL,
  property_state collections_state NOT NULL,
  property_zip text NOT NULL,
  property_county text NOT NULL,
  property_legal_description text,

  -- Property owner (may differ from respondent; required for lien)
  property_owner_name text,
  property_owner_address text,
  owner_lookup_method text CHECK (owner_lookup_method IN ('manual','county_assessor_link','automated_phase2')),
  owner_lookup_source_url text,

  -- Texas-specific: original contractor on homestead requires pre-work written contract signed by both spouses
  original_contract_signed_date date,
  original_contract_both_spouses_signed boolean,

  -- Claim
  work_description text NOT NULL,
  first_day_of_work date NOT NULL,
  last_day_of_work date NOT NULL CHECK (last_day_of_work >= first_day_of_work),
  amount_owed_cents bigint NOT NULL CHECK (amount_owed_cents > 0),

  -- Texas pre-lien notice tracking (audit trail — Texas requires multiple)
  pre_lien_notices_sent date[] NOT NULL DEFAULT ARRAY[]::date[],

  -- Payment
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  amount_paid_cents integer,

  -- Output
  documents_generated_at timestamptz,
  demand_letter_storage_path text,
  pre_lien_notice_storage_path text,          -- TX
  notice_of_intent_storage_path text,         -- CO
  lien_document_storage_path text,
  first_downloaded_at timestamptz,
  download_count integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Enforce Texas v0 gate at the DB level: TX must be commercial/industrial, non-homestead
  CONSTRAINT tx_v0_scope CHECK (
    state_code <> 'TX'
    OR (
      property_type IN ('commercial','industrial')
      AND is_homestead = false
    )
  ),
  -- CO accepts commercial + industrial + residential_non_homestead + mixed_use; homestead blocked
  CONSTRAINT co_v0_scope CHECK (
    state_code <> 'CO'
    OR (
      property_type IN ('commercial','industrial','residential_non_homestead','mixed_use')
    )
  )
);

CREATE INDEX idx_coll_cases_user ON collections_cases(user_id, created_at DESC);
CREATE INDEX idx_coll_cases_status ON collections_cases(status, created_at DESC);
CREATE INDEX idx_coll_cases_state ON collections_cases(state_code, status);

ALTER TABLE collections_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY collections_cases_own_all ON collections_cases
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY collections_cases_service ON collections_cases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER collections_cases_touch
  BEFORE UPDATE ON collections_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Append-only audit log
CREATE TABLE collections_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES collections_cases(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created','intake_submitted','checkout_started','paid','documents_generated',
    'downloaded','refunded','counsel_flag','error','pre_lien_notice_logged'
  )),
  event_payload jsonb,
  actor_user_id uuid,
  stripe_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coll_events_case ON collections_case_events(case_id, created_at DESC);
CREATE INDEX idx_coll_events_stripe ON collections_case_events(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

ALTER TABLE collections_case_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY coll_events_read_own ON collections_case_events
  FOR SELECT USING (
    case_id IN (SELECT id FROM collections_cases WHERE user_id = (SELECT auth.uid()))
  );
CREATE POLICY coll_events_service ON collections_case_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Append-only: no UPDATE or DELETE policies for non-service users.

CREATE OR REPLACE FUNCTION public.grant_collections_case_from_stripe_event(
  p_stripe_event_id text,
  p_event_type text,
  p_case_id uuid,
  p_user_id uuid,
  p_amount_cents integer,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_case collections_cases;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing
  FROM collections_case_events
  WHERE stripe_event_id = p_stripe_event_id AND event_type = 'paid'
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN p_case_id;
  END IF;

  SELECT * INTO v_case FROM collections_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'case % not found', p_case_id;
  END IF;
  IF v_case.user_id <> p_user_id THEN
    RAISE EXCEPTION 'case user mismatch';
  END IF;

  IF v_case.status IN ('paid','documents_ready','downloaded') THEN
    INSERT INTO collections_case_events (case_id, event_type, event_payload, stripe_event_id, actor_user_id)
    VALUES (p_case_id, 'paid', jsonb_build_object('duplicate', true, 'payload', p_payload), p_stripe_event_id, p_user_id);
    RETURN p_case_id;
  END IF;

  UPDATE collections_cases
  SET status = 'paid',
      stripe_checkout_session_id = p_stripe_session_id,
      stripe_payment_intent_id = p_stripe_payment_intent_id,
      paid_at = now(),
      amount_paid_cents = p_amount_cents
  WHERE id = p_case_id;

  INSERT INTO collections_case_events (case_id, event_type, event_payload, stripe_event_id, actor_user_id)
  VALUES (p_case_id, 'paid',
          jsonb_build_object('amount_cents', p_amount_cents, 'session_id', p_stripe_session_id, 'payload', p_payload),
          p_stripe_event_id, p_user_id);

  RETURN p_case_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.grant_collections_case_from_stripe_event(text,text,uuid,uuid,integer,text,text,jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.grant_collections_case_from_stripe_event(text,text,uuid,uuid,integer,text,text,jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_collections_case_from_stripe_event(text,text,uuid,uuid,integer,text,text,jsonb) TO service_role;

-- Storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('collections','collections', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
