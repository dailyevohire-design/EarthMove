# BUILD_LOG.md

## 2026-04-17 — Tier-aware trust engine refactor (PLANNED, not executed)

### Goal
Refactor `src/lib/trust/trust-engine.ts` from a single-tier free-only function into a tier-aware engine with persona support. Preserve security posture and byte-identical behavior for the existing free (b2b) path.

### Scope — 10 steps from spec

1. Rename `runFreeTier` → `runTrustEngine`; keep `runFreeTier` as alias.
2. New object-arg signature `{ name, city, state, tier, persona, onSearch? }`.
3. New file `src/lib/trust/tier-config.ts` with `TIER_CONFIG` map (free/standard/plus/deep_dive/forensic).
4. Extract current inline system prompt → `src/lib/trust/prompts/b2b-free-tier.ts` (verbatim, preserve injection guards + bookend).
5. Create stub prompts for homeowner tiers; each re-exports `b2b-free-tier` for now (TODO comment).
6. Fix `report_tier` hardcoded `'free'` bug on line 102 → use the `tier` parameter.
7. Update `src/app/api/trust/route.ts` to pass `tier` + `persona`; default `persona='b2b'` (unchanged behavior for GC/driver dashboards).
8. Add `modelPricing` map; select per tier's model. Opus-4 $15/$75, Sonnet-4-6 $3/$15.
9. Do not touch `trust-validator.ts`, `prompt-guards.ts`, Supabase RPCs. Cache stays at route layer.
10. Run existing tests.

### Blockers discovered while planning — NEED YOUR DECISION

**Blocker A — Zod validator rejects new tier values**
- `src/lib/trust/trust-validator.ts:9` defines `report_tier: z.enum(['free','pro','enterprise'])` under `.strict()`.
- Step 6 wants us to write `report_tier: tier` where `tier ∈ {free, standard, plus, deep_dive, forensic}`.
- Step 9 says do not touch `trust-validator.ts`.
- These two rules conflict. `standard`/`plus`/`deep_dive`/`forensic` will fail validation → every non-free tier call throws.
- **Option A1** (recommended): update the enum to `['free','standard','plus','deep_dive','forensic']`. Minimal change, doesn't affect security, keeps the validation guarantee. Still "not touching" injection guards, parsing, or salvage logic.
- **Option A2**: drop `report_tier` from Zod schema entirely; let the engine attach it after validation.
- **Option A3**: map new tiers back to legacy values before validation (ugly).

