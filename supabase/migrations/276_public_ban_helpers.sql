-- Public-schema wrappers around security.banned_ips / security.fn_ban_ip so PostgREST
-- can serve them. The security schema is not in API.exposed_schemas, so any
-- `.schema('security').rpc(...)` call from the app returns 406. Middleware then runs
-- on every page request and burns Supabase API quota for nothing.
--
-- public.fn_active_bans() returns the small set of currently-active banned IPs
-- which the middleware can cache in-process for O(1) lookup.
-- public.fn_ban_ip() is a thin pass-through to security.fn_ban_ip for writes.

CREATE OR REPLACE FUNCTION public.fn_active_bans()
RETURNS TABLE(ip text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = security, public
AS $$
  SELECT host(banned_ips.ip)
  FROM security.banned_ips
  WHERE expires_at > now();
$$;

REVOKE ALL ON FUNCTION public.fn_active_bans() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_active_bans() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_active_bans() TO service_role;

CREATE OR REPLACE FUNCTION public.fn_ban_ip(
  p_ip inet,
  p_reason text,
  p_minutes integer DEFAULT 60,
  p_source text DEFAULT 'manual'
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = security, public
AS $$
  SELECT security.fn_ban_ip(p_ip, p_reason, p_minutes, p_source);
$$;

REVOKE ALL ON FUNCTION public.fn_ban_ip(inet, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ban_ip(inet, text, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ban_ip(inet, text, integer, text) TO service_role;
