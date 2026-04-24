# GroundCheck — Launch Day Runbook

**Owner:** Juan
**Scope:** GroundCheck (trust-lookup + paid-report) activation on `earthmove.io`.
**Pre-reqs:** `AUDIT_REPORT_GROUNDCHECK_LAUNCH.md` P0 items resolved in code + DB.

This runbook is strictly ordered. Do not skip steps. Each step names the exact
shell command, SQL, or Stripe dashboard action to perform and what to verify
before moving on.

---

## 0. Pre-flight gate

Do not proceed to Step 1 until all of these are true:

- [ ] P0-1 migration shipped: `check_trust_rate_limit` exists in `public` with `SECURITY DEFINER` + pinned `search_path`; EXECUTE revoked from anon/authenticated, granted to service_role.
- [ ] P0-2 code change shipped: `/api/trust/route.ts` fails closed on rate-limit and cost-cap RPC errors.
- [ ] P0-3 and P0-4 either: (a) redemption API wired and tested end-to-end, OR (b) `GROUNDCHECK_CHECKOUT_ENABLED=false` and `/api/trust/checkout` returns 410.
- [ ] P0-5 migration shipped: `trust_cache_authenticated_read` policy dropped.
- [ ] P0-6 prices confirmed by Juan and moved to Stripe price IDs; `checkout.ts` switched from `price_data` to `line_items: [{ price }]`.
- [ ] P0-7 code change shipped: individual-lookup gate rejects non-entity names with 422 + Checkr redirect.

---

## 1. Environment variable activation sequence

Variables must be set in **this order** — setting the Stripe key before the rate-limit migration creates a window where paying customers pass signature verification but hit a 500 on downstream lookup.

### 1.1 Supabase (project `gaawvpzzmotimblyesfp`)

Edge Function `stripe-webhook-groundcheck` requires:

```
STRIPE_SECRET_KEY=sk_live_...               # or sk_test_ if staging
STRIPE_WEBHOOK_SECRET_GROUNDCHECK=whsec_... # fresh endpoint secret — see §2
SUPABASE_URL=https://gaawvpzzmotimblyesfp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # existing
GC_CREDIT_VALIDITY_DAYS=90                  # must equal checkout.ts validityDays
```

Set via:
```bash
supabase secrets set --project-ref gaawvpzzmotimblyesfp \
  STRIPE_SECRET_KEY=... \
  STRIPE_WEBHOOK_SECRET_GROUNDCHECK=... \
  GC_CREDIT_VALIDITY_DAYS=90
```

Verify:
```bash
supabase secrets list --project-ref gaawvpzzmotimblyesfp | grep -iE 'STRIPE|GC_CREDIT'
```
All four strings present.

### 1.2 Vercel (project `prj_KCqoJRK0lyQtoL98QEUGihfeeIOV`)

Required:

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://gaawvpzzmotimblyesfp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...             # existing earthmove orders webhook
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_APP_URL=https://earthmove.io
TRUST_USER_DAILY_CAP_USD=25
TRUST_ANON_DAILY_CAP_USD=10                 # lowered per P2-15
STRIPE_PRICE_GC_STANDARD=price_...
STRIPE_PRICE_GC_PLUS=price_...
STRIPE_PRICE_GC_DEEP_DIVE=price_...
STRIPE_PRICE_GC_FORENSIC=price_...
GROUNDCHECK_CHECKOUT_ENABLED=true           # flip last (see §3)
GROUNDCHECK_DEEP_DIVE_ENABLED=false         # stays off until Phase 3 ships
GROUNDCHECK_FORENSIC_ENABLED=false          # stays off until Phase 4 ships
CHECKR_PARTNER_URL=https://checkr.com/...   # fallback for individual lookups
```

Set via Vercel dashboard → Settings → Environment Variables. Scope: **Production** only. Preview can stay on test keys.

Verify with:
```bash
vercel env ls --environment=production | grep -iE 'STRIPE|ANTHROPIC|TRUST|GROUNDCHECK|CHECKR'
```

### 1.3 Redeploy

After env changes, a fresh deploy is required so Next.js reads them:
```bash
vercel --prod
```

---

## 2. Stripe dashboard actions

### 2.1 Create products + prices (live mode)

Stripe Dashboard → Products → Add product:

| Product name | Price (live) | Price ID env var |
|---|---|---|
| GroundCheck — Standard Report | $29.00 USD | `STRIPE_PRICE_GC_STANDARD` |
| GroundCheck — Plus Report | $99.00 USD | `STRIPE_PRICE_GC_PLUS` |
| GroundCheck — Deep Dive | $199.00 USD | `STRIPE_PRICE_GC_DEEP_DIVE` |
| GroundCheck — Forensic Report | $397.00 USD | `STRIPE_PRICE_GC_FORENSIC` |

One-time price, no recurring. Confirm Juan approves these numbers — P0-6 flagged them as placeholders.

Copy each `price_...` ID into Vercel env vars (§1.2).

### 2.2 Activate products

Toggle `Active` for each of the four products.

### 2.3 Register webhook endpoint

Developers → Webhooks → Add endpoint:

- **Endpoint URL:** `https://gaawvpzzmotimblyesfp.supabase.co/functions/v1/stripe-webhook-groundcheck`
- **Events to send:**
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
- **API version:** match `apiVersion` in `src/lib/stripe.ts` (currently `2025-02-24.acacia`).

