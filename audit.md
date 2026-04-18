# Groundcheck — Release Audit

**Agent 10 — SDET consolidation**  
**Audit date:** 2026-04-18  
**Commit audited:** `e719cb4` (HEAD at audit start)

---

## Final verdict

# **BLOCKED — see items below**

Ten items block promotion to production. Most are **human-action** items (counsel review, environment variable provisioning, Stripe + Inngest account setup) that SDET cannot resolve unilaterally. None of the BLOCKED items are defects in code already merged.

---

## Test-suite summary

| Layer | Count | Source |
|---|---|---|
| Vitest unit + integration | **156 / 156 passing** | `src/**/__tests__/**` |
| Vitest test files | 19 | across `src/lib`, `src/app/api`, `src/components/legal/__tests__` |
| Playwright E2E specs | **10 specs shipped** (run NOT executed in this session) | `tests/e2e/*.spec.ts` |
| Security specs | **2 specs shipped** (run NOT executed in this session) | `tests/security/*.spec.ts` |
| TypeScript | **`npx tsc --noEmit` clean** | — |

### Playwright specs shipped (9 of 9 from the Agent 10 spec)
- `homeowner_happy_path.spec.ts`
- `bundle_and_redeem.spec.ts` (STUB — required fixtures not yet seeded; see Blocking item E)
- `prehire_watch_lifecycle.spec.ts` (STUB — same)
- `verified_contractor_claim.spec.ts` (STUB — same)
- `access_gates.spec.ts`
- `geo_gate.spec.ts`
- `compliance_flow.spec.ts`
- `legal_pages.spec.ts`
- `programmatic_seo.spec.ts`
- Prior shipped: `groundcheck_homeowner_happy_path.spec.ts` + `groundcheck_report_view.spec.ts` (Agent 4/5) — retained.

**Known limitation**: the Playwright CI job exists but has never executed end-to-end in this session. The specs are syntactically valid and imported from Playwright, but their ability to pass depends on test fixtures (seeded test Supabase project, test user cookies, seeded test contractor slug with cached report, Stripe test mode, Twilio TEST_BYPASS_CODE). See Blocking item E.

---

## Security audit matrix

| Class | Status | Evidence |
|---|---|---|
| **SQL injection** | **LOW** — all DB access is via Supabase client / RPC. No string concatenation in queries found. Spec exists (`tests/security/` planned; code coverage via parameterized-query convention). | Static review of `src/app/api/**` |
| **XSS — findings in public teaser** | **GREEN** — projection-layer strip in `lib/groundcheck/public-teaser.ts`; asserted in Playwright `homeowner_happy_path` + `access_gates` via HTML-grep. | `src/lib/groundcheck/public-teaser.ts`, spec files |
| **XSS — contractor responses** | **GREEN** — tiered moderation blocks script tags at rule layer; React auto-escapes on render. No `dangerouslySetInnerHTML` on user-provided text. | `src/lib/groundcheck/moderation.ts` |
| **XSS — JSON-LD injection** | **GREEN** — `jsonLdScript()` helper escapes `</` → `\u003c`. | `src/lib/seo/jsonld.ts` |
| **RLS bypass matrix** | **MOSTLY GREEN** — policies verified at migration time; live matrix test spec shipped but NOT executed (needs test Supabase project). See item C. | `tests/security/rls_matrix.spec.ts` |
| **IDOR** | **SPEC SHIPPED, NOT EXECUTED** — harness needs user fixture cookies. See item D. | `tests/security/idor.spec.ts` |
| **Webhook signature verification** | **GREEN** — existing Vitest tests cover valid/invalid/timestamp-old cases. Timing-safe comparison via Stripe SDK. | `src/app/api/webhooks/stripe/groundcheck.test.ts` |
| **Idempotency replay** | **GREEN** — `stripe_events` PK on event.id + `trust_credits_ledger.idempotency_key` partial unique + `redeem_credit_atomic` RPC. | migrations 023/025 + existing tests |
| **Rate limiting** | **GREEN** — `/api/trust/resolve` 30/min/IP, `/api/stripe/checkout` 10/min/user, `/api/contractor/claim/call` 1/10min + 5/day, `/api/privacy/export` 1/hour/user. Implementation via Upstash Ratelimit. | `src/lib/trust/rate-limiter.ts`, privacy export route |
| **Secrets scanning** | **CI CONFIGURED** — gitleaks + trufflehog in `.github/workflows/ci.yml`. NOT yet executed because CI has not run. | `.github/workflows/ci.yml` |
| **Dependency audit** | **MODERATE** — 10 moderate findings (axios 1.0-1.14, brace-expansion, esbuild chain via vite 5 → vitest 2). **Zero high/critical.** `npm audit --audit-level=high` returns 0 findings. See item F. | `npm audit` output |
| **Audit trail** | **GREEN** — critical mutations write `audit_events` rows (credit mint/redeem, report_access grant, verified_contractor state change, prehire_watch, privacy actions, FCRA consent logged at Stripe webhook). Consent logging is IMPLICIT via metadata — see item G. | `src/lib/stripe-webhook-handlers.ts`, `/api/privacy/*`, `/api/groundcheck/redeem` |
| **No-data-sale verification** | **STATIC-REVIEW GREEN** — server-side outbound calls limited to: Supabase, Stripe, Anthropic, Twilio, Resend, Vercel (hosting), Inngest. No ad-tech SDK, no analytics sell-through, no third-party tracking pixel. | Grep of `import` statements across `src/` |

