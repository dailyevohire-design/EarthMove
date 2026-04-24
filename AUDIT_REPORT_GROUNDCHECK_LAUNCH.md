# GroundCheck — Pre-Launch Security + Compliance Audit

**Audit date:** 2026-04-23
**Scope:** `src/lib/trust/**`, `src/app/api/trust/**`, `src/app/dashboard/*/trust/**`, `supabase/functions/stripe-webhook-groundcheck/**`, trust_* DB surface (RLS, policies, SECURITY DEFINER functions).
**DB project:** `gaawvpzzmotimblyesfp`.

Severity buckets:

- **P0 — launch-blocking.** Must fix before any GroundCheck surface is made publicly reachable.
- **P1 — fix before Stripe is active.** Paying customers must not hit these.
- **P2 — post-launch.** Non-urgent hardening / performance.

Evidence is either `path:line` from the repo, `pg_*` object name from the live DB, or a SQL query result quoted in the finding.

---

## Summary table

| # | Severity | Title |
|---|---|---|
| 1 | P0 | `check_trust_rate_limit` function does not exist in the database |
| 2 | P0 | Daily cost cap fails OPEN on RPC error in `/api/trust` |
| 3 | P0 | Credits are unredeemable — no `/api/trust/redeem` route, `redeem_credit_atomic` unused |
| 4 | P0 | `/api/trust` route only accepts `free\|pro\|enterprise`, but all paid Stripe tiers are `standard\|plus\|deep_dive\|forensic` |
| 5 | P0 | `trust_cache` SELECT policy allows any authenticated user to read any cached report |
| 6 | P0 | `TRUST_TIER_CONFIG` prices are hardcoded "placeholders" per author comment |
| 7 | P0 | No FCRA / entity-type gate — route accepts natural-person names and runs searches |
| 8 | P1 | `grant_credit_from_stripe_event` is not `SECURITY DEFINER` and has no pinned `search_path` |
| 9 | P1 | Duplicate `get_cached_trust_report(text, character, text)` overload with no pinned `search_path` |
| 10 | P1 | `trust_reports_own` / `trust_usage_own` policies are `cmd=ALL`, letting users self-INSERT |
| 11 | P1 | Cost cap has no advisory lock / transactional guard against concurrent races |
| 12 | P1 | No programmatic PII output filter — relies on prompt compliance |
| 13 | P1 | `trust_entity_edges`, `trust_officers`, `trust_officer_links` policies use `USING (true)` |
| 14 | P2 | 3 RLS policies use bare `auth.uid()` instead of `(SELECT auth.uid())` |
| 15 | P2 | Anonymous free tier allows IP-keyed calls to a $50 daily Claude spend pool |
| 16 | P2 | Homeowner deep-dive / forensic prompts still marked "DO NOT SELL" |
| 17 | P2 | `BUILD_LOG.md` promises `/groundcheck/*` pages + `/api/groundcheck/redeem` that never landed |

---

## P0 — Launch-blocking

### P0-1. `check_trust_rate_limit` function does not exist in the database

- **RESOLUTION:** Fixed in this commit — migration `104_trust_rate_limit_and_cost_cap.sql` creates the RPC as `SECURITY DEFINER` with pinned `search_path` and EXECUTE granted to `service_role` only. `src/lib/trust/rate-limiter.ts` wraps the RPC in try/catch and returns `{ success: false }` on any error. `src/app/api/trust/route.ts` catches library-level throws and returns 503. Verified via `pg_proc.prosecdef=true`, `proconfig=['search_path=public']`, and `has_function_privilege` = `{anon:false, authenticated:false, service_role:true}`.
- **Severity:** P0
- **Evidence:**
  - Code call site: `src/lib/trust/rate-limiter.ts:35,41,90,96`
  - DB query: `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='check_trust_rate_limit';` → `[]` (zero rows).
  - Call path in route: `src/app/api/trust/route.ts:85-86` — `const limiter = getRateLimiter(tier); const { success: rlOk } = await limiter.limit(rlKey)`. No surrounding try/catch.