After creating: click into the endpoint → Reveal signing secret → copy to `STRIPE_WEBHOOK_SECRET_GROUNDCHECK` in Supabase secrets (§1.1). **Do not reuse the earthmove orders webhook secret** — this is a separate endpoint.

### 2.4 Webhook smoke test (test mode first)

Use Stripe CLI:

```bash
# In a throwaway terminal, with Stripe CLI authed against the test account:
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.user_id=<valid auth.users uuid> \
  --add checkout_session:metadata.tier=standard \
  --add checkout_session:metadata.product_family=ground_check
```

Then verify in Supabase:
```sql
SELECT id, tier, balance_delta, reason, granted_at, expires_at
FROM trust_credits_ledger
ORDER BY granted_at DESC
LIMIT 5;

SELECT stripe_event_id, event_type, credit_id, processed_at
FROM trust_stripe_events
ORDER BY processed_at DESC
LIMIT 5;
```

Expected: one new row in each table. `credit_id` on `trust_stripe_events` matches the `id` in `trust_credits_ledger`.

### 2.5 Webhook replay (idempotency check)

Re-trigger the same event:
```bash
stripe events resend <evt_id from above>
```

Re-run the SQL. Expected: **no new rows** in either table. Webhook is idempotent.

### 2.6 Switch to live mode

Once test webhook is green:
- Flip Stripe dashboard to **Live mode**.
- Re-create the same products + prices (Stripe test and live modes have separate objects).
- Register the same webhook endpoint URL but with a **new signing secret** (live-mode whsec).
- Update `STRIPE_WEBHOOK_SECRET_GROUNDCHECK` in Supabase secrets.
- Update Vercel `STRIPE_PRICE_GC_*` env vars to the live price IDs.
- Redeploy Vercel.

---

## 3. Go-live flip

Only after §1 and §2 are green:

```bash
vercel env add GROUNDCHECK_CHECKOUT_ENABLED production   # enter: true
vercel --prod
```

Now `/api/trust/checkout` accepts real purchases.

Smoke test with a $0.50 Stripe coupon (create a 99.99% off promotion code in Stripe, apply at checkout) against a real `plus` tier purchase. Verify credit appears in `trust_credits_ledger`, webhook event in `trust_stripe_events`, redemption page shows balance.

---

## 4. First-24h monitoring queries

Run these every 30 minutes for the first 4 hours, then hourly through hour 24.

### 4.1 Webhook health

```sql
-- Events received in the last hour
SELECT event_type, COUNT(*) AS n
FROM trust_stripe_events
WHERE processed_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type;

-- Any events with NULL credit_id (webhook ran but credit write failed)
SELECT stripe_event_id, event_type, tier, amount_cents, processed_at
FROM trust_stripe_events
WHERE credit_id IS NULL
  AND processed_at > NOW() - INTERVAL '24 hours'
ORDER BY processed_at DESC;
```

Expected: `credit_id IS NULL` returns zero rows. Any hit → read Edge Function logs immediately.

### 4.2 Credit-to-redemption ratio

