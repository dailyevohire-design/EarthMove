-- Migration 031: driver_sessions (prod version 20260418173029)
-- Applied to prod 2026-04-18 via Supabase MCP (commit pending).
-- Purpose: SMS-link -> PWA session bootstrap with one-time token + device fingerprint binding.

CREATE TABLE IF NOT EXISTS public.driver_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  dispatch_id uuid REFERENCES public.dispatches(id) ON DELETE SET NULL,
  phone_e164 text NOT NULL,
  tracking_mode text NOT NULL DEFAULT 'link_pwa'
    CHECK (tracking_mode IN ('link_pwa','sms_geocheck','carrier_verified','hybrid')),
  bootstrap_token_hash text NOT NULL,
  bootstrap_consumed_at timestamptz,
  session_token_hash text,
  device_fingerprint_sha256 text,
  user_agent text,
  ip_inet inet,
  consent_recorded_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_ping_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  closed_reason text
    CHECK (closed_reason IS NULL OR closed_reason IN
      ('completed','tab_closed','expired','revoked_by_driver','revoked_by_ops',
       'fingerprint_mismatch','token_replay','dispatch_cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_sessions_driver_id_idx ON public.driver_sessions (driver_id);
CREATE INDEX IF NOT EXISTS driver_sessions_dispatch_id_idx ON public.driver_sessions (dispatch_id) WHERE dispatch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS driver_sessions_live_idx ON public.driver_sessions (phone_e164, expires_at DESC) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS driver_sessions_bootstrap_hash_idx ON public.driver_sessions (bootstrap_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS driver_sessions_session_hash_idx ON public.driver_sessions (session_token_hash) WHERE session_token_hash IS NOT NULL;

CREATE TRIGGER trg_driver_sessions_updated_at
  BEFORE UPDATE ON public.driver_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.driver_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY driver_sessions_service_all ON public.driver_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY driver_sessions_self_read ON public.driver_sessions FOR SELECT TO authenticated
  USING (driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = (SELECT auth.uid())));

CREATE POLICY driver_sessions_self_revoke ON public.driver_sessions FOR UPDATE TO authenticated
  USING (driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = (SELECT auth.uid())))
  WITH CHECK (driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = (SELECT auth.uid())));

CREATE POLICY driver_sessions_admin ON public.driver_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

COMMENT ON TABLE public.driver_sessions IS 'Appless SMS-link PWA session bootstrap for driver GPS tracking. One-time bootstrap token + device fingerprint binding. T2 migration 021.';
