-- Command Center V2 — Commit 1: live presence layer
-- APPLIED VIA MCP 2026-05-14. This file is documentation-only per repo convention.
CREATE TABLE IF NOT EXISTS public.live_sessions (
  session_id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  current_path text, referrer text,
  city text, region text, country text,
  device text, user_agent text, ip inet,
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  cart_value_cents bigint NOT NULL DEFAULT 0,
  cart_item_count int NOT NULL DEFAULT 0,
  cart_market_slug text,
  has_signed_in boolean NOT NULL DEFAULT false,
  has_cart boolean NOT NULL DEFAULT false,
  has_groundcheck boolean NOT NULL DEFAULT false,
  page_view_count int NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_live_sessions_last_seen ON public.live_sessions (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_sessions_user ON public.live_sessions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_live_sessions_cart ON public.live_sessions (cart_value_cents DESC, last_seen_at DESC) WHERE has_cart;
CREATE INDEX IF NOT EXISTS idx_live_sessions_city ON public.live_sessions (city, last_seen_at DESC);
CREATE OR REPLACE VIEW public.live_sessions_active AS
SELECT *,
  (last_seen_at > (now() - interval '90 seconds')) AS active,
  extract(epoch from (now() - last_seen_at))::int AS seconds_since_last_seen,
  extract(epoch from (last_seen_at - first_seen_at))::int AS session_duration_seconds
FROM public.live_sessions WHERE last_seen_at > (now() - interval '90 seconds');
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS live_sessions_admin_read ON public.live_sessions;
CREATE POLICY live_sessions_admin_read ON public.live_sessions FOR SELECT TO authenticated USING (is_admin());
GRANT SELECT ON public.live_sessions_active TO authenticated;
CREATE OR REPLACE FUNCTION public.cleanup_stale_live_sessions() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM public.live_sessions WHERE last_seen_at < (now() - interval '24 hours');
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_stale_live_sessions() FROM public;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