**Blocker B — DB CHECK constraint rejects new tier values**
- `sql/dashboard_trust_migration.sql:25`: `tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','enterprise'))`.
- `route.ts` writes `tier` directly to the column. Insert will fail for new tier values.
- Cache table almost certainly has the same constraint — need to confirm by reading the full migration.
- **Option B1** (recommended): new migration that drops the old CHECK and recreates it with the expanded set. Include the legacy values (`pro`, `enterprise`) to avoid breaking any orphaned rows.
- **Option B2**: map new tiers → `pro` at write time. Loses analytic fidelity (can't distinguish plus from deep_dive in the DB).

**Blocker C — model ID `claude-opus-4`**
- Spec says `model: 'claude-opus-4'` for deep_dive + forensic.
- Current Anthropic model IDs for the 4.x Opus family: `claude-opus-4-7` (latest), not bare `claude-opus-4`.
- Calling `claude-opus-4` as-is may 404 at the API.
- **Option C1** (recommended): use `claude-opus-4-7`.
- **Option C2**: keep `claude-opus-4` as-is (you've confirmed it's a real model ID for this account).

### Analytics check for Step 6 (`report_tier` bug fix)
- Grepped the repo: no code filters, groups, or compares against `report_tier === 'free'`.
- Schema enum references it but no business logic branches on it.
- `trust_reports.tier` (DB column) is the source of truth for analytics — always written from the `tier` parameter, never from the engine's hardcoded literal.
- Conclusion: fixing the hardcode is safe. Nothing downstream depends on the bug.

### Test impact
- No existing tests cover `trust-engine.ts` or `/api/trust`. Confirmed via `find`.
- Existing tests: `pricing-engine.test.ts`, `dispatch.test.ts`, `webhooks/stripe/route.test.ts`. Unrelated.
- Step 10 is trivially satisfied — nothing to regress.

### Files that will change
- `src/lib/trust/trust-engine.ts` — refactor
- `src/lib/trust/tier-config.ts` — NEW
- `src/lib/trust/prompts/b2b-free-tier.ts` — NEW (verbatim extract)
- `src/lib/trust/prompts/homeowner-standard.ts` — NEW (stub)
- `src/lib/trust/prompts/homeowner-plus.ts` — NEW (stub)
- `src/lib/trust/prompts/homeowner-deep-dive.ts` — NEW (stub)
- `src/lib/trust/prompts/homeowner-forensic.ts` — NEW (stub)
- `src/app/api/trust/route.ts` — pass tier + persona
- `src/lib/trust/trust-validator.ts` — only if Option A1 chosen
- New SQL migration — only if Option B1 chosen

### Non-goals / not touching
- `trust-validator.ts` injection guards, Zod structural checks, salvage logic.
- `prompt-guards.ts`.
- Supabase cache RPCs (`get_cached_trust_report`, `set_cached_trust_report`).
- `install_dashboard.sh` (flagged: it contains a heredoc copy of the old engine; re-running it would clobber the refactor — mention to user but don't touch).

### Acceptance criteria
- `runFreeTier({ ... tier: 'free', persona: 'b2b' })` produces byte-identical output to today's `runFreeTier(name, city, state)` — same system prompt, same model, same max_uses, same search count, same salvage path.
- `report_tier` in returned report matches the `tier` parameter (not always `'free'`).
- `tsc --noEmit` clean.
- Existing unrelated tests still pass.
- New tier values flow end-to-end from route → engine → DB without insert errors (requires Blocker B resolved).

### Status: EXECUTED 2026-04-17 (A1 + B1 + C1 approved)

---

## 2026-04-17 — Tier-aware trust engine refactor (HAND-OFF)

### Files created
- `src/lib/trust/prompts/b2b-free-tier.ts` — verbatim extract of the pre-refactor `SYSTEM_PROMPT`. Injection guards (header `[IMMUTABLE — …]` and bookend `[REMINDER: …]`) preserved byte-for-byte.
- `src/lib/trust/prompts/homeowner-standard.ts` — stub; re-exports b2b prompt. TODO for Agent 2B.
- `src/lib/trust/prompts/homeowner-plus.ts` — stub; re-exports b2b prompt. TODO for Agent 2B.
- `src/lib/trust/prompts/homeowner-deep-dive.ts` — stub; re-exports b2b prompt. TODO for Agent 2B.
- `src/lib/trust/prompts/homeowner-forensic.ts` — stub; re-exports b2b prompt. TODO for Agent 2B.
- `src/lib/trust/tier-config.ts` — `TrustTier`/`TrustPersona` types, `TIER_CONFIG` map (5 tiers), `SYSTEM_PROMPTS` key→prompt map, `MODEL_PRICING` map (sonnet-4-6: $3/$15; opus-4-7: $5/$25), `computeCost()` helper.
- `src/lib/trust/__tests__/trust-engine.smoke.test.ts` — 6 tests, mocked Anthropic SDK.
- `supabase/migrations/020_trust_tier_expansion.sql` — forward-only migration: drops the inline `trust_reports.tier` CHECK (looked up dynamically in a `DO $$ ... $$` block for robustness), replaces with the 7-value set (legacy `pro`/`enterprise` preserved for historical rows).

### Files modified
- `src/lib/trust/trust-engine.ts` — full rewrite:
  - `runFreeTier(name, city, state, onSearch)` → `runTrustEngine({ name, city, state, tier, persona, onSearch? })`.
  - `export const runFreeTier = runTrustEngine` for backward compat (object-arg only; pre-refactor positional callers must be updated — route.ts already migrated).
  - Model, `max_uses`, and system prompt now sourced from `TIER_CONFIG[tier]` + `SYSTEM_PROMPTS[…]`.
  - Cost now computed via `computeCost(config.model, …)` — no more hardcoded Sonnet pricing.
  - **Bug fix (step 6):** line 102's hardcoded `report_tier: 'free'` replaced with `report_tier: tier`. Regression test added.
  - Prominent `/** ⚠️ LANDMINE WARNING … */` JSDoc header flagging the `install_dashboard.sh` heredoc.
- `src/lib/trust/trust-validator.ts` — Zod enum for `report_tier` expanded to `['free','pro','enterprise','standard','plus','deep_dive','forensic']`. Legacy `pro`/`enterprise` carry `// @deprecated` line comments. Zero other changes.
- `src/app/api/trust/route.ts`:
  - Import switched: `runFreeTier` → `runTrustEngine`, plus `TrustTier` type.
  - Tier validation expanded to 7 values.
  - Auth gate simplified from `tier === 'pro' || tier === 'enterprise'` to `tier !== 'free'`.
  - Adds an `engineTier` local that maps legacy `pro`/`enterprise` → `free` for the engine call (preserves pre-refactor behavior — pre-refactor engine ignored tier). Requested `tier` still written to DB; enterprise cache-bypass (`tier !== 'enterprise'` check at line 68) untouched.
  - Call site passes `{ tier: engineTier, persona: 'b2b', onSearch: q => searches.push(q) }`.

### Files NOT touched (per spec)
- `src/lib/trust/prompt-guards.ts` — untouched.
- `src/lib/trust/trust-validator.ts` injection-defense / salvage / structural Zod schema — untouched (only the `report_tier` enum values changed).
- Supabase cache RPCs (`get_cached_trust_report`, `set_cached_trust_report`) — untouched. The `set_cached_trust_report` TTL CASE has an ELSE branch (24h) that auto-covers new tiers; per-tier TTL tuning is a follow-up (see Open items).

### Tests run
- `npx vitest run src/lib/trust` → 6/6 pass (smoke tests: free+b2b routing, standard+homeowner routing, deep_dive routing to opus-4-7, report_tier passthrough regression, free-tier report_tier, runFreeTier alias parity).
- `npx vitest run` (full suite) → **35/35 pass** across 4 test files. No regressions in `pricing-engine`, `dispatch`, or `stripe/route` tests.
- `npx tsc --noEmit` → one pre-existing unrelated error (`src/app/api/dispatch/backhaul/route.ts:78` — `Binding element 'error' implicitly has an 'any' type`). Not caused by this refactor; not in scope. No TypeScript errors in any refactored or new file.

### Acceptance criteria — all GREEN
- ✅ `runFreeTier({ tier:'free', persona:'b2b', name, city, state })` produces byte-identical Anthropic request to the pre-refactor `runFreeTier(name, city, state)` — same `model`, same `system` prompt, same `max_uses`, same tool shape, same message flow. Asserted in the "runFreeTier alias" smoke test.
- ✅ `report.report_tier` now matches the `tier` parameter in all cases (regression test passes for `plus`; free still returns `free`).
- ✅ `tsc --noEmit` clean for all touched files.
- ✅ Existing unrelated tests pass unchanged.
- ⚠️ End-to-end route→engine→DB for new tiers **not exercised live** — smoke tests mock the Anthropic SDK, and the DB migration has not been applied. See Open items.

### Surprises / notes for the next agent
1. **`trust_api_usage` has no `tier` column** — my initial read of the migration suggested it might (grep hit `tier TEXT NOT NULL` at line 76). That line is on `trust_cache`, not `trust_api_usage`. `trust_api_usage` never had a tier column. Route.ts's INSERT on that table (which omits `tier`) is correct and pre-existing.
2. **`trust_cache.tier` has no CHECK constraint** — it's `TEXT NOT NULL` only. No migration needed for it.
3. **`set_cached_trust_report` RPC TTL CASE** has an `ELSE INTERVAL '24 hours'` branch, so new tiers get a default 24h TTL without RPC changes. Per-tier TTL tuning is deferred (Open items).
4. **The backhaul route tsc error** (`dispatch/backhaul/route.ts:78`) is pre-existing. Flagged but not fixed (out of scope).
5. **`persona` is accepted but unused** in the engine body today. The engine wraps it in `void params.persona` to silence lint. Tier alone determines the prompt right now; persona is reserved for Agent 2B+ tier-specific branching.
6. **Opus-4-7 $5/$25 pricing** was taken as-given from the user's prompt. If this is account-specific (negotiated rate / cached-input tier), verify before invoicing off it. Public list pricing for Opus 4.7 on anthropic.com may differ.

---

## Open items — follow-ups

1. **`install_dashboard.sh` heredoc landmine.**
   Lines ~427, ~471, ~547 in `install_dashboard.sh` contain a heredoc copy of the pre-refactor `trust-engine.ts` (single-tier, `runFreeTier` positional, hardcoded `report_tier:'free'`, inline SYSTEM_PROMPT). Re-running that script will clobber this refactor and silently revert every behavior change.
   **Action:** gut those heredoc blocks (or replace them with a pointer to the refactored source files). Until done, treat `install_dashboard.sh` as "do not re-run."
   Severity: medium (requires someone to re-run the installer to trigger).
2. **Apply migration `020_trust_tier_expansion.sql` to the live Supabase project.**
   Until applied, requests with `tier ∈ {standard, plus, deep_dive, forensic}` will succeed through the API but fail the DB insert at `admin.from('trust_reports').insert(...)` (the insert is wrapped in a non-fatal try/catch, so the API will still return 200 — but the row, cache entry, and usage log will not be written).
3. **Per-tier cache TTLs.**
   `set_cached_trust_report` CASE currently only enumerates legacy `free`/`pro`/`enterprise`. New tiers fall into the default 24h ELSE branch. Consider extending the CASE (e.g., `plus` 12h, `deep_dive` 6h, `forensic` 2h) when Agent 2B populates the prompts.
4. **Route-layer cache-bypass logic** still uses `tier !== 'enterprise'` as the bypass condition. After the legacy pro/enterprise tiers are sunset, revisit whether `deep_dive`/`forensic` should bypass cache instead.
5. **Legacy tier analytics.** DB column `trust_reports.tier` now accepts 7 values. Any downstream dashboard or query that filters on `tier IN ('free','pro','enterprise')` will miss new-tier rows silently. Audit before building analytics on the new tiers.
6. **Persona parameter not yet consumed.** `TrustEngineParams.persona` is accepted but unused in the engine. Agent 2B should decide whether persona is needled through prompts or kept implicit in tier routing.
7. **`trust_api_usage` needs a `tier` column for per-tier revenue analytics.** Phase 2 follow-up. Today the table has no tier column, so we can't slice cost/usage by tier (free vs standard vs plus vs deep_dive vs forensic). Add column + backfill strategy before Phase 2 billing/analytics work.
8. **Per-tier cache TTLs in `set_cached_trust_report` RPC.** The CASE branch currently only enumerates legacy `free`/`pro`/`enterprise` with a default 24h ELSE. Phase 2 tuning per spec: `standard` 30d, `plus` 14d, `deep_dive` 14d, `forensic` 7d. Edit the RPC (cache RPC was intentionally untouched in the initial refactor per step 9 of the spec).
9. **Opus 4.7 tokenizer inflation.** Anthropic docs flag that the Opus 4.7 tokenizer can inflate token counts up to ~35% for structured data vs Sonnet tokenization. Deep_dive and forensic tiers both run on opus-4-7 and emit structured JSON reports. **Action:** monitor actual vs. estimated API spend on those tiers after launch; adjust `MODEL_PRICING` in `tier-config.ts` or add a tokenizer-specific multiplier if real spend exceeds projections meaningfully. Baseline the first 50–100 runs post-launch.

---

## 2026-04-17 — Migration 020 applied + verified (HAND-OFF)

### Applied
- Project: **Earth Pmove** (`gaawvpzzmotimblyesfp`, us-east-1) — the live EarthMove production DB.
- Method: Supabase MCP `apply_migration`.
- Migration name: `020_trust_tier_expansion`.
- Result: `{"success": true}`.

### Verification

**(1) CHECK constraint now shows all 7 values**
```
CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text, 'standard'::text, 'plus'::text, 'deep_dive'::text, 'forensic'::text])))
```
(before the migration it was 3 values: `'free', 'pro', 'enterprise'`.)

**(2) Manual INSERT with `tier='standard'` succeeds**
Wrapped in `BEGIN; ... ROLLBACK;` so no row persisted. The insert returned:
```
id=3bf60795-f1ce-4ec9-b9c5-cf7225c584ac, tier=standard, contractor_name=__migration_test_standard__
```

**(3) Manual INSERT with `tier='garbage'` fails**
Exact Postgres error:
```
ERROR: 23514: new row for relation "trust_reports" violates check constraint "trust_reports_tier_check"
DETAIL: Failing row contains (..., garbage, 50, LOW, LOW, ...)
```

**Post-test cleanup check:** `SELECT ... WHERE contractor_name LIKE '__migration_test%'` returned `[]` — zero leaked rows.

### Risk cleared
Silent-failure risk from Open item #2 (route would 200 while inserts failed the CHECK) is now resolved. New-tier reports will persist to `trust_reports` end-to-end.

### Status
Ready for the next agent.

---

## 2026-04-17 — Agent 2 — Homeowner prompts + resolver + entitlement 402 (HAND-OFF)

### Blockers surfaced and resolved at start
- **`docs/MASTER_BLUEPRINT.md` does not exist in the repo.** Agent 2 worked from the user's inline spec. Badge criteria, score-to-tier band thresholds, and Phase 3/4 scoping details were INFERRED where not explicitly given. See "Inferred items awaiting confirmation" below.
- **Entitlement tables did not exist.** The `/api/trust` 402 flow needs `trust_credits_ledger` + `trust_report_access`. Agent 3 owns Stripe, but the tables must exist before the check runs. Agent 2 created a minimal schema in migration 021 and wired the enforcement; Agent 3 should EXTEND (never replace) these tables.
- **Partial index with `NOW()` rejected by Postgres.** First migration attempt failed with `42P17: functions in index predicate must be marked IMMUTABLE`. Resolved by dropping the `WHERE expires_at > NOW()` predicate and indexing `expires_at` as a key column instead; expiry filter is applied at query time.

### Files created
- `src/lib/trust/prompts/homeowner-standard.ts` — real prompt: homeowner framing, 10 searches (SoS → licensing board → BBB → Google → Yelp/Angi/HA → Nextdoor → WC → COI → complaints → liens filed AGAINST homeowners), Section 10b 100-point scorecard, 4 badges, 5-tier score bands, NEVER-DO list (family relationships, phones as individual IDs, natural-persons-as-private, family members, sensitive personal data).
- `src/lib/trust/prompts/homeowner-plus.ts` — 25 searches. Adds physical_presence (CMRA flag), lien_check (UCC-1 + state/federal tax), digital_forensics (WHOIS + Wayback + GMB + permit history), principal_overlap (BUSINESS-data overlap only — shared phone/address/website/DOT across entities, never family trees or surnames).
- `src/lib/trust/prompts/homeowner-deep-dive.ts` — 50 searches. Adds court_records (civil + bankruptcy + criminal + federal), regulatory_history (license actions + OSHA + AG + wage + FTC), extended_principal_network (chameleon-carrier flag). Includes `/** PHASE 3 TODO **/` marker for PACER/Lexis/state-portal paid integrations.
- `src/lib/trust/prompts/homeowner-forensic.ts` — 80 searches. Adds shell_game_analysis, predictive_risk, evidence_bundle. Includes `/** PHASE 4 TODO **/` marker for PACER/Lexis/FMCSA deep/SoS bulk/D&B/TLO/Westlaw/appraiser integrations and the PDF generation service.
- `src/lib/trust/prompts/resolver.ts` — resolver system prompt with IMMUTABLE guards + bookend + NEVER-DO list.
- `src/lib/trust/schemas.ts` — `HomeownerStandardSchema` / `HomeownerPlusSchema` / `HomeownerDeepDiveSchema` / `HomeownerForensicSchema`; `HomeownerTrustReportSchema` = `z.discriminatedUnion('report_tier', [...])`; `parseHomeownerReport(raw, tier)` with per-tier default salvage; `AnyTrustReport` union. Base b2b `TrustReportSchema` is untouched and still used for `free/pro/enterprise`.
- `src/lib/trust/resolver.ts` — `detectInputType()` with precedence (DOT > phone > URL > domain > name), E.164 normalization; `resolveContractor({input, region?})` using Haiku 4.5 (`claude-haiku-4-5-20251001`) + web_search (max 4); returns `{inputType, normalizedInput, candidates[], confidence, notes}`; `confidence='none'` always includes the "consider this itself a risk signal" framing (fail-safe: never throws, unparseable LLM output → confidence='none').
- `src/lib/trust/entitlement.ts` — `checkEntitlement({userId, tier, contractorName, stateCode})`: looks up `trust_report_access` first (specific contractor unlocked), then `trust_credits_ledger` (any unredeemed credit). `buildCheckoutUrl()` stub. `isPaidHomeownerTier()` type guard.
- `src/app/api/trust/resolve/route.ts` — POST endpoint. Auth not required. Rate limit 30/min/IP via `resolverRateLimiter`. Validates `input` length (≤300) and region (regex `^[A-Za-z]{2}$`). Returns resolver result JSON.
- `src/app/api/trust/route.test.ts` — route-level entitlement 402 test using full Supabase/Anthropic/rate-limiter mocks.
- `src/lib/trust/__tests__/homeowner-standard.test.ts` — 6 tests. Asserts standard uses maxSearches=10 and `SYSTEM_PROMPTS.homeownerStandard`, homeowner prompt is NOT the b2b free prompt anymore (contains "HOMEOWNER", IMMUTABLE guard header, bookend reminder), report validates against `HomeownerStandardSchema`, plus uses maxSearches=25 and validates against `HomeownerPlusSchema`, salvage fills defaults when LLM omits homeowner fields.
- `src/lib/trust/__tests__/resolver.test.ts` — 15 tests. Covers detectInputType precedence (USDOT/DOT/bare-7-with-DOT-nearby/E.164/US-10/URL/domain/name), `resolveContractor` dispatches Haiku 4.5 with max_uses=4, candidates for name + phone (with E.164 normalization), `confidence='none'` includes risk-signal framing when no records, unparseable LLM output returns `confidence='none'` (no throw), DOT dispatch.
- `supabase/migrations/021_trust_entitlements.sql` — `trust_credits_ledger` + `trust_report_access`. RLS on both. Per-user SELECT policies.

### Files modified
- `src/lib/trust/prompts/homeowner-{standard,plus,deep-dive,forensic}.ts` — replaced Agent-1 stubs (which re-exported b2b-free-tier) with real prompts. Their `// TODO(Agent 2B):` markers are now consumed.
- `src/lib/trust/trust-engine.ts` — dispatches parser by tier: `parseHomeownerReport(raw, tier)` for homeowner tiers, existing `parseReport(raw)` for free/pro/enterprise. Return type widened to `AnyTrustReport`. `report_tier` bug fix from Agent 1 still honored.
- `src/lib/trust/rate-limiter.ts` — added `homeownerRateLimiter` (20/min, same bucket as pro) and `resolverRateLimiter` (30/min). `getRateLimiter()` now routes homeowner tiers to the homeowner bucket.
- `src/app/api/trust/route.ts` — accepts `persona` in body (homeowner tiers default to `'homeowner'`, legacy tiers default to `'b2b'`, body can override); **entitlement check runs BEFORE rate-limit and cost-cap** so paid-tier requests without credits short-circuit to 402 without spending compute; 402 body is `{ error, code: 'ENTITLEMENT_REQUIRED', tier, contractor, state, checkoutUrl }`; after a successful paid-homeowner report, writes a 90-day `trust_report_access` row and (best-effort, non-fatal) increments `credits_redeemed` if the entitlement came from a credit.

### Files NOT touched (per spec)
- `src/lib/trust/trust-validator.ts` — untouched in this agent. The Zod `report_tier` enum already accepts all 7 tier values from Agent 1.
- `src/lib/trust/prompt-guards.ts` — untouched.
- Supabase cache RPCs (`get_cached_trust_report`, `set_cached_trust_report`) — untouched.

### New endpoints
- `POST /api/trust/resolve` — contractor resolver. Auth NOT required. 30/min/IP. Body: `{ input, region? }`. Returns `{ inputType, normalizedInput, candidates[], confidence, notes }`.
- `POST /api/trust` — still the report generator. Now returns **402** `{ code: 'ENTITLEMENT_REQUIRED', checkoutUrl, ... }` for paid-homeowner tiers without credits.

### Tests run
- `npx vitest run src/lib/trust src/app/api/trust` → **29/29 pass**
  - homeowner-standard.test.ts: 6/6
  - resolver.test.ts: 15/15
  - trust-engine.smoke.test.ts: 6/6 (Agent 1 regression — STILL PASSES — b2b free path unchanged)
  - route.test.ts: 2/2 (entitlement 402 for standard + plus)
- `npx vitest run` (full suite) → **58/58 pass** across 7 test files. Zero regressions.
- `npx tsc --noEmit` → clean for all touched files (one pre-existing unrelated error in `dispatch/backhaul/route.ts:78` persists from Agent 1; out of scope).

### Migration applied
- Project `gaawvpzzmotimblyesfp` (Earth Pmove), migration `021_trust_entitlements`.
- First attempt failed (`NOW()` not IMMUTABLE in partial index predicate); recovered by indexing `expires_at` as a key column and removing the `WHERE expires_at > NOW()` predicates.
- Verified: both tables exist with RLS enabled (`SELECT tablename, rowsecurity FROM pg_tables` → both rows `rowsecurity=true`).

### Acceptance criteria — all GREEN
- ✅ `npx vitest run src/lib/trust` passes (plus `src/app/api/trust`).
- ✅ `npx tsc --noEmit` clean for all touched files.
- ✅ Existing b2b free-tier flow unchanged — Agent 1 smoke tests all still pass, including the alias test and report_tier regression.
- ⚠️ Manual `curl` verification was NOT run live against the deployed site — route + resolver are exercised under mocked Supabase and mocked Anthropic. Live sanity check deferred to user acceptance.

### Notes to Agent 3 (Stripe webhook + credit system)
- **Credits redemption flow must call `POST /api/trust` with the correct tier**; the route enforces entitlement. Stripe webhook's job is to INSERT the credit row into `trust_credits_ledger` on `checkout.session.completed` / `payment_intent.succeeded`. Include `stripe_checkout_session_id` and `stripe_payment_intent_id` for idempotency. Use an idempotency-key pattern — the current schema doesn't include one; add a column (`idempotency_key TEXT UNIQUE`) as part of Agent 3.
- The current credit-redeem step in `route.ts` does a read-then-update. Replace it with a SQL RPC (`CREATE FUNCTION redeem_credit(p_credit_id uuid) RETURNS void` with `UPDATE ... credits_redeemed = credits_redeemed + 1` using `FOR UPDATE` row lock or a `CHECK (credits_redeemed <= credits_granted)` guard). Atomic increment is the correct fix.
- `buildCheckoutUrl()` in `src/lib/trust/entitlement.ts` currently returns `/checkout/groundcheck?tier=...&contractor=...&state=...` — a frontend-friendly placeholder. Agent 3 wires this to a real Stripe Checkout Session creator.

### Notes to Agent 4 (frontend)
- Landing page "search contractor" box calls `POST /api/trust/resolve`. If the user pastes a phone / URL / DOT / name, the resolver returns candidates or `confidence='none'` with the "risk signal" framing. Handle empty candidates as a surfaced UX — an absence of business records is ITSELF a signal.
- Teaser page calls `POST /api/trust` with `tier: 'standard'` (or higher) only AFTER credit redemption. Until credits exist, this call returns **402** `{ code: 'ENTITLEMENT_REQUIRED', checkoutUrl }`. On 402, redirect the browser to `body.checkoutUrl`.
- Legacy B2B dashboard behavior (`tier: 'free' | 'pro' | 'enterprise'`) is unchanged — no entitlement check, same response shape.

### Inferred items awaiting user confirmation
These were set to reasonable defaults because `docs/MASTER_BLUEPRINT.md` does not exist in the repo. User should review before public launch:
1. **Badge criteria (homeowner-standard prompt)** —
   - legitimate_business: SoS VERIFIED and not dissolved/suspended
   - liability_insured: public evidence of general liability coverage (COI on file, named insurer)
   - workers_comp_covered: active WC board coverage OR documented sole-prop exemption
   - well_reviewed: avg >= 4.0 across >= 10 reviews AND sentiment not NEGATIVE
2. **Score-to-tier bands (all homeowner tiers)** —
   - 85-100 → highly_trusted
   - 70-84  → trusted
   - 55-69  → acceptable
   - 35-54  → use_caution
   - 0-34   → not_recommended
3. **Scorecard scoring rubrics** — each module's subtraction/addition deltas (e.g., "CMRA_FLAGGED subtracts 8 from business_legitimacy") were chosen to be internally consistent. Adjust before launch.
4. **Deep Dive scope** — capped at 50 web searches with `/** PHASE 3 TODO **/` for PACER, Lexis, and state court-portal POST-auth integrations. Flag in BUILD_LOG Open items.
5. **Forensic scope** — capped at 80 web searches with `/** PHASE 4 TODO **/` for paid integrations (PACER, Lexis, FMCSA deep, SoS bulk, D&B/Experian, TLO, Westlaw), plus the `evidence_bundle.signed_pdf_url` which requires the Phase 4 PDF generation service.
6. **Access window duration** — `trust_report_access.expires_at` set to 90 days from grant. Business decision pending.
7. **Cache TTLs for new tiers** — not touched in this agent (Open item #8 from prior hand-off still pending).
8. **Credits table idempotency** — `trust_credits_ledger` has no `idempotency_key` column yet; Agent 3 should add one.

### Surprises
1. **Postgres rejected `NOW()` in partial index predicate** (`42P17: functions in index predicate must be marked IMMUTABLE`). Removed the partial, included `expires_at` as a key column instead. Queries still fast; slightly larger index.
2. **`TrustReportSchema` is `.strict()`**, which made `.extend()` inheritance awkward for homeowner variants. Resolved by pulling `.shape` off the strict object, stripping `report_tier`, and constructing fresh per-tier objects (non-strict on purpose — LLMs occasionally emit extra fields that we silently drop rather than fail).
3. **The `persona` parameter is still not consumed by the engine body** (carried over from Agent 1). It's threaded through the request → route → engine contract, but the prompt choice is determined by `tier` alone. Agent 2B (if different from Agent 2) can branch prompts on persona if needed; currently `tier` uniquely identifies the prompt.
4. **`install_dashboard.sh` heredoc landmine** (Open item #1) is now MORE dangerous — any re-run of that script will clobber: the Agent-1 refactor, the Agent-2 homeowner prompts, the discriminated-union schema, the resolver, and the entitlement wiring. This script should be gutted or deleted before anyone re-runs it.
5. **Haiku 4.5 model ID** — used `claude-haiku-4-5-20251001` (the exact ID from the env system reminder), not the bare `claude-haiku-4-5` the user wrote in the spec. Bare-version IDs are not guaranteed to resolve.

### Test counts + coverage delta
- Before this agent: 35 tests across 4 files (Agent 1 smoke + 3 unrelated).
- After this agent: **58 tests across 7 files** (+23 tests, +3 files).
- New coverage:
  - `trust-engine.ts` homeowner path (previously only free path)
  - `schemas.ts` (new; HomeownerStandardSchema + HomeownerPlusSchema validated end-to-end)
  - `resolver.ts` `detectInputType()` full precedence matrix + `resolveContractor()` happy/sad paths
  - `/api/trust/resolve` endpoint — NOT yet test-covered (only unit-level resolver). Follow-up.
  - `/api/trust` entitlement 402 path for standard + plus.

### Status
Ready for user review. Not proceeding to Agent 3 — waiting for approval as instructed.

---

## 2026-04-17 — Pre-Agent-3 blocker clearance

### Blocker 1 — MASTER_BLUEPRINT.md materialized
- New file: `docs/MASTER_BLUEPRINT.md`.
- No original `earthmove_master_blueprint.md` existed in repo or paste-cache (confirmed by `find` + `grep` over `/home/earthmove`).
- Content built from: user's inline BLOCKER 1 spec + prior build commands + live source files + Agents 1/2 hand-off entries.
- Three sections:
  - **Section 10** — B2B trust engine (Free / Pro / Enterprise; scorecard; legacy-enum reasoning).
  - **Section 10B** — Homeowner Groundcheck (mission; 4 paid tiers with exact prices; bundles including Get-3-Bids; Pre-Hire Watch; Verified Contractor subscription; 100-point scorecard; 4 badges with exact criteria; 5 score-tier bands; research budgets; access duration noted as 30-day spec vs 90-day current; privacy commitment; six non-negotiable legal guardrails including CA/NY/IL/WA criminal-record suppression; FCRA non-applicability reasoning).
  - **Section 11** — Inferred Decisions Log (8 entries with statuses: CONFIRMED / CHANGED / FLAGGED FOR REVIEW).

### Cascaded spec changes into prompts
Items #1 (badge criteria) and #2 (score bands) moved from FLAGGED → CHANGED. Updates applied to all four homeowner prompts:
- **Badge criteria** — Agent-2 defaults (SoS-only legitimacy / "public COI evidence" / WC-with-sole-prop-exemption / ≥4.0 over ≥10 reviews) replaced with spec (active SoS + 2+ years in operation / COI in last 12 months OR state board / WC DB hit OR state board / ≥20 reviews AND ≥4.3 avg across ≥2 platforms).
- **Score bands** — Use-Caution floor moved from **35 → 40**, Not-Recommended ceiling from **34 → 39**.
- **Plus / Deep Dive / Forensic** prompts previously said "same as Standard" for badges and bands without inlining the numeric cutoffs — would have left the LLM guessing since each tier runs in isolation. Now each prompt carries the full criteria + bands verbatim.
- **CA/NY/IL/WA criminal-record suppression** added as an explicit NEVER-DO to Deep Dive and Forensic prompts. Civil, bankruptcy, and federal records unaffected.

### Blocker 2 — install_dashboard.sh neutralized (option a)
- Git history: committed 2026-04-16 (1 day old). User's 6-month rule means option (a), not (b).
- External references: none (checked README, `.github/`, `package.json`, repo-wide grep). Only internal references were my own BUILD_LOG flags and the JSDoc landmine warning in trust-engine.ts.
- **All 13 heredocs** in the script encoded obsolete versions of files that Agents 1 and 2 rebuilt. Not just the trust-engine one. Neutralizing only the flagged heredocs (as the blocker narrowly implied) would have left the rest of the landmine intact.
- Rewrote the file as a short deprecation stub (~50 lines, down from 1457):
  - Explains why it was neutralized (Agents 1 + 2 shipped the canonical versions).
  - Enumerates the 12 files that would have been clobbered.
  - Prints a banner and `exit 2` if executed.
  - Preserves the recovery path (`git show f99966f:install_dashboard.sh`).
- JSDoc landmine warning in `src/lib/trust/trust-engine.ts` updated to a historical note (no longer actionable).
- Existing Open Item #1 ("install_dashboard.sh heredoc landmine") is now RESOLVED.

### Tests re-run after prompt cascades
- `npx vitest run src/lib/trust src/app/api/trust` → **29/29 pass**. No regressions from badge/band/suppression updates.

### Section 11 — Inferred Decisions status table

| # | Topic | Status | Action taken |
|---|---|---|---|
| 1 | Badge criteria | **CHANGED** | Spec applied to all four homeowner prompts |
| 2 | Score bands (Use-Caution 35→40, Not-Recommended 34→39) | **CHANGED** | Spec applied to all four homeowner prompts |
| 3 | Scorecard penalty deltas (CMRA −8, domain-mismatch −5, principal-overlap −5, shell-game cap at 29, etc.) | **FLAGGED FOR REVIEW** | No change |
| 4 | Deep Dive Phase 3 integration list (PACER, Lexis, state court portals) | **CONFIRMED (scope)** / **FLAGGED (list)** | No change |
| 5 | Forensic Phase 4 integration list (PACER, Lexis, FMCSA deep, SoS bulk, D&B, TLO, Westlaw, PDF service) | **CONFIRMED (scope)** / **FLAGGED (list)** | No change |
| 6 | Report access window (90d code vs 30d spec) | **FLAGGED FOR REVIEW** | No change — awaits Juan's resolution |
| 7 | Per-tier cache TTLs (tentative: standard 30d / plus 14d / deep_dive 14d / forensic 7d) | **FLAGGED FOR REVIEW** | No change |
| 8 | `trust_credits_ledger.idempotency_key` column | **FLAGGED FOR REVIEW** | No change — deferred to Agent 3 |

### What needs Juan's decision before Agent 3 runs
Six FLAGGED items above. The most consequential:
- **#6 — access window.** Spec says 30 days; code writes 90 days. Recommend fixing to 30d before Agent 3.
- **#3 — scorecard penalty deltas.** A dozen ≈values embedded in Plus/DeepDive/Forensic prompts. If left as-is they'll drive real production scoring — worth a review pass.
- **#7 — per-tier cache TTLs.** Low-risk to accept the tentative values.

Items #4, #5, #8 can be punted to Agents 3/4 without blocking.

### Status
Blocker 1 cleared. Blocker 2 cleared. Awaiting Juan's review of the six FLAGGED decisions before Agent 3 runs.

---

## 2026-04-17 — Six flagged items resolved (pre-Agent-3)

### Item #6 — Access window 30d (was 90d)
- `src/app/api/trust/route.ts` — the paid-homeowner `trust_report_access.expires_at` constant flipped from `90 * 86_400_000` to `30 * 86_400_000`.
- Code comment added above the INSERT explaining: existing 90-day rows remain valid until their original expiry; only new writes use 30 days. No data migration required (forward-only behavior change).

### Item #3 — Penalty matrix documented (not changed)
- New subsection **"Homeowner Scorecard — Penalty Matrix"** added to `docs/MASTER_BLUEPRINT.md` Section 10B.
- 12 triggers extracted from the Plus, Deep Dive, and Forensic prompts and listed with trigger → delta → target field → side effect → tier.
- All prompt values unchanged (per instruction — document, don't modify).
- Values pasted in chat for user review.

### Item #7 — Per-tier cache TTLs applied
- Migration **022_trust_cache_tier_ttls.sql** created and applied via MCP. `set_cached_trust_report` RPC updated.
- TTLs now: free/pro/enterprise 24h, standard 30d, plus 14d, deep_dive 14d, forensic 7d.
- Verified by invoking the RPC for each tier inside a `BEGIN; ... ROLLBACK;` block:

| tier | seconds_remaining | expected |
|---|---|---|
| free | 86400 | 24h |
| pro | 86400 | 24h |
| enterprise | 86400 | 24h |
| standard | 2592000 | 30d |
| plus | 1209600 | 14d |
| deep_dive | 1209600 | 14d |
| forensic | 604800 | 7d |

All seven match to the second. Transaction rolled back — zero production rows affected.

### Item #8 — idempotency_key column added
- Migration **023_trust_credits_idempotency.sql** created and applied via MCP. `trust_credits_ledger.idempotency_key TEXT` + partial unique index `trust_credits_ledger_idempotency_uniq` WHERE idempotency_key IS NOT NULL.
- Verified: first insert with key `__m023_test_idemkey__` succeeded (row id `50bbd9c4-088a-4163-be58-004ec1490269`); second insert with same key returned `ERROR: 23505 duplicate key value violates unique constraint "trust_credits_ledger_idempotency_uniq"`. Test row deleted; zero production rows left behind.

### Items #4 and #5 — Phase 3 / Phase 4 placeholder headers
- Prominent banner JSDoc headers added to `src/lib/trust/prompts/homeowner-deep-dive.ts` and `src/lib/trust/prompts/homeowner-forensic.ts`.
- Each banner enumerates the paid integrations that are NOT yet wired and states: **"DO NOT SELL THIS TIER TO CUSTOMERS until Phase 3 (resp. Phase 4) ships."**
- Integration lists themselves remain deferred to Phase 3/4 spec sessions (FLAGGED in Section 11 of blueprint — status unchanged at this stage).

### Verification
- `npx vitest run` → **58/58 pass** across 7 test files. No regressions.
- `npx tsc --noEmit` → clean (the pre-existing `dispatch/backhaul/route.ts:78` error persists; out of scope).
- Migrations 022 and 023 both confirmed applied on production Supabase (`gaawvpzzmotimblyesfp`).
- `docs/MASTER_BLUEPRINT.md` committed locally (see hash below).

### Surprises
- None material. The 022 RPC update ran cleanly via `CREATE OR REPLACE FUNCTION`. The 023 verification needed a real `auth.users` row for the FK — two users exist (4 days post-launch), so no synthetic-user gymnastics required.
- The "cap at 34" (felony) and "cap at 49" (license suspension) from the prompts remain consistent with the updated score bands (not_recommended 0-39, use_caution 40-54). No cascade needed.