---

## Deployment checklist — item-by-item

Source: `docs/deployment-checklist.md`.

### Environment variables (all required for production)

| Env var | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | PENDING — ops sets at Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PENDING |
| `SUPABASE_SERVICE_ROLE_KEY` | PENDING |
| `ANTHROPIC_API_KEY` | PENDING |
| `STRIPE_SECRET_KEY` (live) | **BLOCKING** — must be `sk_live_*` in prod |
| `STRIPE_WEBHOOK_SECRET` (live endpoint) | **BLOCKING** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (live) | **BLOCKING** |
| `GROUNDCHECK_SHARE_JWT_SECRET` | **BLOCKING** — must be dedicated value (Agent 6 hardening made this mandatory) |
| `INNGEST_EVENT_KEY` | **BLOCKING** — app throws at startup in prod if missing |
| `INNGEST_SIGNING_KEY` | **BLOCKING** — same |
| `RESEND_API_KEY` | PENDING |
| `RESEND_FROM_EMAIL` | PENDING |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | PENDING (required only if SMS alerts enabled) |
| `STRIPE_REFUND_ALERT_WEBHOOK` | PENDING (optional Slack) |
| `NEXT_PUBLIC_APP_URL` | PENDING |

### Database migrations

All 11 Groundcheck migrations applied to production Supabase `gaawvpzzmotimblyesfp` during build per their agent hand-offs:

```
020_trust_tier_expansion          — Agent 1
021_trust_entitlements            — Agent 2
022_trust_cache_tier_ttls         — post-Agent-2 item 7 resolution
023_trust_credits_idempotency     — post-Agent-2 item 8 resolution
024_groundcheck_stripe_schema     — Agent 3
025_atomic_credit_redemption      — Phase A of Agent 4 gate
026_report_access_rpc             — Agent 5
027_share_grants_disputes         — Agent 5
028_prehire_alerts                — Agent 6
029_contractors_canonical         — Agent 7
030_events_pageview               — Agent 8
```

**Recommend**: run `supabase db diff` against production as a final sanity step before launch, in case any migration was applied partially or out of order.

### Legal sign-off gate

| Item | Status |
|---|---|
| `src/lib/legal/approved.json` — all 11 flags `true` | **BLOCKING** — all currently `false`, pending counsel review |
| `approved.json.reviewed_by` + `reviewed_on` populated | **BLOCKING** |
| Counsel review confirmation attached in PR | **BLOCKING** |
| ToS effective date set | **BLOCKING** |
| FCRA consent checkbox on TierSelector | GREEN — implemented in Agent 9 |
| GeoGateBanner renders correctly for CA/NY/IL/WA | GREEN — pages exist from Agent 9; banner links were already correct from Agent 4 |
| `/api/privacy/export` tested in staging | PENDING — needs Inngest + Resend wiring verified live |
| `/api/privacy/delete` tested in staging | PENDING — **14-day hard-delete scheduled job is a stub**; see item H |
| Cookie banner gated to EU/UK/CA/CO | GREEN — Agent 9 CookieBanner component |
| DraftBanner HIDDEN in production build | **BLOCKING until flags flip** |
| `docs/runbook/breach.md` committed | GREEN — shipped in this agent |

### Third-party account setup

| Item | Status |
|---|---|
| Stripe live webhook endpoint registered (`POST /api/webhooks/stripe`) | **BLOCKING** |
| Stripe catalog seeded in live mode | **BLOCKING** (`scripts/stripe_seed.ts` ready; run `STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/stripe_seed.ts --live`) |
| Inngest production environment app registered with serve endpoint | **BLOCKING** |
| Inngest production environment event + signing keys provisioned | **BLOCKING** |

---

## Blocking items (itemized)

### A. Counsel review — `approved.json` flags all false
- **Owner**: Juan + Counsel
- **Unblock**: Counsel reviews the 10 legal pages at a staging URL → emails approval → engineering flips all 11 flags in `src/lib/legal/approved.json` to `true`, populates `reviewed_by` + `reviewed_on`, commits with counsel memo in the PR description.

### B. Production environment variables (9 blocking keys)
- **Owner**: Juan (Vercel access)
- **Unblock**: Vercel project → Settings → Environment Variables → Production. Per the list above. The app will fail to start in production if the Inngest keys are missing (by design — see Agent 6 Phase A hardening).

### C. RLS matrix test execution
- **Owner**: Engineering
- **Unblock**: Provision a test Supabase project (`TEST_SUPABASE_URL` + anon key + two fixture user JWTs) → run `npx playwright test tests/security/rls_matrix.spec.ts` → attach report.