- **Impact:** Every single request to `POST /api/trust` fails with an uncaught error inside `limit()` (`throw new Error('check_trust_rate_limit failed: ...')`). The endpoint will 500 on every call. The free-tier and anon paths are completely unusable today.
- **Proposed fix:** Ship a migration `104_trust_rate_limit_rpc.sql` that creates `check_trust_rate_limit(p_identifier text, p_bucket text, p_max_requests int, p_window_seconds int)` with the shape the TypeScript expects (`allowed boolean, remaining int, reset_at timestamptz`), `SECURITY DEFINER`, `SET search_path = public`, `EXECUTE` revoked from `anon`/`authenticated`, granted to `service_role` only. The function must atomically `INSERT ... ON CONFLICT (identifier, bucket) DO UPDATE` against `trust_rate_limits (identifier, bucket, count, window_start)` (columns confirmed to exist). Also wrap the call in `/api/trust/route.ts:86` in try/catch — fail CLOSED on DB error.

### P0-2. Daily cost cap fails OPEN on RPC error

- **RESOLUTION:** Fixed in this commit. `src/app/api/trust/route.ts` now destructures `{ data, error }` from `admin.rpc('check_trust_daily_cost_cap', ...)` and returns 503 `cost_cap_unavailable` if `error !== null` OR `capData == null` OR the row is null. `src/lib/trust/rate-limiter.ts::checkDailyCostCap` also fails closed. Migration 104 adds `pg_advisory_xact_lock` to the RPC itself to also cover the concurrent-race case (P1-11).
- **Severity:** P0
- **Evidence:** `src/app/api/trust/route.ts:101-111`
  ```ts
  const { data: capData } = await admin.rpc('check_trust_daily_cost_cap', {...})
  const capRow = Array.isArray(capData) ? capData[0] : capData
  if (capRow && !capRow.allowed) { return 429 }
  ```
  `admin.rpc` returns `{ data, error }` and does not throw on DB error — it returns `data=null`. The destructure ignores `error`. When `capRow` is null the `capRow && ...` short-circuits and the request proceeds to Claude.
- **Impact:** Any transient DB error (connection pool exhaustion, statement timeout, function-not-found) silently disables the daily spend cap. Claude cost for the anon pool is nominally capped at $50/day but can be driven arbitrarily high under adverse DB conditions. Classic fail-open.
- **Proposed fix:** Read `error` from the destructure. On `error !== null` OR `capRow == null`, return 503. Do not proceed to Claude. Same treatment for the rate-limit call in P0-1's fix.

### P0-3. Credits are unredeemable — paid flow has no consumer

- **RESOLUTION:** DEFERRED to redemption commit. Option (b) gate landed in this commit: `src/lib/trust/feature-flags.ts::isGroundcheckCheckoutEnabled()` reads `GROUNDCHECK_CHECKOUT_ENABLED=true`. `/api/trust/checkout` returns 410 `checkout_disabled` while the flag is false, and the pricing UI surfaces show a "Paid tiers launching soon" placeholder. Option (a) — wiring `redeem_credit_atomic` behind `/api/trust/redeem` + a `/account/gc` balance page — ships in a follow-up commit before the flag flips true.
- **Severity:** P0
- **Evidence:**
  - `grep -rn 'redeem_credit_atomic\|from..trust_credits_ledger\|user_credit_balance' src/` → zero hits in application code.
  - DB function `redeem_credit_atomic(uuid, text, text, text, text)` exists (verified via `pg_get_functiondef`) and is `SECURITY DEFINER` with `search_path=public` ✓, but no route calls it.
  - No `/api/trust/redeem`, no `/api/groundcheck/redeem`, no `/api/credits/*` directory: `find src/app/api -type d | grep -iE 'redeem|credit|groundcheck'` → empty.
- **Impact:** Buying flow works end-to-end — `/api/trust/checkout` → Stripe → webhook → `grant_credit_from_stripe_event` inserts a `+1` row into `trust_credits_ledger`. But there is no code path that decrements the ledger or unlocks a report for the paying user. Customers charged $29–$397 would get nothing usable.
- **Proposed fix:** Either (a) ship the redemption API + a `/account/gc` credit-balance page before Stripe goes live, or (b) disable the GroundCheck checkout entrypoint (`/api/trust/checkout`) and hide the pricing UI until redemption ships. Recommended: (b) for now — add a 410 response in `src/app/api/trust/checkout/route.ts` behind `GROUNDCHECK_CHECKOUT_ENABLED=false`, and document the gate in the launch runbook.

### P0-4. Route tier whitelist does not overlap paid tier names

