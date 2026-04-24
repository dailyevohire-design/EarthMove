-- P0-1. Create check_trust_rate_limit RPC. The TS rate-limiter in
-- src/lib/trust/rate-limiter.ts calls this on every /api/trust request;
-- until now the function did not exist in the DB and the route 500d on
-- every call. Signature returns { allowed, remaining, reset_at } to match
-- the Upstash-compatible shape /api/trust/route.ts expects.
--
-- trust_rate_limits already has PK (identifier, bucket); ON CONFLICT on the
-- PK serves as the single-row upsert target — no extra unique index needed.
--
-- SECURITY DEFINER with pinned search_path, EXECUTE revoked from public
-- (service_role only) so anon/authenticated cannot drain the rate budget
-- by calling the RPC directly.

CREATE OR REPLACE FUNCTION public.check_trust_rate_limit(
  p_identifier      text,
  p_bucket          text,
  p_max_requests    int,
  p_window_seconds  int
) RETURNS TABLE(allowed boolean, remaining int, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_count         int;
  v_window_start  timestamptz;
BEGIN
  INSERT INTO trust_rate_limits (identifier, bucket, count, window_start, updated_at)
  VALUES (p_identifier, p_bucket, 1, now(), now())
  ON CONFLICT (identifier, bucket) DO UPDATE SET
    count = CASE
      WHEN trust_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
        THEN 1
      ELSE trust_rate_limits.count + 1
    END,
    window_start = CASE
      WHEN trust_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
        THEN now()
      ELSE trust_rate_limits.window_start
    END,
    updated_at = now()
  RETURNING trust_rate_limits.count, trust_rate_limits.window_start
  INTO v_count, v_window_start;

  RETURN QUERY SELECT
    (v_count <= p_max_requests)                              AS allowed,
    GREATEST(p_max_requests - v_count, 0)                    AS remaining,
    v_window_start + make_interval(secs => p_window_seconds) AS reset_at;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.check_trust_rate_limit(text, text, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_trust_rate_limit(text, text, int, int) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_trust_rate_limit(text, text, int, int) TO service_role;

-- P1-11. Add advisory lock to the cost cap. Without the lock two concurrent
-- callers near the cap can both read v_used < cap, both get allowed=true,
-- and the subsequent Claude calls both count against the day. The lock is
-- scoped per user (anon share one key) and taken for the transaction only.

CREATE OR REPLACE FUNCTION public.check_trust_daily_cost_cap(
  p_user_id uuid,
  p_cap_usd numeric
) RETURNS TABLE(allowed boolean, used_usd numeric, cap_usd numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_used numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('trust_cost_cap:' || COALESCE(p_user_id::text, 'anon'))
  );

  SELECT COALESCE(SUM(cost_usd), 0)
    INTO v_used
  FROM public.trust_api_usage
  WHERE user_id IS NOT DISTINCT FROM p_user_id
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc');

  RETURN QUERY SELECT
    (v_used < p_cap_usd) AS allowed,
    v_used               AS used_usd,
    p_cap_usd            AS cap_usd;
END;
$func$;