```sql
SELECT
  tier,
  SUM(CASE WHEN balance_delta > 0 THEN 1 ELSE 0 END) AS granted,
  SUM(CASE WHEN balance_delta < 0 THEN 1 ELSE 0 END) AS redeemed,
  SUM(balance_delta) AS net_balance
FROM trust_credits_ledger
WHERE granted_at > NOW() - INTERVAL '24 hours'
GROUP BY tier
ORDER BY tier;
```

Watch: if `granted > 10` and `redeemed = 0` after 2 hours, either the redemption UI is broken or the product is not what customers thought it was. Both are ship-stop signals.

### 4.3 Claude spend

```sql
SELECT
  COALESCE(user_id::text, 'anon')   AS who,
  COUNT(*)                          AS requests,
  SUM(cost_usd)                     AS usd,
  SUM(searches_used)                AS searches
FROM trust_api_usage
WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'utc')
GROUP BY 1
ORDER BY usd DESC
LIMIT 20;
```

Expected top anon spend < $10 (per lowered cap). Any single user_id > $25 indicates the cap is broken.

### 4.4 Rate-limit activity

```sql
SELECT bucket, COUNT(*) AS identifiers, SUM(count) AS total_hits, MAX(updated_at) AS last_hit
FROM trust_rate_limits
WHERE window_start > NOW() - INTERVAL '1 hour'
GROUP BY bucket
ORDER BY bucket;
```

Expected: `bucket` values of `free`, `pro`, `enterprise`, `gc:trust` (or whatever buckets the new RPC writes). Zero rows means the rate-limit RPC never fired — investigate.

### 4.5 Report generation latency

```sql
SELECT
  tier,
  COUNT(*)                               AS n,
  AVG(processing_ms)                     AS avg_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_ms) AS p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_ms) AS p95
FROM trust_reports
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY tier;
```

Watch: p95 > 60000ms → model is slow or searches are running long. Consider dropping `max_uses` on `web_search_20250305` temporarily.

### 4.6 Edge Function logs

```bash
supabase functions logs stripe-webhook-groundcheck \
  --project-ref gaawvpzzmotimblyesfp --tail
```

Red flags to watch for in log output:
- `signature verification failed` — Stripe config drift.
- `grant_credit_from_stripe_event failed` — RPC broke. Stop Stripe, investigate.
- `malformed session metadata — dead-lettered` — session creator bug. `product_family` metadata missing from `/api/trust/checkout`.

### 4.7 Failed trust reports

```sql
SELECT created_at, contractor_name, state_code, red_flags
FROM trust_reports
WHERE trust_score IS NULL
  AND risk_level = 'AMBIGUOUS'
  AND created_at > NOW() - INTERVAL '1 hour';
```

Expected: a small fraction of queries. Spike → the ambiguity gate is too sensitive and users are being forced through disambiguation unnecessarily.

---

## 5. Rollback procedure

Rollback is tiered. Pick the lowest-severity option that resolves the incident.

### 5.1 Soft rollback — disable purchases (2 min)

```bash
vercel env rm GROUNDCHECK_CHECKOUT_ENABLED production
vercel env add GROUNDCHECK_CHECKOUT_ENABLED production   # enter: false
vercel --prod
```

Result: existing credits still redeem, but new purchases return 410. Use for pricing bugs or Stripe webhook problems.

### 5.2 Medium rollback — freeze API (3 min)

Disable the route entirely by setting a feature flag the route reads at the top:

```bash
vercel env add GROUNDCHECK_API_ENABLED production    # enter: false
vercel --prod
```

The route returns 503 with `Retry-After: 3600`. Use for Claude cost runaway or rate-limit RPC failure.

### 5.3 Hard rollback — revert deploy (5 min)

```bash
# List last 5 prod deploys
vercel ls --prod --limit 5

# Promote the previous known-good deploy
vercel promote <deployment-url-from-before-launch>
```

Use only for widespread breakage. Note: Stripe webhook keeps working — it points at Supabase, not Vercel.

### 5.4 Database rollback

Don't. `trust_credits_ledger` is append-only and `trust_stripe_events` is the audit trail. Do not delete rows. If a credit was granted in error, insert a compensating `balance_delta = -1` row with `reason='launch_rollback'` and `source_metadata` explaining.

### 5.5 Stripe rollback

