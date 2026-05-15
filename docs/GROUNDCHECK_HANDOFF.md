# Ground Check / Trust Report — Full Wiring Handoff

Paste-able context for a new Claude conversation. Snapshot as of **2026-05-14**.

Supabase project: **`gaawvpzzmotimblyesfp`** (EarthMove backend).
Vercel projects: **`aggregatemarket`** (has the custom domain `earthmove.io`) + sibling **`project-fv1ww`** (deploys in parallel on every main push; no domain).

---

## 1. Data sources — every input the report pulls from

All sources are rows in `trust_source_registry`. Categories below mirror `source_category`. **Weight** = `confidence_weight`. **Cost** = cents per call. **Tiers** = `applicable_tiers` (subset of: free / standard / plus / deep_dive / forensic). `[]` = registered but **gated off** all tiers until a wrapper or fix lands.

### Federal / multi-state — REST APIs, no state restriction

| source_key | display_name | access | weight | cost¢ | tiers | notes |
|---|---|---|---|---|---|---|
| `sec_edgar` | SEC EDGAR full-text filings | rest_api | 0.98 | 0 | free, standard, plus, deep_dive, forensic | Free, no auth. Hit = publicly traded. Wrapped by `sec-edgar-strict` (strict-name match). |
| `usaspending` | USASpending.gov federal award search | rest_api | 0.95 | 0 | free, standard, plus, deep_dive, forensic | Every federal contract since 2000. POST API. Count from `results.length`, NOT `page_metadata.total`. |
| `sam_gov_exclusions` | SAM.gov federal exclusion list | rest_api | 0.95 | 0 | standard, plus, deep_dive, forensic | Throttled to 6/min via PR #13. |
| `courtlistener_fed` | CourtListener fed + state dockets | rest_api | 0.85 | 0 | standard, plus, deep_dive, forensic | Free Law Project. `Token` header auth. |
| `osha_est_search` | OSHA establishment inspections (DOL JSON API) | rest_api | 0.92 | 0 | free, standard, plus, deep_dive, forensic | DOL v4 JSON API. Wrapped by `osha-strict`. |
| `fmcsa_safer` | FMCSA SAFER USDOT carrier safety | rest_api | 0.90 | 0 | standard, plus, deep_dive, forensic | QCMobile public API. Header webkey. Use `/qc/services/carriers/...`, NEVER `_links` paths (PR #47 reverted that). |
| `google_reviews` | Google Reviews via Places API (New) v1 | rest_api | 0.50 | 0 | free, standard, plus, deep_dive, forensic | textSearch endpoint. Env key `GOOGLE_MAPS_API_KEY`. No `includedType`. |

### Open-web LLM sweep

| source_key | display_name | access | weight | cost¢ | tiers | notes |
|---|---|---|---|---|---|---|
| `perplexity_sweep` | Perplexity open-web sweep | rest_api | 0.60 | 50 | forensic, deep_dive | Sonar/Sonar-Pro. Discovery layer with citations. |
| `llm_web_search` | Claude `web_search` verification | llm_search | 0.30 | 100 | **[]** | Verification half of the dual-engine layer. Currently OFF. |

### State business entity (SOS)

| source_key | display_name | access | weight | cost¢ | tiers | notes |
|---|---|---|---|---|---|---|
| `cobalt_intelligence` | **Cobalt universal SOS API (all 50 states)** | rest_api | 0.92 | 150 | standard, plus, deep_dive, forensic | Paid, ~$1.50/call, rate-limit 10/min. Demotes per-state SOS scrapers to fallback. Client at `src/lib/trust/sources/cobalt.ts`. |
| `co_sos_biz` | Colorado SOS business search | rest_api | 0.90 | 0 | standard, plus, deep_dive, forensic | CO Socrata. Field `entitystatus` = "Good Standing"/"Delinquent". |
| `tx_sos_biz` | Texas SOS business search | rest_api | 0.85 | 0 | standard, plus, deep_dive, forensic | TX Socrata "Active Franchise Tax Permit Holders". Wrapped by `tx-sos-biz-strict` (RTB precedence). |
| `co_assessor` | CO county assessor property classification | rest_api | 0.80 | 0 | **[]** | Multi-county. Classifies registered address residential vs commercial. |
| `tx_assessor` | TX county assessors DCAD/TAD/HCAD/TCAD | rest_api | 0.80 | 0 | free, standard, plus, deep_dive, forensic | DCAD WebForms VIEWSTATE round-trip (scope to `<table id="SearchResults1_dgResults">`). Cookie parse via `getSetCookie()`. |
| `ca_sos_biz` | California SOS | html_scrape | 0.90 | 0 | **[]** | Live in registry; gated off tiers. |
| `fl_sunbiz` | Florida SunBiz | html_scrape | 0.90 | 0 | **[]** | Cloudflare-blocked (commit b4456e2 reverted scraper). |
| `ga_sos_biz` | Georgia SOS corporations | html_scrape | 0.90 | 0 | **[]** | Cloudflare-blocked. |
| `nc_sos_biz` | NC SOS | html_scrape | 0.90 | 0 | **[]** | Cloudflare-blocked. |
| `ny_sos_biz` | NY DOS business entity | html_scrape | 0.90 | 0 | **[]** | Captcha-blocked. |
| `or_sos_biz` | Oregon CBR | html_scrape | 0.90 | 0 | **[]** | F5 BIG-IP blocked. |
| `wa_sos_biz` | Washington CCFS | html_scrape | 0.90 | 0 | **[]** | Captcha-blocked. |
| `az_ecorp` | AZ Corporation Commission eCorp | html_scrape | 0.90 | 0 | **[]** | Live in registry; gated. |
| `opencorporates` | OpenCorporates (deactivated) | rest_api | 0.85 | 0 | **[]** | `is_active=false`. Replaced by direct SoS + Cobalt. |

### State / municipal license

| source_key | display_name | access | weight | cost¢ | tiers | notes |
|---|---|---|---|---|---|---|
| `co_dora` | CO DORA professional licenses | rest_api | 0.95 | 0 | standard, plus, deep_dive, forensic | Socrata 7s5z-vewr. |
| `denver_cpd` | Denver CPD licensing | html_scrape | 0.85 | 0 | standard, plus, deep_dive, forensic | Municipal supervisor certs (CO has no state GC license). |
| `tx_tdlr` | TX TDLR active licenses | rest_api | 0.90 | 0 | standard, plus, deep_dive, forensic | Socrata 7358-krk7. |
| `tdlr_disciplinary` | TX TDLR disciplinary actions | rest_api | 0.85 | 0 | standard, plus, deep_dive, forensic | Google Custom Search over tdlr.texas.gov cimsfo/fosearch.asp. |
| `ccb_or` | Oregon CCB with disciplinary history | html_scrape | 0.95 | 0 | **[]** | Captcha-blocked (catalog memory). |
| `cslb_ca` | California CSLB | html_scrape | 0.95 | 0 | **[]** | Authoritative for CA GC. |
| `dbpr_fl` | FL DBPR construction license | html_scrape | 0.95 | 0 | **[]** | |
| `lni_wa` | WA L&I contractor registration | html_scrape | 0.95 | 0 | **[]** | Bond/insurance status. |
| `nclbgc_nc` | NC LBGC | html_scrape | 0.95 | 0 | **[]** | Required for jobs >$30k. |
| `roc_az` | AZ Registrar of Contractors | html_scrape | 0.95 | 0 | **[]** | |

### State insurance

| source_key | display_name | access | weight | cost¢ | tiers | notes |
|---|---|---|---|---|---|---|
| `tx_wc_verify` | **TX WC coverage verification (TDI/DWC Socrata)** | rest_api | 0.95 | 0 | standard, plus, deep_dive, forensic | **Only scraper emitting `insurance_*` finding types.** Dual dataset: subscriber `c4xz-httr` (positive coverage), non-subscriber `azae-8krr` (opt-out). Column on non-sub is `company_name` NOT `employer_name`. Use literal `%` (encodeURIComponent does the escape). |

### Court / regulatory state

| source_key | display_name | access | weight | cost¢ | tiers | notes |
|---|---|---|---|---|---|---|
| `state_ag_enforcement` | CO+TX AG consumer protection | html_scrape | 0.88 | 0 | standard, plus, deep_dive, forensic | CO AG WordPress `?s=` + TX AG Drupal. |
| `co_county_recorder_liens` | CO county mechanic's liens | html_scrape | 0.90 | 0 | **[]** | Denver+Adams+Arapahoe+Jefferson+Boulder. Liens AGAINST contractor. |
| `tx_county_recorder_liens` | TX county mechanic's liens | html_scrape | 0.90 | 0 | forensic | Dallas+Tarrant+Collin+Harris+Travis. TX Prop Code Ch. 53. |

### Municipal permits

| source_key | display_name | access | weight | cost¢ | tiers | notes |
|---|---|---|---|---|---|---|
| `austin_open_data` | Austin issued construction permits | rest_api | 0.85 | 0 | standard, plus, deep_dive, forensic | Socrata. Filter `applicant_full_name` or `contractor_company_name`. |
| `dallas_open_data` | Dallas building permits | rest_api | 0.75 | 0 | standard, plus, deep_dive, forensic | Socrata. `contractor` is name+address blob — needs extraction. |
| `denver_pim` | Denver building permits | rest_api | 0.70 | 0 | standard, plus, deep_dive, forensic | ArcGIS Hub. Residential + Commercial. |
| `phoenix_open_data` | Phoenix building permits | rest_api | 0.85 | 0 | standard, plus, deep_dive, forensic | CKAN. `resource_id` rotates yearly — verify in metadata. |

### Review / BBB

| source_key | display_name | access | weight | cost¢ | tiers | notes |
|---|---|---|---|---|---|---|
| `bbb_link_check` | BBB profile link-out | rest_api | 0.30 | 0 | free, standard, plus, deep_dive, forensic | ToS-clean deep-link only (no scrape). |
| `bbb_profile` | BBB full profile (complaints, rating) | html_scrape | 0.60 | 0 | **[]** | `is_active=false`. Disabled. |

### System / internal

| source_key | display_name | access | weight | cost¢ | tiers | notes |
|---|---|---|---|---|---|---|
| `system_internal` | Groundcheck internal inference | rest_api | 1.00 | 0 | free, standard, plus, deep_dive, forensic | Orchestrator-emitted name-discrepancy observations. |
| `mock_source` | Tranche A orchestration fixture | llm_search | 0.00 | 0 | **[]** | Test fixture only, `is_active=false`. |

**Counts:** 39 rows registered total — 36 active, 3 inactive (`bbb_profile`, `llm_web_search`, `mock_source`, `opencorporates`). Of the active set, roughly half are gated off tiers (the captcha-blocked HTML SoS + license scrapers) and live in registry as placeholders.

---

## 2. Wiring — request → trust report

### High-level pipeline

```
[Client] → POST /api/trust/run (or wizard)
        → upsert/create trust_jobs row
        → enqueue_trust_job RPC (sets state=queued)
        → INNGEST send: 'trust/job.requested.v2'
                ↓
[Inngest cloud] → POST /api/inngest (HMAC-signed)
        → runTrustJobV2  (concurrency=5)
                ↓
        orchestrator-v2.runTrustJobV2(jobId)
                ↓
        For each source_key in applicable_tiers:
              registry.ts dispatch(source_key)
                ↓
              scraper(input) → ScraperEvidence | ScraperEvidence[]
                ↓
              wrappers/<name>.ts post-process (strict-name, RTB precedence)
                ↓
              persist-evidence.ts → INSERT trust_evidence
                ↓
        score_and_finalize_trust_report(jobId)
                ↓
        mig 237 trigger: enforce band + summary + quorum on trust_reports INSERT
                ↓
        trust_reports row (PUBLISHED state)
```

### Key files

- **`src/app/api/inngest/route.ts`** — `serve()` wiring. Two-file Inngest pattern.
- **`src/lib/trust/inngest-functions.ts`** — function definitions. `runTrustJobV2` is the orchestrator entry. `inngest.createFunction(opts, triggers, handler)` — 2-arg shape with triggers inside opts.
- **`src/lib/inngest.ts`** — singleton client. **Import from here**, NOT `@/inngest/client`.
- **`src/lib/trust/orchestrator-v2.ts`** — load applicable sources from registry filtered by tier → dispatch → persist → score.
- **`src/lib/trust/scrapers/registry.ts`** — switch on `source_key` → returns `ScraperResult`. Wrapper composition lives here (cases `sec_edgar`, `tx_sos_biz`, `osha_est_search`).
- **`src/lib/trust/scrapers/persist-evidence.ts`** — `trust_evidence` INSERT (sha256, snippet, duration, cost).
- **`src/lib/trust/score_and_finalize.ts`** (or RPC) — computes score bands, attaches summaries, emits flags.

### Scraper contract (every scraper conforms)

```ts
// src/lib/trust/scrapers/types.ts
type TrustFindingType =      // mirrors DB CHECK from mig 201 + extensions
  | 'business_active' | 'business_inactive'
  | 'license_active' | 'license_suspended' | 'license_revoked'
  | 'insurance_active_wc' | 'insurance_lapsed' | 'insurance_no_record' | 'insurance_carrier_name'
  | 'open_web_verified' | 'open_web_unverified' | 'adverse_signal'
  | 'source_not_applicable' | 'source_error'
  | ... ;

type TrustConfidence =
  | 'verified_structured' | 'verified_attributed'
  | 'medium_inference' | 'low_inference';

interface ScraperEvidence {
  source_key: string;
  finding_type: TrustFindingType;
  confidence: TrustConfidence;
  finding_summary: string;
  extracted_facts: Record<string, unknown>;
  query_sent: string;
  response_sha256: string | null;
  response_snippet: string | null;
  duration_ms: number;
  cost_cents: number;
}
type ScraperResult = ScraperEvidence | ScraperEvidence[];
```

### Wrappers (post-processors, all live in `src/lib/trust/scrapers/wrappers/`)

1. **`sec-edgar-strict.ts`** — `enforceSecEdgarStrictMatch(contractorName, result)`. Extracts entity name via `/filings? for "([^"]+)"/i`; downgrades typed findings to `source_not_applicable` if strict-name fails. Wired in `registry.ts` case `sec_edgar`.
2. **`tx-sos-biz-strict.ts`** — `enforceTxSosBizRtbPrecedence(result)`. Parses `SOS=X RTB=Y` from summary; if RTB=A, flips `business_inactive` → `business_active`. Texas Right-To-Business presence overrides SOS gaps.
3. **`osha-strict.ts`** — `enforceOshaStrictMatch(contractorName, result)` via regex `/OSHA:[^"]*for "([^"]+)"/i`.

### Helper library

**`src/lib/trust/scrapers/lib/html-scraper-helpers.ts`** — Pattern H scaffold:
- `fetchWithCapture(url, opts)` — multi-strategy fetch + `AttemptRecord` diagnostic.
- `strictNameMatch({ query, candidate, mode: 'contains' | 'starts_with' | 'exact' })`.
- Pattern I = error-body capture on 4xx/5xx (per-call).

### Three-layer LLM cascade (template synthesizer)

When a tier needs a typed summary and no scraper supplied one, the synth runs:

1. **Primary:** Anthropic Opus 4.7 (`claude-opus-4-7`).
2. **Fallback:** Anthropic Sonnet 4.6 (`claude-sonnet-4-6`).
3. **Last resort:** deterministic template (`templated_after_stall`).

The template path was historically the source of fabricated red flags (`score.phoenix_score < 80`, `score.license_suspended`). **Commit 3c97df5** added an `evidenceBackedFlags` gate so any flag emitted by the template MUST have a backing evidence row of the matching type. Three wrappers + the gate now eliminate the false-positive class.

### Captcha-blocked sources catalog (memorized — do not waste cycles re-attempting)

- **F5 BIG-IP** — OR SOS, OR CBR
- **Akamai bobcmn** — OR CBR variants
- **Cloudflare "Just a moment"** — FL SunBiz, GA SOS, NC SOS
- **reCAPTCHA v3** — TAD (county assessor), CCB OR

Reverted via commit b4456e2. These rows live in registry with `applicable_tiers = []` as placeholders.

---

## 3. Finding-type vocabulary

`trust_finding_type_check` is a DB CHECK installed in **mig 201**, extended by **mig 237** (trust integrity v2). The TS union in `src/lib/trust/scrapers/types.ts` MUST mirror it row-for-row or `persist-evidence.ts` INSERTs will fail silently with a CHECK violation. Three rounds of rejections happened on PR #45 before all three CHECKs (`access_method`, `source_category`, `finding_type`) were aligned — see memory `reference_trust_source_registry_checks`.

---

## 4. DB tables (Supabase project `gaawvpzzmotimblyesfp`)

- **`trust_source_registry`** — config row per source_key. Mig 249/250/251 was the most recent drift resolution.
- **`trust_jobs`** — orchestration state machine. States: queued → running → completed/failed. Inngest event correlation ID lives here.
- **`trust_evidence`** — every ScraperEvidence emission, append-only. `response_sha256` + `response_snippet` for lineage.
- **`trust_reports`** — final scored output. mig 237 trigger enforces band + summary + quorum.
- **`trust_report_audit`** — append-only audit log (mig 237).
- **Anomaly/phoenix detectors** — also mig 237, run during finalize.

Use Supabase MCP `apply_migration` for DDL, `execute_sql` for queries. **Symmetric rule:** never leave .sql unapplied AND never apply without committing the .sql.

---

## 5. Commits shipped this session (most recent first)

| sha | what |
|---|---|
| `c631427` | Force redeploy — pickup rotated INNGEST_SIGNING_KEY |
| `4ceaef9` | Force redeploy — pickup ANTHROPIC_API_KEY + Inngest signing-key resync |
| `57e8133` | Cobalt Intelligence SOS client + tx_assessor DCAD/TAD recon probe |
| `05da5ce` | `tx_wc_verify` v2 Socrata dual-dataset (legacy `apps.tdi.state.tx.us` is dead) |
| `2cdb725` | TX WC verification scaffold (v1) |
| `b4456e2` | Revert 7 state SOS scrapers — captcha-blocked at endpoint |
| `f6f6ef3` | `tx_sos_biz` RTB-precedence + `osha` strict-name wrappers |
| `05fa8cd` | `sec_edgar` strict-name match wrapper |
| `987dc2d` | 7 state SOS scrapers (FL/OR/AZ/GA/NY/WA/NC) — all broken (reverted in b4456e2) |
| `3c97df5` | Gate templated fallback red flags on evidence existence |
| `74f0ffd` | `fire-trust-job` utility for canary + smoke dispatch |
| `93418a8` | Doc-sync mig 262: unlock `tx_assessor` all 5 tiers |

Earlier today (not in this `git log` window): `7e18f80` google_reviews scraper, `411dbd2` sec_edgar, `6dc4945` usaspending, `f9d795d` tx_assessor v1→v2, `7a8cd92` rename `GOOGLE_PLACES_API_KEY` → `GOOGLE_MAPS_API_KEY`, `1faaff4` outputFileTracingIncludes fix for trust PDF route, plus doc-sync migs 260/261.

---

## 6. Smoke / canary harnesses

All live in `scripts/`:

- **`fire-trust-job.ts`** — primary canary harness. Args parser, `.env.local` loader, calls `enqueue_trust_job` RPC + fires `trust/job.requested.v2`.
- **`smoke-llm-direct.ts`** — probes Sonnet/Opus/Sonar directly with explicit dotenv path.
- **`smoke-cobalt.ts`** — `pnpm tsx scripts/smoke-cobalt.ts "<name>" <state-name-or-2letter>`.
- **`smoke-sec-edgar-strict.ts`** — wrapper assertions.
- **`smoke-wrappers-tx-sos-osha.ts`** — wrapper assertions.
- **`smoke-template-no-fabrication.ts`** — evidence-backed-flags gate assertions.
- **`smoke-tx-wc-verify.ts`** — Socrata dual-dataset, verified 3/3 PASS against Austin Industries / Manhattan Construction / The Beck Group with real WC carrier data (XL Specialty).
- **`recon-dcad-tad.sh`** — endpoint probe (DCAD/TAD/HCAD/TCAD landing + ArcGIS REST roots) → `/tmp/recon-tx-assessor.log`.

---

## 7. Env vars (Vercel prod, both projects)

- `ANTHROPIC_API_KEY` (rotated today)
- `INNGEST_EVENT_KEY` (event dispatch)
- `INNGEST_SIGNING_KEY` (function POST validation — `signkey-prod-…647fef` last known)
- `GOOGLE_MAPS_API_KEY` (Places API New v1 — sensitive flag must be OFF for vercel env pull)
- `COBALT_API_KEY`
- `PERPLEXITY_API_KEY`
- `FMCSA_WEB_KEY` (header, not query)
- `TX_CPA_API_KEY` (header), `DOL_API_KEY` (query param), `COURTLISTENER_TOKEN` (Token header), `SAM_GOV_API_KEY`
- Probe scripts: `scripts/probe-*.ts`

**Vercel project mapping** (verified 2026-05-04): `earthmove.io` = `aggregatemarket` (FLIPPED from `project-fv1ww`). Both deploy in parallel on every main push, only `aggregatemarket` has the custom domain.

**Resend** is NOT configured in prod env (both projects). Every email-channel dispatch lands at `dispatch_status='failed' / failure_reason='resend_not_configured'`. Affects WatchToggle alerts.

---

## 8. Open issues / unresolved

1. **Inngest 400 dispatch errors blocking ALL canary jobs.** 5 jobs cancelled today (`34fcead4`, `957e574c`, `17d781b8`, `6d66a247`, `0aa94965`). User confirmed `signkey-prod-…647fef` matches in Vercel `aggregatemarket`. Two redeploys (4ceaef9, c631427) didn't help. **Last hypothesis: sibling `project-fv1ww` has stale signing key and Inngest cloud round-robins dispatches between projects** — needs verification + same-key paste into the sibling.
2. **Register `tx_wc_verify` + `cobalt_intelligence` source_keys formally in registry via MCP migration** (both ship in code, need tier-gate decisions in DB).
3. **Live Cobalt probe across multiple test contractors** to refine `CobaltCanonical` interface from observed response shapes (current shape inferred from one Manhattan Construction COMPANY LLC response).
4. **Verify all 4 false-positive fix commits end-to-end** (`3c97df5`, `05fa8cd`, `f6f6ef3`, templated-flag gate) via Austin Industries or Manhattan Construction canary. Blocked by #1.
5. **PR #14 trust score bimodal** — `license_score` + `age_score` live; `legal/osha/bbb` still NULL, need new scrapers before engine can publish.
6. **Free-tier SQL scorer realignment (PRs #38 + #39)** — both merged 2026-05-12, migs 235 + 236 live. Outstanding: smoke that a fresh inactive-entity report scores CRITICAL.

---

## 9. Memory entries that auto-load in a fresh session

The user's CLAUDE.md auto-memory index (`~/.claude/projects/-home-dailyevohire/memory/MEMORY.md`) surfaces all of these on every new conversation. Most-relevant for Ground Check work:

- `reference_earthmove_db` — Supabase project IDs + migration drift note (020→068d).
- `reference_earthmove_external_apis` — probe scripts + key locations.
- `reference_earthmove_vercel_projects` — `aggregatemarket` ↔ `project-fv1ww` mapping.
- `reference_earthmove_inngest_shape` — 2-arg createFunction shape, service-role pattern, PromiseLike rpc.
- `reference_inngest_constraints_earthmove` — concurrency=5, two-file pattern, event_key vs signing_key.
- `reference_fmcsa_api_paths` — canonical `/qc/services/carriers/...` path.
- `reference_trust_source_registry_checks` — 3 CHECK vocabularies that silently reject scraper INSERTs.
- `reference_captcha_blocked_trust_sources` — running catalog of blocked sources.
- `reference_usaspending_api_quirks` — `results.length` not `page_metadata.total`.
- `feedback_nextjs_runtime_fs_assets` — `outputFileTracingIncludes` for fs.readFile in route handlers.
- `feedback_scraper_hal_links_footgun` — never treat `_links` as canonical public routes.
- `project_pr40_trust_integrity_v2` — band + summary + quorum trigger lives in mig 237.
- `project_trust_bimodal_score` — current scoring state.
- `project_pr38_free_tier_scoring_realignment` — fresh-inactive should score CRITICAL.
- `project_earthmove_repo_prod_drift` — RESOLVED 2026-05-13 via migs 249/250/251.

---

## 10. Quick directory map

```
src/lib/trust/
├── inngest-functions.ts        # runTrustJobV2 + event definitions
├── orchestrator-v2.ts          # registry filter → dispatch → persist → score
├── score_and_finalize.ts       # band/summary/quorum (with mig 237 trigger)
├── sources/
│   └── cobalt.ts               # universal SOS REST client
└── scrapers/
    ├── registry.ts             # source_key → scraper switch
    ├── types.ts                # ScraperEvidence + TrustFindingType union (mirror mig 201/237)
    ├── persist-evidence.ts     # trust_evidence INSERT
    ├── lib/
    │   └── html-scraper-helpers.ts   # fetchWithCapture, strictNameMatch, AttemptRecord
    ├── wrappers/
    │   ├── sec-edgar-strict.ts
    │   ├── tx-sos-biz-strict.ts
    │   └── osha-strict.ts
    ├── state-insurance/
    │   └── tx-wc-verify.ts     # Socrata dual-dataset
    ├── google-reviews.ts
    ├── sec-edgar.ts
    ├── usaspending.ts
    ├── tx-assessor.ts          # DCAD WebForms VIEWSTATE
    ├── osha-est-search.ts
    ├── sam-gov.ts
    ├── perplexity-sweep.ts
    ├── fmcsa-safer.ts
    ├── courtlistener-fed.ts
    ├── state-ag-enforcement.ts
    ├── co-dora-discipline.ts
    ├── co-sos-biz.ts
    ├── tx-sos-biz.ts
    ├── tx-tdlr-orders.ts
    ├── tdlr-disciplinary.ts
    ├── ccb-or.ts
    ├── dallas-open-data.ts
    ├── denver-pim.ts
    ├── bbb-link-check.ts
    └── claude-web-search.ts

src/app/api/inngest/route.ts    # serve() endpoint
src/lib/inngest.ts              # singleton client — import from HERE

scripts/
├── fire-trust-job.ts
├── smoke-*.ts
├── probe-*.ts
└── recon-dcad-tad.sh

supabase/migrations/
├── 201_*.sql                   # trust_finding_type_check (vocabulary)
├── 235_*.sql + 236_*.sql       # free-tier SQL scorer realignment
├── 237_*.sql + 238_*.sql       # trust integrity v2 (band + audit + detectors)
├── 249_*.sql + 250_*.sql + 251_*.sql   # repo↔prod drift resolution
└── 260/261/262_*.sql           # doc-sync (sec_edgar/usaspending/tx_assessor tier unlocks)
```

---

Paste this entire file into the new conversation. The new session will also auto-load the memory index, which fills in cross-session context the doc doesn't repeat.