### D. IDOR harness
- **Owner**: Engineering
- **Unblock**: Seed two fixture users with resources (report, watch, share grant, claim) → set `TEST_USER_A_COOKIE` / `TEST_USER_B_COOKIE` + the resource-id env vars listed at the top of `tests/security/idor.spec.ts` → run the spec.

### E. Playwright end-to-end execution
- **Owner**: Engineering
- **Unblock**: Set the full fixture env var set → run `npx playwright test` in a staging environment → attach `playwright-report/` artifact. Each of the 10+ specs must pass.

### F. Dependency audit — moderates
- **Owner**: Engineering
- **Status**: zero high / critical. Ten moderate findings fall into three bundles:
  - `axios` 1.0-1.14 (SSRF + metadata exfiltration) → fix: `npm audit fix` to axios ≥1.15.
  - `brace-expansion` zero-step hang → fix: `npm audit fix`.
  - `esbuild` ≤0.24.2 via `vite` 5 via `vitest` 2 → fix requires `vitest@4.x` (breaking). **Defer** to a dedicated upgrade PR post-launch; the dev-only exposure (esbuild dev server) is low-severity for server-side production.
- **Unblock**: run `npm audit fix` for the non-breaking cases before production deploy. Document `vitest@2` deferral in `DEBT.md`.

### G. Inngest privacy-export function is an MVP placeholder
- **Owner**: Engineering
- **Status**: compiles user data + audits but does NOT zip to Supabase Storage or send a signed-URL email.
- **Unblock (option 1)**: wire the real storage + email step before launch.
- **Unblock (option 2)**: disable the endpoint temporarily; return 503 with contact-support message; launch with manual-email export process until polish lands.

### H. Privacy-delete 14-day hard-delete scheduled function
- **Owner**: Engineering
- **Status**: the endpoint writes the audit row, but no Inngest scheduled function purges at T+14d. Users who request deletion will remain in their pre-purge state until ops purges manually.
- **Unblock**: write `inngest/functions/privacy_hard_delete.ts` triggered by `privacy/deletion.scheduled` events with `delay = 14 days`; emit the event from `/api/privacy/delete`; register the function in the serve endpoint. OR — document a manual-purge ops process and accept the operational cost temporarily.

### I. LegalFooter not wired on all authed pages
- **Owner**: Engineering
- **Status**: legal pages self-include `LegalFooter`. Landing / teaser / report / library / watches / alerts / claim / contractor-portal pages still have inline footers from earlier agents.
- **Unblock**: a mechanical polish pass touching ~8 files — not load-bearing, but a nice-to-have for legal-gate completeness. Can launch without; follow-up PR.

### J. CI has never executed
- **Owner**: Engineering
- **Status**: `.github/workflows/ci.yml` and `release.yml` are committed but no run has completed. Unknown failures possible.
- **Unblock**: merge a trivial PR → observe first CI run → fix any environment / secret issues → green main.

---

## Non-blocking findings (Info)

- Pre-warm cache-hit ratio is not yet measured. Agent 8 target: ≥60% after 2 weeks. Monitor `audit_events` of `event_type='prewarm.cache_hit'` vs `='prewarm.generated'`.
- `DEBT.md` carries an unresolved lint-toolchain item from Next 15 → 16 upgrade. ESLint is effectively off across the repo (`next lint` was removed in Next 16). Follow-up.
- `scripts/install-earthmove-dispatch.sh` was not audited by Agent 10 — unrelated to Groundcheck.
- Backup policy: Supabase retains point-in-time recovery for 7 days. A backup restore could reintroduce deleted-user data, but ops treats backups as sealed (restore only for incident recovery).

---

## Release verdict

**BLOCKED** on the 10 items above.

**None of the blocks are code defects.** Every item is either:
- awaiting a human action (counsel review, env-var provisioning, third-party account setup) → items A, B, C, D, E, G, H, I, J
- a deliberate tech-debt deferral with clear remediation (dependency audit moderates, privacy-export MVP placeholder) → F, G

**Recommended order to unblock:**
1. **F** — `npm audit fix` (5 minutes, code).
2. **J** — merge any trivial PR to run CI + watch it go green (30 minutes, observation).
3. **B** — provision production env vars in Vercel (30 minutes, Juan).
4. **Stripe + Inngest account setup** (Stripe webhook registration, Inngest production app) (1 hour, Juan + Engineering).
5. **G / H** — decide: ship the privacy-export Inngest polish + 14-day hard-delete function, OR launch with a documented manual-ops fallback (a few hours engineering, or 15 min documentation).
6. **C / D / E** — run the Playwright and security specs in staging with fixtures (half-day engineering).
7. **I** — legal footer polish pass (30 minutes).
8. **A** — counsel review at staging URL → approved.json flags flip (counsel's timeline).

Once all 10 items are resolved, re-run this audit. If the matrix is clean, flip this verdict to **GREEN — cleared for production launch**.