- **RESOLUTION:** DEFERRED to redemption commit. The mismatch is moot while `GROUNDCHECK_CHECKOUT_ENABLED=false` (checkout is 410, so no paid tier ever lands in the ledger). When the redemption flow ships, `/api/trust/redeem` will accept the paid tier names and `/api/trust` continues to serve the free/pro/enterprise synchronous path.
- **Severity:** P0
- **Evidence:**
  - `src/app/api/trust/route.ts:70` — `if (!['free', 'pro', 'enterprise'].includes(tier)) return 400`.
  - `src/lib/trust/checkout.ts:3,6-9` — `TrustTier = 'standard'|'plus'|'deep_dive'|'forensic'`; `VALID_TRUST_TIERS = ['standard','plus','deep_dive','forensic']`.
  - Webhook grants these same four tiers into `trust_credits_ledger.tier` (constraint confirmed in DB: `trust_stripe_events_tier_check` → `ARRAY['standard','plus','deep_dive','forensic']`).
- **Impact:** The paying system writes credits under tier names the serving API will always 400 on. Even after P0-3 is fixed, the route needs the paid tiers added or a separate redemption path.
- **Proposed fix:** Add the 4 paid tier names to the API route's validation list OR (preferred) keep `/api/trust` as the free/anon funnel and route paid redemptions through a separate `/api/trust/redeem` handler that enforces entitlement against `trust_credits_ledger`. Keep tier validation consistent across the codebase — single source of truth in `src/lib/trust/checkout.ts`.

### P0-5. `trust_cache` SELECT policy leaks cached reports to every authenticated user

- **RESOLUTION:** Fixed in this commit — migration `105_trust_rls_hardening.sql` drops `trust_cache_authenticated_read`. Verified: `pg_policies` for `trust_cache` now returns only `trust_cache_service` (ALL, service_role gate).
- **Severity:** P0
- **Evidence:** `pg_policies` for `trust_cache`:
  - `trust_cache_authenticated_read` → `cmd=SELECT roles={authenticated} qual=(expires_at > now())`
  - `trust_cache_service` → `cmd=ALL roles={public} qual=(auth.jwt()->>'role')='service_role'`
- **Impact:** Any signed-in user can run `supabase.from('trust_cache').select('*')` via the public anon/authenticated key (e.g., from a browser console on earthmove.io) and read every non-expired cached trust report — including paid-tier reports someone else paid for. This is both a paid-content bypass and a potential PII leak (reports contain license numbers, principal names, addresses). The application code always hits `trust_cache` via `createAdminClient()` RPCs, so no legitimate consumer needs this policy.
- **Proposed fix:** Drop `trust_cache_authenticated_read`. All cache access must go through `get_cached_trust_report` / `set_cached_trust_report` under service_role. Migration:
  ```sql
  DROP POLICY IF EXISTS trust_cache_authenticated_read ON public.trust_cache;
  ```

### P0-6. `TRUST_TIER_CONFIG` prices are hardcoded placeholders

- **RESOLUTION:** DEFERRED to redemption commit. The placeholder prices are unreachable while `GROUNDCHECK_CHECKOUT_ENABLED=false`. Juan confirms final prices and creates live-mode Stripe products + prices in the redemption commit; `checkout.ts` switches from inline `price_data` to `line_items: [{ price: process.env.STRIPE_PRICE_GC_* }]` at that time.
- **Severity:** P0
- **Evidence:** `src/lib/trust/checkout.ts:22-50`
  ```ts
  // TODO(juan): confirm prices before live traffic. These are placeholders.
  export const TRUST_TIER_CONFIG: Record<TrustTier, TrustTierConfig> = {
    standard:  { amountCents:  2900, ... },
    plus:      { amountCents:  9900, ... },
    deep_dive: { amountCents: 19900, ... },
    forensic:  { amountCents: 39700, ... },
  }
  ```
  Sessions created via inline `price_data` mean Stripe never sees a canonical product/price. No Stripe dashboard row exists to flip on/off without a deploy.