To stop new events from firing against a broken webhook:
- Stripe Dashboard → Developers → Webhooks → your endpoint → **Disable**.
- In-flight events keep retrying per Stripe's exponential backoff (3 days). Once the webhook is healthy, re-enable — Stripe replays missed events and our idempotency guarantees dedup.

### 5.6 Post-rollback

After any rollback:
1. Post in #engineering what broke and what you did.
2. File an incident in `docs/runbook/` with the rollback timestamp, queries you ran, and what the fix will be.
3. Do not re-enable until the audit item that caused the incident is closed with a test.

---

## 6. First-week check-ins

End of day 1, day 3, day 7:

- Review `AUDIT_REPORT_GROUNDCHECK_LAUNCH.md` P1 items. Anything still open?
- Review `trust_api_usage` aggregate cost vs revenue from `trust_stripe_events`. Margin healthy?
- Review `trust_audit_log` for rejected individual-lookup attempts (P0-7 gate). Any pattern of legit users hitting it means the entity-suffix heuristic is too strict.
- Compact `trust_cache` if `hit_count` skew suggests poor cache utilization.

---

## 7. Launch-day env vars for the remediation commit

This section reflects the state of the codebase after the `chore(groundcheck): P0/P1 audit remediation` commit. The paid Stripe flow is gated off at the feature-flag layer; only free / pro / enterprise synchronous lookups are live.

Set on Vercel (Production scope):

```
GROUNDCHECK_CHECKOUT_ENABLED=false    # keep false until redemption commit ships
CHECKR_PARTNER_URL=                   # empty string or full URL — see below
TRUST_USER_DAILY_CAP_USD=25           # per-user Claude spend cap
TRUST_ANON_DAILY_CAP_USD=10           # lowered per P2-15 (was $50)
```

Notes:

