#!/usr/bin/env bash
# Per-PR smoke test — runs against a Vercel preview URL backed by a Supabase branch DB.
# Required env:
#   BASE_URL                         preview deployment URL (e.g. https://pr-123.vercel.app)
#   SUPABASE_URL                     branch DB connection URL (postgres://...)
#   SUPABASE_SERVICE_ROLE_KEY        unused here but required for symmetry with server env
#   NEXT_PUBLIC_SUPABASE_URL         branch API URL (https://<ref>.supabase.co)
#   NEXT_PUBLIC_SUPABASE_ANON_KEY    branch anon key
set -euo pipefail

fail() {
  echo "SMOKE FAIL: $1" >&2
  exit 1
}

for v in BASE_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
  if [ -z "${!v:-}" ]; then
    fail "missing env var $v"
  fi
done

echo "[a] GET $BASE_URL/api/health"
health_status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/health" || echo "000")
if [ "$health_status" = "404" ]; then
  echo "    warn: /api/health not present on this build, skipping"
elif [ "$health_status" != "200" ]; then
  fail "health endpoint returned $health_status"
else
  echo "    ok"
fi

echo "[b] POST $BASE_URL/api/driver/session (empty body should 400)"
session_status=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'content-type: application/json' \
  -d '{}' \
  "$BASE_URL/api/driver/session" || echo "000")
if [ "$session_status" != "400" ]; then
  fail "driver/session empty body returned $session_status (expected 400 from Zod)"
fi
echo "    ok"

echo "[c] psql: count(*) public tables >= 30"
table_count=$(psql "$SUPABASE_URL" -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'") \
  || fail "psql table count query failed"
if [ "$table_count" -lt 30 ]; then
  fail "branch DB has $table_count public tables, expected >= 30"
fi
echo "    ok ($table_count tables)"

echo "[d] psql: count(*) pg_policies public >= 40"
policy_count=$(psql "$SUPABASE_URL" -Atc \
  "SELECT count(*) FROM pg_policies WHERE schemaname='public'") \
  || fail "psql policy count query failed"
if [ "$policy_count" -lt 40 ]; then
  fail "branch DB has $policy_count RLS policies, expected >= 40"
fi
echo "    ok ($policy_count policies)"

echo "[e] psql: denver market seed row present"
denver=$(psql "$SUPABASE_URL" -Atc \
  "SELECT 1 FROM public.markets WHERE slug='denver' LIMIT 1") \
  || fail "psql denver query failed"
if [ "$denver" != "1" ]; then
  fail "denver market seed row missing from branch DB"
fi
echo "    ok"

echo "SMOKE OK"
