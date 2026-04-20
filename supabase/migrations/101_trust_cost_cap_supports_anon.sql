DROP FUNCTION IF EXISTS public.check_trust_daily_cost_cap(uuid, numeric);

CREATE FUNCTION public.check_trust_daily_cost_cap(
  p_user_id uuid,
  p_cap_usd numeric
) RETURNS TABLE(allowed boolean, used_usd numeric, cap_usd numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_used numeric;
BEGIN
  SELECT COALESCE(SUM(cost_usd), 0)
    INTO v_used
  FROM public.trust_api_usage
  WHERE user_id IS NOT DISTINCT FROM p_user_id
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc');

  RETURN QUERY SELECT
    (v_used < p_cap_usd) AS allowed,
    v_used AS used_usd,
    p_cap_usd AS cap_usd;
END;
$func$;

CREATE INDEX IF NOT EXISTS idx_trust_api_usage_anon_daily
  ON public.trust_api_usage (created_at)
  WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_trust_api_usage_user_daily
  ON public.trust_api_usage (user_id, created_at)
  WHERE user_id IS NOT NULL;
