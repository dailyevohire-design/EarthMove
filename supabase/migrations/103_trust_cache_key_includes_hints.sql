DROP FUNCTION IF EXISTS public.set_cached_trust_report(text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.get_cached_trust_report(text, text, text);

CREATE FUNCTION public.set_cached_trust_report(
  p_contractor text,
  p_state text,
  p_tier text,
  p_payload jsonb,
  p_hint_hash text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  ck  TEXT;
  ttl INTERVAL;
BEGIN
  ck  := MD5(LOWER(TRIM(p_contractor)) || p_state || p_tier || COALESCE(p_hint_hash, ''));
  ttl := CASE p_tier
    WHEN 'free'       THEN INTERVAL '1 hour'
    WHEN 'pro'        THEN INTERVAL '6 hours'
    WHEN 'enterprise' THEN INTERVAL '1 hour'
    WHEN 'standard'   THEN INTERVAL '30 days'
    WHEN 'plus'       THEN INTERVAL '14 days'
    WHEN 'deep_dive'  THEN INTERVAL '14 days'
    WHEN 'forensic'   THEN INTERVAL '7 days'
    ELSE                   INTERVAL '1 hour'
  END;
  INSERT INTO trust_cache (cache_key, contractor, state_code, payload, tier, expires_at)
  VALUES (ck, p_contractor, p_state, p_payload, p_tier, NOW() + ttl)
  ON CONFLICT (cache_key) DO UPDATE SET
    payload    = EXCLUDED.payload,
    expires_at = EXCLUDED.expires_at,
    hit_count  = trust_cache.hit_count + 1,
    updated_at = NOW();
END;
$func$;

CREATE FUNCTION public.get_cached_trust_report(
  p_contractor text,
  p_state text,
  p_tier text,
  p_hint_hash text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  ck TEXT;
  v_payload jsonb;
BEGIN
  ck := MD5(LOWER(TRIM(p_contractor)) || p_state || p_tier || COALESCE(p_hint_hash, ''));
  UPDATE trust_cache
     SET hit_count = hit_count + 1
   WHERE cache_key = ck
     AND expires_at > NOW()
  RETURNING payload INTO v_payload;
  RETURN v_payload;
END;
$func$;
