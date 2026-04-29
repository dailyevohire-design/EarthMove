-- ============================================================================
-- Migration: guest checkout + match-funnel telemetry
-- Purpose:
--   1. Track signup-promo redemption (WELCOME5, single-use per user)
--   2. Capture sourcing-required leads from materialMatchV2 Reserve CTA
--   3. Capture funnel telemetry on Material Match → /checkout/start handoffs
--   4. Allow guests to read their own orders via signed JWT claim (RLS policy)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles: signup-promo redemption tracking
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_promo_code text,
  ADD COLUMN IF NOT EXISTS signup_promo_redeemed_at timestamptz;

COMMENT ON COLUMN public.profiles.signup_promo_code IS
  'Single-use promo applied at signup (e.g. WELCOME5). Set when redeemed. Null = never redeemed.';
COMMENT ON COLUMN public.profiles.signup_promo_redeemed_at IS
  'Timestamp of redemption. Used to enforce single-use per user without a separate redemption table.';

-- Partial index for fast lookup of users who have NOT yet redeemed
CREATE INDEX IF NOT EXISTS idx_profiles_signup_promo_unredeemed
  ON public.profiles (id)
  WHERE signup_promo_redeemed_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. material_match_leads — sourcing-required lead form submissions
--    Triggered by Reserve this material → on Lime Rock-style results
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.material_match_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Project context (from wizard)
  market_id uuid NOT NULL REFERENCES public.markets(id),
  material_catalog_id uuid REFERENCES public.material_catalog(id),
  material_name_snapshot text NOT NULL,
  tons numeric CHECK (tons > 0),
  zip text,
  project_type text,
  sub_type text,
  delivery_window text CHECK (delivery_window IN ('this_week','next_2_weeks','this_month','researching')),

  -- Contact
  full_name text NOT NULL,
  phone text,
  email text NOT NULL,
  contact_method text CHECK (contact_method IN ('phone','text','email')),
  best_time text,

  -- Lifecycle
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','sourced','converted','lost')),
  contacted_at timestamptz,
  sourced_at timestamptz,
  converted_to_order_id uuid REFERENCES public.orders(id),

  -- Provenance
  source text NOT NULL DEFAULT 'material-match-sourcing-required',
  ip_inet inet,
  user_agent text
);

COMMENT ON TABLE public.material_match_leads IS
  'Lead capture for sourcing-required material matches. Source: materialMatchV2 Reserve CTA when zero verified DFW suppliers.';

CREATE INDEX idx_mml_market_status_created
  ON public.material_match_leads (market_id, status, created_at DESC);
CREATE INDEX idx_mml_email_lower
  ON public.material_match_leads (lower(email));

CREATE TRIGGER trg_mml_updated_at
  BEFORE UPDATE ON public.material_match_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- 3. material_match_intents — funnel telemetry
--    Fires on Order this material / View this option / Order today CTAs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.material_match_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Project context
  market_id uuid REFERENCES public.markets(id),
  material_catalog_id uuid REFERENCES public.material_catalog(id),
  tons numeric CHECK (tons > 0),
  zip text,
  project_type text,
  sub_type text,
  delivery_window text,

  -- Buyer identity (one of these is set)
  authed_user_id uuid REFERENCES auth.users(id),
  anon_session_id text,

  -- Outcome
  resulted_in text
    CHECK (resulted_in IN ('signup','guest_checkout','abandoned','order')),
  converted_to_order_id uuid REFERENCES public.orders(id),
  resolved_at timestamptz,

  -- Provenance
  source text NOT NULL DEFAULT 'material-match-verified',
  ip_inet inet,
  user_agent text,

  CONSTRAINT mmi_has_identity
    CHECK (authed_user_id IS NOT NULL OR anon_session_id IS NOT NULL)
);

COMMENT ON TABLE public.material_match_intents IS
  'Funnel telemetry: every click on a verified-stock match CTA. Lets us measure abandonment between Match → checkout/start → /checkout → paid order.';

CREATE INDEX idx_mmi_authed_user_created
  ON public.material_match_intents (authed_user_id, created_at DESC)
  WHERE authed_user_id IS NOT NULL;
CREATE INDEX idx_mmi_anon_session_created
  ON public.material_match_intents (anon_session_id, created_at DESC)
  WHERE anon_session_id IS NOT NULL;
CREATE INDEX idx_mmi_market_resulted
  ON public.material_match_intents (market_id, resulted_in, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. RLS policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.material_match_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_match_intents ENABLE ROW LEVEL SECURITY;

-- material_match_leads: service_role writes; admin reads.
-- (Lead-submitter view-via-signed-token is handled at API layer, not RLS.)
CREATE POLICY mml_service_all
  ON public.material_match_leads
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY mml_admin_select
  ON public.material_match_leads
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );

-- material_match_intents: service_role writes; user reads own.
CREATE POLICY mmi_service_all
  ON public.material_match_intents
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY mmi_user_select_own
  ON public.material_match_intents
  FOR SELECT TO authenticated
  USING (authed_user_id = (SELECT auth.uid()));

CREATE POLICY mmi_admin_select_all
  ON public.material_match_intents
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- 5. orders RLS — guest read via signed JWT claim
-- ---------------------------------------------------------------------------
-- Pattern: /track/[order_id]?token=<signed_jwt> route validates JWT server-side,
-- extracts order_id, sets local claim. RLS reads from request.jwt.claims.

CREATE POLICY orders_guest_read_signed
  ON public.orders
  FOR SELECT
  USING (
    customer_id IS NULL
    AND id::text = (
      current_setting('request.jwt.claims', true)::jsonb ->> 'guest_order_id'
    )
  );

COMMENT ON POLICY orders_guest_read_signed ON public.orders IS
  'Guests read their own order at /track/[id]?token=… The token is a signed JWT containing guest_order_id claim. Set via Supabase auth.setSession with custom JWT.';

-- ---------------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------------
