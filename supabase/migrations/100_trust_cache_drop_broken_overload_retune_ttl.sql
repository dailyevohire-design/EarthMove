-- Mirrors a live-DB change already applied via Supabase MCP.
--
-- 1. Drop the stale overload that accepted (text, text, text, jsonb) — it never
--    matched the actual trust_cache.state_code column type and caused silent
--    failures when Postgres picked the wrong signature.
-- 2. Drop the (text, character, text, jsonb) signature as well so we can
--    recreate it cleanly with p_state TEXT (matches how the route passes it).
-- 3. Recreate set_cached_trust_report with retuned TTLs: free=1h, pro=6h,
--    enterprise=1h (enterprise is orphaned — route skips the read — but kept
--    short so stray writes age out fast). Paid tiers (standard/plus/deep_dive/
--    forensic) unchanged.

DROP FUNCTION IF EXISTS public.set_cached_trust_report(text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.set_cached_trust_report(text, character, text, jsonb);

CREATE FUNCTION public.set_cached_trust_report(
  p_contractor text,
  p_state      text,
  p_tier       text,
  p_payload    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  ck  TEXT;
  ttl INTERVAL;
BEGIN
  ck  := MD5(LOWER(TRIM(p_contractor)) || p_state || p_tier);
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