- `GROUNDCHECK_CHECKOUT_ENABLED=false` makes `/api/trust/checkout` return HTTP 410 `checkout_disabled` and hides every paid-tier CTA in the dashboard (`src/app/dashboard/gc/contractors/*`, `src/app/dashboard/driver/trust/*`). Flip to `true` only after the redemption commit (redemption API + `/account/gc` balance page + live Stripe price IDs) lands.
- `CHECKR_PARTNER_URL` is optional. Empty string is fine for v0 — the 422 response's `checkr_url` field is `null` and the UI hides the link. Confirm final URL with Juan before flipping the checkout flag.
- All existing trust env vars (`ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Stripe keys) are unchanged.
- Do **not** introduce `NEXT_PUBLIC_GROUNDCHECK_CHECKOUT_ENABLED`. The flag is server-only; client components receive the decision via props rendered by a server parent.

### 7.1 Paid-tier activation checklist (2–4 days out from remediation)

Do not flip `GROUNDCHECK_CHECKOUT_ENABLED=true` until every box is checked:

- [x] Redemption commit landed (see §8) — `/api/trust` paid-tier branch + `/api/trust/checkout/success` call `redeem_credit_atomic(...)` and enqueue `trust_jobs` rows.
- [ ] `/account/gc` credit-balance page deployed and reads `user_credit_balance(user_id, tier)`.
- [ ] Stripe dashboard live-mode products created for all four tiers (standard / plus / deep_dive / forensic).
- [ ] `STRIPE_PRICE_GC_STANDARD`, `_PLUS`, `_DEEP_DIVE`, `_FORENSIC` env vars set in Vercel production with the live price IDs.
- [ ] `src/lib/trust/checkout.ts` migrated from inline `price_data` to `line_items: [{ price: process.env.STRIPE_PRICE_GC_* }]`.
- [ ] Webhook smoke test green: `stripe trigger checkout.session.completed --add ...product_family=ground_check` lands one row in `trust_credits_ledger` and one in `trust_stripe_events` with matching `credit_id`.
- [ ] Juan confirms final prices on record.

Only after all seven: `vercel env add GROUNDCHECK_CHECKOUT_ENABLED production` → enter `true` → `vercel --prod`.

### 7.2 Rollback (seconds)

If anything goes wrong after the flag flips to `true`:

```bash
vercel env rm  GROUNDCHECK_CHECKOUT_ENABLED production
vercel env add GROUNDCHECK_CHECKOUT_ENABLED production   # enter: false
vercel --prod
```

Result: paid checkout returns 410 again, pricing UI returns to placeholder, free lookup stays live. Purchases already in flight settle via Stripe webhook → `grant_credit_from_stripe_event` → credits wait in `trust_credits_ledger` until redemption is reachable again.

## §8. Redemption Flow

End-to-end sequence for a credit-backed GroundCheck report:

1. **User clicks a paid tier** in the dashboard (driver `/dashboard/driver/trust` or GC `/dashboard/gc/contractors`).
2. **Client POSTs** `/api/trust/checkout` with `{ tier, contractor_name, state_code, return_path }`.
3. **Checkout route** validates the tier/name/state, runs `assertEntityOnly` (422 on natural-person queries — no Stripe session opened for blocked queries), resolves a per-tier price ID from `STRIPE_PRICE_TRUST_*` env vars, and calls `stripe.checkout.sessions.create(...)` with `client_reference_id=user.id`, metadata `{ tier, contractor_name, state_code, user_id, product_family: 'ground_check' }`, and a per-minute idempotency key.
4. **Stripe Checkout** collects payment.
5. **Stripe webhook** (Supabase Edge Function `stripe-webhook-groundcheck`) calls `grant_credit_from_stripe_event` which inserts into `trust_credits_ledger` + `trust_stripe_events` atomically. (Unchanged by this commit.)
6. **Stripe redirects** the browser to `/api/trust/checkout/success?session_id=…`.
7. **Success route** retrieves the session from Stripe, verifies `status=complete`, `payment_status=paid`, and `client_reference_id=auth.uid()`, then calls `redeem_credit_atomic(..., p_idempotency_key='checkout:<session_id>')`.
8. On `INSUFFICIENT_CREDITS` (SQLSTATE `23514`) the handler assumes the webhook hasn't landed yet and 303-redirects to `/dashboard/<role>/trust/processing?session_id=<id>`. That page polls `/api/trust/checkout/success?session_id=…&format=json` every 3 s, up to 5 min.
9. On successful redemption, the handler calls `enqueue_trust_job(..., p_idempotency_key='job:checkout:<session_id>')` and 303-redirects to `/dashboard/<role>/{contractors|trust}?job_id=<id>&auto=1`.
10. **Dashboard clients** pick up `job_id` + `auto=1`, polling `/api/trust/job/[id]` every 2 s until `status ∈ {completed, failed}`, then render the final report.

### §8.1 Stripe Price ID Env Vars

Three per-tier env vars plus one allowlist:

- `STRIPE_PRICE_TRUST_STANDARD` — Stripe price ID for the $0.19 Standard report.
- `STRIPE_PRICE_TRUST_PLUS` — Stripe price ID for the Plus report (final price TBD).
- `STRIPE_PRICE_TRUST_DEEP_DIVE` — Stripe price ID for the $2.00 Deep Dive report.
- `STRIPE_ALLOWED_ORIGINS` — comma-separated allowlist of origins permitted for `success_url` / `cancel_url` host derivation. Falls back to `NEXT_PUBLIC_SITE_URL` when unset.

Juan creates the three Products in the Stripe dashboard (Standard $0.19, Plus TBD, Deep Dive $2.00), copies each price ID, and sets the env vars in Vercel prod + preview. Price IDs never land in source.

### §8.2 Activation Procedure

1. Create the three Stripe Products + live-mode Prices (Standard $0.19, Plus TBD, Deep Dive $2.00).
2. Set `STRIPE_PRICE_TRUST_STANDARD`, `STRIPE_PRICE_TRUST_PLUS`, `STRIPE_PRICE_TRUST_DEEP_DIVE` in Vercel prod + preview.
3. Set `STRIPE_ALLOWED_ORIGINS` (e.g. `https://earthmove.io`).
4. Verify `/api/trust/checkout` still returns HTTP 410 `checkout_disabled` — flag is still off.
5. Flip `GROUNDCHECK_CHECKOUT_ENABLED=true` in Vercel production.
6. Redeploy (`vercel --prod`).
7. Smoke test: log in as `test-gc@earthmove.io` → search "Acme Construction LLC" CO → click Standard upgrade → complete Stripe test card `4242 4242 4242 4242` → confirm the webhook lands a `trust_credits_ledger` row, the success route redeems atomically, and the dashboard auto-opens the enqueued job to completion.
