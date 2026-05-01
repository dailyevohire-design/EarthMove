-- 117_trust_anon_lookup.sql
-- C-Trust-2 Commit 1: anon Groundcheck lookup infrastructure.
--
-- Adds:
--   1. trust_anon_searches  — per-search audit log (IP-hashed, RLS-locked)
--   2. anon_trust_lookup()  — atomic cache-check + rate-limit + audit RPC
--   3. cache lookup index   — keeps anon path <5ms on cache hit
--
-- Does NOT touch the existing signup-credit pipeline (already live):
--   on_auth_user_created → handle_new_user → profile insert
--   → trust_grant_free_trial_on_profile_insert → grant_free_trial_credit
--
-- Idempotent. Re-applying is a no-op.

BEGIN;

-- ============================================================
-- 1. trust_anon_searches: audit log for anon searches
-- ============================================================

CREATE TABLE IF NOT EXISTS trust_anon_searches (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_hash         text NOT NULL,
  contractor_name text NOT NULL,
  state_code      character(2) NOT NULL,
  outcome         text NOT NULL CHECK (outcome = ANY (ARRAY['cached','rate_limited','queued','error']::text[])),
  report_id       uuid REFERENCES trust_reports(id) ON DELETE SET NULL,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trust_anon_searches_created_at
  ON trust_anon_searches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_anon_searches_ip_hash
  ON trust_anon_searches (ip_hash, created_at DESC);

ALTER TABLE trust_anon_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trust_anon_searches_admin_read ON trust_anon_searches;
CREATE POLICY trust_anon_searches_admin_read ON trust_anon_searches
  FOR SELECT
  USING ((SELECT (auth.jwt() ->> 'role')) = 'admin');

-- No INSERT / UPDATE / DELETE policies.
-- Inserts go through SECURITY DEFINER RPC (anon_trust_lookup) only.

-- ============================================================
-- 2. Cache lookup index on trust_reports
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_trust_reports_anon_cache_lookup
  ON trust_reports (LOWER(TRIM(contractor_name)), state_code, created_at DESC)
  WHERE data_integrity_status = 'ok' AND contractor_name NOT LIKE 'FTEST_%';

-- ============================================================
-- 3. anon_trust_lookup RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.anon_trust_lookup(
  p_ip              text,
  p_contractor_name text,
  p_state_code      text,
  p_user_agent      text DEFAULT NULL
)
RETURNS TABLE (
  outcome    text,
  report_id  uuid,
  remaining  integer,
  reset_at   timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ip_hash         text;
  v_state_normalized character(2);
  v_cached_report_id uuid;
  v_rl_allowed      boolean;
  v_rl_remaining    integer;
  v_rl_reset_at     timestamptz;
  v_outcome         text;
BEGIN
  -- Validate inputs
  IF p_ip IS NULL OR length(trim(p_ip)) = 0 THEN
    RAISE EXCEPTION 'INVALID_IP' USING ERRCODE = '22023';
  END IF;
  IF p_contractor_name IS NULL OR length(trim(p_contractor_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_CONTRACTOR_NAME' USING ERRCODE = '22023';
  END IF;
  IF p_state_code IS NULL OR length(p_state_code) <> 2 THEN
    RAISE EXCEPTION 'INVALID_STATE_CODE' USING ERRCODE = '22023';
  END IF;

  v_ip_hash := encode(extensions.digest(p_ip, 'sha256'), 'hex');
  v_state_normalized := UPPER(p_state_code)::character(2);

  -- 1. Cache hit check FIRST (does not consume rate limit budget)
  SELECT tr.id
  INTO v_cached_report_id
  FROM trust_reports tr
  WHERE LOWER(TRIM(tr.contractor_name)) = LOWER(TRIM(p_contractor_name))
    AND tr.state_code = v_state_normalized
    AND tr.created_at > now() - interval '30 days'
    AND tr.data_integrity_status = 'ok'
    AND tr.contractor_name NOT LIKE 'FTEST_%'
  ORDER BY tr.created_at DESC
  LIMIT 1;

  IF v_cached_report_id IS NOT NULL THEN
    INSERT INTO trust_anon_searches
      (ip_hash, contractor_name, state_code, outcome, report_id, user_agent)
    VALUES
      (v_ip_hash, TRIM(p_contractor_name), v_state_normalized, 'cached', v_cached_report_id, p_user_agent);

    RETURN QUERY SELECT 'cached'::text, v_cached_report_id, NULL::integer, NULL::timestamptz;
    RETURN;
  END IF;

  -- 2. Cache miss: check rate limit (1 per 24h per IP)
  SELECT rl.allowed, rl.remaining, rl.reset_at
  INTO v_rl_allowed, v_rl_remaining, v_rl_reset_at
  FROM check_trust_rate_limit('ip:' || v_ip_hash, 'anon_lookup', 1, 86400) AS rl;

  IF NOT v_rl_allowed THEN
    INSERT INTO trust_anon_searches
      (ip_hash, contractor_name, state_code, outcome, user_agent)
    VALUES
      (v_ip_hash, TRIM(p_contractor_name), v_state_normalized, 'rate_limited', p_user_agent);

    RETURN QUERY SELECT 'rate_limited'::text, NULL::uuid, 0, v_rl_reset_at;
    RETURN;
  END IF;

  -- 3. Cache miss + rate-limit OK: queue synth (API layer enqueues actual job)
  INSERT INTO trust_anon_searches
    (ip_hash, contractor_name, state_code, outcome, user_agent)
  VALUES
    (v_ip_hash, TRIM(p_contractor_name), v_state_normalized, 'queued', p_user_agent);

  RETURN QUERY SELECT 'queued'::text, NULL::uuid, v_rl_remaining, v_rl_reset_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.anon_trust_lookup(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anon_trust_lookup(text, text, text, text) TO authenticated, anon, service_role;

COMMIT;