- **Impact:** Juan cannot price-change or A/B without a code deploy. Stripe reporting treats every checkout as a one-off. If the TODO comment is accurate, these are the wrong numbers to go live with.
- **Proposed fix:** Before activation: (a) Juan confirms final prices; (b) create four products + prices in Stripe dashboard; (c) change `checkout.ts` to accept an env map `STRIPE_PRICE_GC_STANDARD`, `..._PLUS`, `..._DEEP_DIVE`, `..._FORENSIC` and pass `line_items: [{ price: env[...], quantity: 1 }]`; (d) delete the hardcoded cents amounts. Store the 90-day validityDays in a single config constant (webhook's `CREDIT_VALIDITY_DAYS` env must match).

### P0-7. No FCRA / entity-type gate

- **RESOLUTION:** Fixed in this commit. `src/app/api/trust/route.ts` now runs `ENTITY_SUFFIX_RE.test(name)` immediately after `validateInput` and before any rate-limit / cost-cap / Claude call. Non-entity names return HTTP 422 `individual_lookup_requires_checkr` with the Checkr partner URL. Every rejected query is logged to `trust_audit_log` (`action='individual_lookup_rejected'`, `reason='no_entity_suffix_detected'`) under the service-role admin client so legal has a paper trail.
- **Severity:** P0
- **Evidence:**
  - `src/app/api/trust/route.ts` only validates that `contractor_name` is non-empty and passes injection sanitization (`validateInput`). No classifier, no entity-type check, no Checkr passthrough.
  - Prompts instruct the model *not* to report on natural persons (`src/lib/trust/prompts/homeowner-deep-dive.ts:32`, `homeowner-forensic.ts:37`), but only *after* the query is already running and tokens are being spent.
  - Prompt system message in `trust-engine.ts:5-156` does not reject natural-person queries — it only suppresses fields for CA/NY/IL/WA.
- **Impact:** Today a user can POST `{contractor_name: "John Smith"}` against a real person's name. The model *may* decline, but there is no programmatic rejection and nothing stops the resulting report from being persisted into `trust_reports`. FCRA (and CA/NY/IL/WA state analogues) prohibits commercial-use consumer reports without the consumer-reporting-agency regime. EarthMove is not an FCRA CRA.
- **Proposed fix:** Add a pre-flight check in `src/app/api/trust/route.ts` that:
  1. Pattern-matches obvious individual queries (missing entity suffix: `LLC|INC|CORP|LTD|CO\.?|L\.L\.C\.?|CORPORATION|COMPANY|GROUP|HOLDINGS|ENTERPRISES`).
  2. If no entity suffix, returns 422 with `{ error: 'individual_lookup_requires_checkr', checkr_url: process.env.CHECKR_PARTNER_URL }` and does **not** call Claude.
  3. Log the rejected query to `trust_audit_log` so legal has a paper trail.
  Also document in `docs/runbook/legal-dispute.md` that no individual lookup was ever accepted by the API.

---

## P1 — Fix before Stripe is active

### P1-8. `grant_credit_from_stripe_event` is not SECURITY DEFINER and has no pinned search_path

- **RESOLUTION:** Fixed in this commit — migration `105_trust_rls_hardening.sql` re-creates the function with `SECURITY DEFINER` and `SET search_path = public`; body preserved verbatim. REVOKE/GRANT re-applied (service_role only). Verified: `pg_proc.prosecdef=true`, `proconfig=['search_path=public']`.
- **Severity:** P1
- **Evidence:** `pg_proc.prosecdef=false`, `proconfig=null`. Function body (`pg_get_functiondef`) references `trust_stripe_events` and `trust_credits_ledger` without schema qualification.
- **Impact:** Today the function is only reachable via service_role (EXECUTE revoked from anon/authenticated — verified via `has_function_privilege`), and service_role bypasses RLS, so the function works. The risk is defense-in-depth: if EXECUTE is ever granted elsewhere, the callers hit RLS on those tables; and if a malicious schema is prepended to `search_path` in the calling session, table resolution is ambiguous. Also the checklist requires `SECURITY DEFINER` — we currently fail it.
- **Proposed fix:** Migration 105:
  ```sql
  CREATE OR REPLACE FUNCTION public.grant_credit_from_stripe_event(...)
    RETURNS trust_credits_ledger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
  AS $$ ... $$;
  REVOKE EXECUTE ON FUNCTION public.grant_credit_from_stripe_event(...) FROM PUBLIC, anon, authenticated;
  GRANT  EXECUTE ON FUNCTION public.grant_credit_from_stripe_event(...) TO service_role;
  ```

### P1-9. Duplicate `get_cached_trust_report` overload with no pinned search_path

- **RESOLUTION:** Fixed in this commit — migration `105_trust_rls_hardening.sql` drops `get_cached_trust_report(text, character, text)`. Verified: `pg_proc` for `get_cached_trust_report` now returns one row with the 4-argument signature and pinned search_path.
- **Severity:** P1
- **Evidence:** Two rows in `pg_proc` for `get_cached_trust_report`:
  1. `(p_contractor text, p_state text, p_tier text, p_hint_hash text)` — SECURITY DEFINER, `search_path=public` ✓
  2. `(p_contractor text, p_state character, p_tier text)` — SECURITY DEFINER, `proconfig=null` ✗
  Migration 103 drops only `(text, text, text)`; the `character` variant slipped through.
- **Impact:** Postgres picks overloads by argument types. A stray caller passing `state` as `character(2)` (the actual column type on trust_reports) hits the unpinned variant. Low probability of exploitation but fails the checklist and is a future footgun.
- **Proposed fix:** Migration 104 (or same as P1-8): `DROP FUNCTION IF EXISTS public.get_cached_trust_report(text, character, text);`

### P1-10. `trust_reports_own` and `trust_usage_own` are `cmd=ALL` — users can self-INSERT

- **RESOLUTION:** Fixed in this commit — migration `105_trust_rls_hardening.sql` drops both ALL policies and re-creates each as `FOR SELECT` only. A `CHECK (cost_usd >= 0) NOT VALID` constraint is added to `trust_api_usage` to block negative-cost poisoning in case any stray write path exists. Verified: `pg_policies` for `trust_reports` and `trust_api_usage` now returns only `cmd=SELECT` rows.
- **Severity:** P1
- **Evidence:**
  - `trust_reports_own` — `cmd=ALL qual=((SELECT auth.uid())=user_id) with_check=null`
  - `trust_usage_own` — `cmd=ALL qual=((SELECT auth.uid())=user_id) with_check=null`
  When `with_check` is null under `cmd=ALL`, Postgres uses the `qual` expression for INSERT/UPDATE. That means an authenticated user can insert rows matching their own `user_id`.
- **Impact:** Any signed-in user can forge arbitrary rows into `trust_reports` (inflating their own history, fabricating "clean" reports) and `trust_api_usage` (poisoning the cost-cap counter — either filling the bucket to lock themselves out for fun, or inserting negative/zero rows to clear the cap if the sum uses `SUM` without filtering). In practice `check_trust_daily_cost_cap` sums `cost_usd` only, and `cost_usd` is `numeric` with no CHECK >= 0 — a user could insert rows with `cost_usd = -1000` to reset their bucket.
- **Proposed fix:** Restrict both policies to `cmd=SELECT` only. All writes go through service_role via the API route. Migration:
  ```sql
  DROP POLICY trust_reports_own ON public.trust_reports;
  CREATE POLICY trust_reports_own_select ON public.trust_reports
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

  DROP POLICY trust_usage_own ON public.trust_api_usage;
  CREATE POLICY trust_usage_own_select ON public.trust_api_usage
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

  ALTER TABLE public.trust_api_usage
    ADD CONSTRAINT trust_api_usage_cost_nonneg CHECK (cost_usd >= 0) NOT VALID;
  ```

### P1-11. Cost cap has no advisory lock / transactional guard

- **RESOLUTION:** Fixed in this commit — migration `104_trust_rate_limit_and_cost_cap.sql` rewrites `check_trust_daily_cost_cap` with `pg_advisory_xact_lock(hashtext('trust_cost_cap:' || COALESCE(p_user_id::text,'anon')))` as the first statement. Concurrent callers against the same bucket now serialize through the lock.
- **Severity:** P1
- **Evidence:** `check_trust_daily_cost_cap` (migration 101) is a single `SELECT COALESCE(SUM(cost_usd),0)` followed by a comparison — no `FOR UPDATE`, no `pg_advisory_xact_lock`. The route calls it, then much later (post-Claude) inserts the cost row.
- **Impact:** Under burst traffic two requests that are each individually under-cap can both pass the check concurrently, run Claude in parallel, and only afterwards record costs that together exceed the cap. Expected overage is bounded (~1–2 extra Claude calls per breach) but compounds on busy days.
- **Proposed fix:** Either (a) take `pg_advisory_xact_lock(hashtext('trust_cost_cap:' || COALESCE(p_user_id::text,'anon')))` at the top of the RPC, or (b) record an estimated-max-cost reservation row pre-call and reconcile post-call. (a) is simpler.

### P1-12. No programmatic PII output filter

- **RESOLUTION:** Fixed in this commit. `src/lib/trust/trust-validator.ts` exports `scrubPIIFromReport(report)` which walks every string leaf and substitutes `[REDACTED_SSN]` / `[REDACTED_DOB]` / `[REDACTED_DL]`, returning unique hit names. `src/lib/trust/trust-engine.ts` calls it immediately after `parseReport`; on any hit, `confidence_level` is forced to `LOW` and the hits bubble up to `runFreeTier`'s return value. `/api/trust/route.ts` logs to `trust_audit_log` (`action='pii_scrubbed'`, target references the persisted report id) when `piiHits.length > 0`.
- **Severity:** P1
- **Evidence:** `parseReport` in `src/lib/trust/trust-validator.ts:240-255` validates schema only. No regex scan for SSN (`\d{3}-\d{2}-\d{4}`), DOB (`\d{1,2}/\d{1,2}/\d{2,4}` + context), or personal address patterns. Prompts instruct the model to strip PII but we rely entirely on prompt compliance.
- **Impact:** A single prompt-injection bypass or model lapse persists PII into `trust_reports.raw_report` (JSONB), from which it propagates to any shared report view. FCRA/state-law liability climbs sharply if personal data is actually in our database.
- **Proposed fix:** Add `scrubPIIFromReport(report: TrustReport): { scrubbed: TrustReport; hits: string[] }` in `trust-validator.ts`. Run regexes over every string-valued leaf; replace matches with `[REDACTED]`; append the rule name to a `pii_hits` field; if hits > 0, reduce `confidence_level` to LOW and log to `trust_audit_log`. Called immediately after `parseReport` in `trust-engine.ts`.

### P1-13. `trust_entity_edges`, `trust_officers`, `trust_officer_links` use `USING (true)`

- **RESOLUTION:** Fixed in this commit — migration `105_trust_rls_hardening.sql` drops the three `public_read` policies and replaces them with `entitled_read` policies that gate on a live `trust_report_access` grant for the associated contractor. `trust_officers` has no direct contractor_id, so its policy joins via `trust_officer_links`. Verified: `pg_policies` for all three tables now show entitlement subqueries; no `qual='true'` rows remain.
- **Severity:** P1
- **Evidence:** `pg_policies` rows for each table show `qual=true`. Tables are empty today (confirmed at audit time; Agent-built forensic features not wired to the API), but schema is provisioned.
- **Impact:** Once those tables get populated (planned Phase 3/4), every anon caller can read the entire officer/overlap graph. Officers are natural persons; this graph is PII-sensitive.
- **Proposed fix:** Tighten to `authenticated` + entitlement-bound (`EXISTS ... trust_report_access WHERE ...`). Since the tables are empty, fix before any Phase 3 data lands. Track in `docs/MASTER_BLUEPRINT.md` Phase-3 gate list.

---

## P2 — Post-launch

### P2-14. Bare `auth.uid()` in 3 policies

- **Severity:** P2 (performance / initplan optimization)
- **Evidence:** `pg_policies` rows:
  - `trust_jobs_owner_read` — `qual=(requested_by_user_id = auth.uid())`
  - `trust_evidence_owner_read` — uses bare `auth.uid()` inside EXISTS subqueries
  - `trust_stripe_events_user_read` — `qual=(user_id = auth.uid())`
- **Impact:** Postgres re-evaluates `auth.uid()` per row instead of once per statement. Measurable at scale, invisible at launch.
- **Proposed fix:** Wrap in `(SELECT auth.uid())` per Supabase best practice. Same migration as P1-8/9.

### P2-15. Anonymous free-tier shares a $50/day Claude spend pool

- **Severity:** P2
- **Evidence:** `src/app/api/trust/route.ts:97-100` — anon uses `TRUST_ANON_DAILY_CAP_USD ?? 50`.
- **Impact:** A single adversary can burn the entire anon-pool cap in minutes with a script. Free-tier evaluation for real users is then blocked until UTC midnight. With P0-1 rate limiter restored and P0-2 cap fixed, this becomes a UX issue rather than a cost issue, but still a DoS surface.
- **Proposed fix:** Lower `TRUST_ANON_DAILY_CAP_USD` to `$10`, require CAPTCHA for anon after N queries per IP, or simply require auth for all trust lookups. Revisit after first week of production traffic.

### P2-16. Homeowner deep-dive and forensic prompts are still "DO NOT SELL"

- **Severity:** P2
- **Evidence:** `src/lib/trust/prompts/homeowner-deep-dive.ts:14-16`, `homeowner-forensic.ts:17-19` — banner comments "DO NOT SELL THIS TIER TO CUSTOMERS until Phase 3 (or 4) ships."
- **Impact:** If UI ever surfaces these tiers before Phase 3/4 integrations (PACER, Lexis, D&B, etc.) are real, customers are paying for placeholder output. Today no UI surfaces them, but the risk grows as the marketplace page evolves.
- **Proposed fix:** Keep the two prompts file-local and unreachable from any route until Phase 3/4 gate items in `MASTER_BLUEPRINT.md §11` are closed. Add an explicit `GROUNDCHECK_DEEP_DIVE_ENABLED=false` env gate that the pricing UI reads.

### P2-17. BUILD_LOG references to `/groundcheck/*` pages and `/api/groundcheck/redeem` that never landed

- **Severity:** P2 (doc hygiene)
- **Evidence:** `BUILD_LOG.md:380,432,549,600-605` describe pages like `/groundcheck/claim/[slug]`, `/groundcheck/[state]`, `/groundcheck/report/[id]`, and an API `/api/groundcheck/redeem`. `find src/app -name groundcheck` → empty. `find src/app/api -name redeem` → empty.
- **Impact:** Future operators reading BUILD_LOG will believe those surfaces exist. Sitemap references would 404 today.
- **Proposed fix:** Append a "Status as of 2026-04-23" note to BUILD_LOG stating which surfaces actually shipped vs. remain planned. Don't create stubs.

---

## Checklist audit — PASS/FAIL/NA

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Every `trust_*` table has `rowsecurity=true` | PASS | 15/15 rows in `pg_tables` query — all `true` |
| 2 | No policy uses `USING (true)` for non-admin roles | FAIL → P1-13 | 3 tables (`trust_entity_edges`, `trust_officers`, `trust_officer_links`) |
| 3 | `trust_reports` SELECT restricted to owner OR via `trust_report_access` | PARTIAL | Owner-check present via `trust_reports_own`; `trust_report_access` policy is `access_own_select`; no combined view yet. A second `FOR SELECT` policy would be needed when the access-grant path is wired. |
| 4 | Policies use `(SELECT auth.uid())` | FAIL → P2-14 | 3 policies use bare `auth.uid()` |
| 5 | `trust_credits_ledger` has NO UPDATE/DELETE policy | PASS | Only `credits_own_select` (`cmd=SELECT`) exists |
| 6 | Every SECURITY DEFINER trust_* fn has pinned `search_path` | FAIL → P1-9 | Duplicate `get_cached_trust_report(text, character, text)` lacks `proconfig` |
| 7 | `grant_credit_from_stripe_event` is `SECURITY DEFINER` + pinned `search_path` + validates `product_family='ground_check'` + idempotent | FAIL → P1-8 | Not SECURITY DEFINER, no pinned `search_path`. Idempotency is correct (unique `stripe_event_id`). Product-family check happens in the Edge Function, not the RPC — acceptable. |
| 8 | EXECUTE on `grant_credit_from_stripe_event` revoked from public/anon/authenticated, granted only to service_role | PASS | `has_function_privilege`: anon=false, authenticated=false, service_role=true |
| 9 | Webhook verifies signature with `constructEventAsync`, 400 on fail, before DB write | PASS | `supabase/functions/stripe-webhook-groundcheck/index.ts:89-100` |
| 10 | Webhook idempotent | PASS | `grant_credit_from_stripe_event` pre-checks `trust_stripe_events.stripe_event_id`; `trust_stripe_events_event_id_uniq` unique index; exception handler re-reads on unique_violation |
| 11 | Rate limiter fails CLOSED on Postgres error | FAIL → P0-1, P0-2 | Code fails closed in rate-limiter but the RPC doesn't exist; cost-cap fails OPEN |
| 12 | Per-tier buckets enforce separate limits | PASS (by design) | `TIER_RATE_LIMITS` in `rate-limiter.ts` — blocked by P0-1 today |
| 13 | Daily cost cap uses advisory lock / transaction | FAIL → P1-11 | Plain `SELECT SUM` |
| 14 | Sanitizer runs on every user-supplied field | PASS | `validateInput(name, city, state_code, {address, principal, license_number, ein_last4})` in `route.ts:58` |
| 15 | Confusables/bidi/zero-width/control/injection regexes present | PASS | `prompt-guards.ts:1-68` |
| 16 | Output validator rejects SSN/DOB/home-address patterns | FAIL → P1-12 | Schema-only validation |
| 17 | System prompt uses `cache_control: {type: 'ephemeral'}` | PASS | `trust-engine.ts:189-193` |
| 18 | FCRA gate — individuals rejected with Checkr redirect | FAIL → P0-7 | No such gate |
| 19 | `web_search_20250305` has `max_uses` set | PASS | `trust-engine.ts:196-198` → `max_uses: 12` |
| 20 | `AMBIGUOUS_IDENTITY` returns candidates without full investigation | PASS | Prompt STEP 1.5 in `trust-engine.ts:29-53` + validator supports nullable score / candidates array |
| 21 | Auth checked before any Claude call | PASS (partial) | Anon allowed for tier=free, authed required for `pro\|enterprise`; no paid tier can reach `/api/trust` today (P0-4) |
| 22 | Cost cap checked BEFORE Claude | PASS structurally | Flows at `route.ts:101-111`; fails open per P0-2 |
| 23 | Cache check BEFORE Claude | PASS | `route.ts:126-136` |
| 24 | DB persist wrapped in try/catch (return report on failure) | PASS | `route.ts:162-210` — non-fatal catch |
| 25 | Cache key includes hint-hash on write AND lookup, same composition | PASS | Migration 103 — both sides `MD5(LOWER(TRIM(p_contractor)) || p_state || p_tier || COALESCE(p_hint_hash, ''))` |
| 26 | TTLs per tier match spec | PASS | Migration 103: free 1h, pro 6h, enterprise 1h, standard 30d, plus 14d, deep_dive 14d, forensic 7d |
| 27 | No `service_role` / `SUPABASE_SERVICE_ROLE_KEY` in client paths | PASS | `grep src/app excluding /api/ src/components` → zero hits |
| 28 | `ANTHROPIC_API_KEY` only in server routes / edge functions | PASS | `src/lib/trust/trust-engine.ts:173` (server-only lib); zero client hits |
| 29 | Every trust report UI surface has "informational only, not a consumer report" disclaimer | PARTIAL | Disclaimer embedded in report JSON (enforced by schema). No HTML/PDF surface ships a banner because no report-view route exists in `src/app`. Re-audit when the view page lands. |
| 30 | Individual lookups gated behind Checkr | FAIL → P0-7 | No gate |
| 31 | Dead `/api/trust/lookup` route | FIXED | 2 hits replaced this commit — see "Fixes landed" below |
| 32 | References to `/groundcheck/*` / `/api/groundcheck/redeem` | DOC-ONLY → P2-17 | Only in `src/lib/driver/tokens.ts:4` (as a comment referencing `src/lib/groundcheck/verification.ts`, which also doesn't exist) and in docs; no live code imports |
| 33 | Prices from env vars, not hardcoded | FAIL → P0-6 | Hardcoded placeholders in `checkout.ts` |
| 34 | Stripe mode (test vs live) | UNKNOWN at audit time | Verify in runbook pre-activation checklist |

---

## Fixes landed in this commit

- `src/app/dashboard/driver/trust/page.tsx:15` — `fetch('/api/trust/lookup', …)` → `fetch('/api/trust', …)`
- `src/app/dashboard/contractor/trust/page.tsx:16` — doc string corrected to reference `/api/trust`

Everything else in the audit ships in follow-up commits. See `docs/GROUNDCHECK_LAUNCH_DAY.md` for the ordered activation sequence.

## Remediation commit (2026-04-23)

Every P0 and P1 finding above has a `RESOLUTION:` block indicating whether it was fixed in the remediation commit or deferred.

- **P0-1, P0-2, P0-5, P0-7** — fixed.
- **P0-3, P0-4, P0-6** — deferred. Mitigated by `GROUNDCHECK_CHECKOUT_ENABLED=false` feature flag. Paid checkout returns HTTP 410; pricing UI shows "Paid tiers launching soon." Flag flips in the redemption commit.
- **P1-8, P1-9, P1-10, P1-11, P1-12, P1-13** — fixed.
- **P2 items** — unchanged; post-launch.

Migrations applied: `104_trust_rate_limit_and_cost_cap.sql`, `105_trust_rls_hardening.sql`. See `docs/GROUNDCHECK_LAUNCH_DAY.md` §7 for the paid-tier activation checklist.
