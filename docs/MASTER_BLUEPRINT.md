# MASTER_BLUEPRINT.md — earthmove.io / Groundcheck

**Status:** Consolidated 2026-04-17 from (a) Juan's inline specs in Agent 1–Agent 2 build commands, (b) `BUILD_LOG.md` hand-off entries for Agents 1 and 2, and (c) the live source of truth in `src/lib/trust/`. No original `earthmove_master_blueprint.md` was present in the repo at the time of consolidation.

This document is authoritative for Groundcheck. Supersedes any inline spec in prior transcripts.

---

## SECTION 10 — Contractor / Supplier Trust Engine (B2B)

### Purpose
The B2B trust engine serves the earthmove.io marketplace: general contractors, haulers, and suppliers vetting one another before doing business. This is the original tier set that shipped on 2026-04-13.

### Tiers

| Tier | Price | Access | Searches | Model | Cache behavior |
|---|---|---|---|---|---|
| `free` | $0 — unlimited | Unauthenticated and authenticated | 7 | `claude-sonnet-4-6` | Cached (24h via `set_cached_trust_report` RPC) |
| `pro` | Legacy (deprecated) | Auth required | Historically 7 (same as free) | `claude-sonnet-4-6` | Cached (8h per legacy RPC CASE) |
| `enterprise` | Legacy (deprecated) | Auth required | Historically 7 (same as free) | `claude-sonnet-4-6` | **Cache bypass** — always fresh |

### B2B Scorecard (100 points)
From `src/lib/trust/prompts/b2b-free-tier.ts`:
- Business registration VERIFIED: +25
- Contractor license VERIFIED: +25
- BBB: A+/A +15, B +10, C +5, D/F −15
- Reviews: ≥4.0 +15, 3.0–4.0 +8, <3.0 −10
- Legal records: CLEAN +10, issues −15 to −25
- OSHA: CLEAN +10, −5 per serious violation

### Risk bands (b2b `risk_level` field)
- 75–100 → LOW
- 50–74 → MEDIUM
- 25–49 → HIGH
- 0–24 → CRITICAL

### Seven baseline searches
1. Secretary of State LLC registration
2. BBB rating + complaints
3. Google / Yelp contractor reviews
4. Lawsuit / lien / court judgment
5. OSHA violation / safety citation
6. Contractor license (state)
7. Complaint / fraud news (local)

### Legacy constraints — why `pro` and `enterprise` persist
- The Zod `report_tier` enum in `src/lib/trust/trust-validator.ts` retains `pro` and `enterprise` with `@deprecated` comments. They must stay because `trust_reports` rows from before the Agent-1 refactor carry those values, and removing them from the enum would fail validation when rehydrating historical reports.
- The `trust_reports.tier` CHECK constraint (migration 020) accepts all 7 values for the same reason — forward-only.
- At the route layer (`src/app/api/trust/route.ts`), incoming `pro` and `enterprise` requests are **mapped to the `free` engine path** via the `engineTier` local. The DB column still records the requested tier for analytics; cache-bypass logic still uses `tier === 'enterprise'`. Behavior is unchanged from pre-refactor.

---

## SECTION 10B — Groundcheck: Homeowner Edition

### Mission
Give homeowners a pre-hire contractor report they can trust. Written from the homeowner's perspective, built on public records, tied to specific residential-work risk signals (deposit theft, job abandonment, liability/WC coverage), and legally defensible. We verify businesses, never investigate individuals. FCRA does not apply because the subject of every report is a commercial entity, not a natural person.

### Privacy commitment
We do not sell data we collect about contractors or users. Full stop.

### Four paid tiers

| Tier | Price | Searches | Model | Purpose |
|---|---|---|---|---|
| `standard` | **$9.99** | 10 | `claude-sonnet-4-6` | "Is this contractor safe to hire?" |
| `plus` | **$24.99** | 25 | `claude-sonnet-4-6` | Adds physical-presence, liens, digital forensics, principal network |
| `deep_dive` | **$49.99** | 50 | `claude-opus-4-7` | Adds court records, regulatory history, extended principal network |
| `forensic` | **$99.99** | 80 | `claude-opus-4-7` | Adds shell-game detection, predictive risk, legal-grade PDF |

### Bundles
- 3 × Standard — **$24.99** (vs $29.97 à la carte — 17% off)
- 10 × Standard — **$79.99** (vs $99.90 — 20% off)
- 3 × Plus — **$59.99** (vs $74.97 — 20% off)
- **Get 3 Bids** — **$29.99** (3 × Standard report access + a contractor-intro flow; marketed as "vet the three estimates you already have")

### Recurring services
- **Pre-Hire Watch** — **$9.99 for 60 days**. Inngest daily sweep re-runs the report and notifies the user if red flags surface before the project starts.
- **Verified Contractor** — **$29 / month**. A contractor self-claims their listing, earns a verified badge, and appears first in search results.

### Report access duration
**30 days per access grant** (spec). *Current implementation writes 90-day windows into `trust_report_access` (Agent 2, route.ts). Discrepancy is FLAGGED in Section 11 — pending Juan's resolution.*

### Homeowner scorecard (100 points)
Per `src/lib/trust/schemas.ts` and the homeowner prompts:
- **Residential Reputation — 30 pts** — review volume, avg rating, sentiment, Nextdoor/Angi mentions
- **Liability Insurance — 25 pts** — 0 if unverifiable; 25 if COI evidence found
- **Workers Comp — 10 pts** — active WC board coverage
- **Business Legitimacy — 10 pts** — active SoS registration, not dissolved/suspended
- **Licensing — 10 pts** — active state contractor license when state requires one
- **Complaints — 10 pts** — inverse of complaint volume
- **Legal Record — 5 pts** — liens, judgments, lawsuits against contractor

### Four badges (authoritative criteria — update 2026-04-17)

| Badge | Criteria |
|---|---|
| **Legitimate Business** | Active SoS registration AND contractor has been in operation for at least **2 years** |
| **Liability Insured** | COI sighted in the last **12 months** OR state licensing board confirms active liability coverage |
| **Workers' Comp Covered** | State WC database hit OR state licensing board confirms active coverage |
| **Well-Reviewed** | ≥ **20 total reviews** AND ≥ **4.3 average rating** across ≥ **2 platforms** |

> These criteria supersede Agent 2's initial defaults (which were softer: 10 reviews, 4.0 avg, and allowed WC sole-prop exemptions). Homeowner-standard prompt and downstream tiers were updated on 2026-04-17 to match the spec above.

### Score-to-tier bands (authoritative — update 2026-04-17)

| Band | `score_tier` value | Range |
|---|---|---|
| Highly Trusted | `highly_trusted` | **85–100** |
| Trusted | `trusted` | **70–84** |
| Acceptable | `acceptable` | **55–69** |
| Use Caution | `use_caution` | **40–54** |
| Not Recommended | `not_recommended` | **0–39** |

> Updated 2026-04-17 to match spec. Agent 2 originally used 85/70/55/**35**/0 — the Use-Caution floor moved from 35 to 40, and Not-Recommended ceiling moved from 34 to 39.

### Homeowner Scorecard — Penalty Matrix

Penalty deltas are applied on top of the 100-point scorecard by the LLM at report time, per the tier prompts. Values below are the *current* ones embedded in the prompts (inferred by Agent 2 — FLAGGED item #3, pending Juan's review). When the LLM computes the final `trust_score`, it sums the base scorecard and subtracts penalties (or applies caps, as noted).

| Trigger | Delta | Target field | Side effect | Tier(s) where applied |
|---|---|---|---|---|
| Physical-presence status is **CMRA_FLAGGED** (mail-drop / UPS Store / shared suite) | **−8** (floor at 0) | `business_legitimacy` | adds to `red_flags` | Plus, Deep Dive, Forensic |
| **UCC-1 lien or state/federal tax lien** found | **−3 to −10** (LLM chooses by volume + amount) | `legal_record` | sources listed in `lien_check` | Plus, Deep Dive, Forensic |
| **Domain-age mismatch** (claimed ">10 years" but domain or Wayback first-seen <2 yrs) | **−5** | `business_legitimacy` | adds to `red_flags`; `digital_forensics.age_mismatch_flag = true` | Plus, Deep Dive, Forensic |
| **Principal overlap ≥ 3** shared-business indicators (phone/address/website/DOT) | **−5** | `business_legitimacy` | flag "entity network — investigate" | Plus, Deep Dive, Forensic |
| **Verified felony conviction within last 7 years** — narrow scope (see "Felony trigger" definition below) | **CAP `trust_score` at 34** (court-record evidenceUrl required; without URL apply **−10 to `legal_record`** instead + "unverifiable felony signal" red flag) | `trust_score` (ceiling) | forces `not_recommended`; evidenceUrl mandatory; **suppressed entirely in CA/NY/IL/WA** per legal guardrails | Deep Dive, Forensic |
| **Active license suspension or revocation** | **CAP `trust_score` at 49** | `trust_score` (ceiling) | forces `score_tier ≤ "use_caution"` | Deep Dive, Forensic |
| **Bankruptcy within 3 years** | **−10** | `legal_record` | adds to `red_flags` | Deep Dive, Forensic |
| **Chameleon-carrier pattern** (dissolved entity re-registered within 24 months; same phone/address/principals) | **−15** | `business_legitimacy` | `extended_principal_network.chameleon_carrier_flag = true` | Deep Dive, Forensic |
| **≥ 5 linked entities** via shared phone/address/website | **−10** | `business_legitimacy` | adds "entity network investigation recommended" to `red_flags` | Deep Dive, Forensic |
| **Shell-game pattern** detected (2+ criteria from shell_game_analysis) | **CAP `trust_score` at 29** | `trust_score` (ceiling) | forces `score_tier = "not_recommended"`; `shell_game_analysis.status = "PATTERN_DETECTED"` | Forensic only |
| **Predictive-risk signals ≥ 3** (fake-review removal, cash-only, storm-chaser, etc.) | **−15** | `residential_reputation` | populates `predictive_risk.signals_detected` | Forensic only |
| **Evidence not primary-source-backed** (any material claim lacks evidenceUrl) | **CAP `confidence_level` at "MEDIUM"** | `confidence_level` (ceiling) | — | Forensic only |

Consistency notes:
- All caps align with the updated score bands (`not_recommended` 0-39, `use_caution` 40-54). Cap-at-34 / cap-at-29 both land in not_recommended. Cap-at-49 lands at the top of use_caution.
- Penalty-target fields are named per the scorecard subkeys in `src/lib/trust/schemas.ts` (`HomeownerScorecardSchema`).
- Plus-tier penalties cascade into Deep Dive and Forensic prompts because those prompts explicitly include the Plus module output (and apply the same deltas).

### Trigger definitions

**Felony trigger (narrow).** The felony cap fires only when ALL of the following hold:
1. Conviction is for one of: (a) fraud, (b) theft, (c) embezzlement, (d) statutory contractor fraud, or (e) serious bodily injury caused while operating the business.
2. Date of conviction is within the last 7 years from the report date.
3. A court-record URL is available as evidence and included in the report's evidence trail.
4. The contractor's primary state of registration is NOT CA, NY, IL, or WA. In those four jurisdictions the felony trigger is **suppressed entirely** per the legal guardrails (§10B "Non-negotiable legal guardrails").

DUI alone does NOT qualify unless it matches the serious-bodily-injury path (driver was operating the business at the time AND caused bodily injury). Drug possession does NOT qualify. Misdemeanors do NOT qualify. If the court-record URL is not available, DO NOT apply the cap — apply the soft penalty (−10 to `legal_record` + "unverifiable felony signal" red flag) instead.

**Chameleon carrier pattern.** Fires when: prior entity was dissolved within 24 months AND the new entity shares **≥ 2** of: phone, address, principals, DOT number, website.

**Shell-game pattern (2+ criteria).** Fires when **2 or more** of the following are detected simultaneously:
- chameleon carrier pattern (as defined above)
- ≥ 5 linked entities via shared infrastructure (phone/address/website)
- principal overlap ≥ 3 indicators
- domain-age mismatch with claimed operating history

> **Status:** inferred by Agent 2 on 2026-04-17. Awaiting Juan's review before Agent 3 runs. (Section 11 item #3.)

### Non-negotiable legal guardrails (all tiers, all prompts)
These guardrails are enforced by the system prompts and must never be softened:

1. **Phone is a search input, not an investigation target.** When a user pastes a phone number at the search box, we look up which BUSINESSES publicly list that phone. We never report on an individual associated with a phone. This is enforced in `src/lib/trust/resolver.ts` and its NEVER-DO list.
2. **Principal-network mapping uses business-data overlap only** — shared phone, shared address, shared website, shared DOT across *registered entities*. Never family trees, surname matching, personal social-media, or personal-data sources.
3. **Criminal records suppressed in CA / NY / IL / WA** — these states have strict laws governing commercial disclosure of criminal-history data. Deep Dive and Forensic prompts must suppress criminal records for contractors whose primary registration state is CA, NY, IL, or WA. (Applied 2026-04-17 to `homeowner-deep-dive.ts` and `homeowner-forensic.ts`.)
4. **Every red flag cites a public-record URL.** No finding is allowed without an evidenceUrl. This is enforced at the forensic-tier level (`evidence_bundle`) and surfaced in the report UI.
5. **Framing is always "our analysis of public records."** We present findings as an analysis; we never assert as fact anything we cannot source. Disclaimer on every report: *"For informational purposes only. earthmove.io makes no warranties. This is not a consumer report under the FCRA."*
6. **Never produce sensitive personal data** — DOB, home addresses of natural persons, SSN fragments, medical/financial history. Strip on output even if search results volunteer it.

### FCRA non-applicability
The FCRA (Fair Credit Reporting Act, 15 U.S.C. § 1681) regulates the collection, dissemination, and use of consumer information about **natural persons** for credit, insurance, employment, and tenancy decisions. Groundcheck reports are about **commercial entities** — LLCs, corporations, sole proprietorships — as hired for residential-work contracts. We do not:
- evaluate a natural person's creditworthiness, insurability, or employability;
- use the report for employment screening, tenant screening, or credit decisions;
- collect consumer-level PII beyond what is incidentally on public business filings (e.g., a registered agent's name).

Because the subject of every report is the business, not its owners-as-individuals, the FCRA does not apply. This reasoning is surfaced in the disclaimer text on every report and on the methodology + compliance pages (Phase 2 follow-up — Agent 9).

### Research-budget rationale
- **Standard / 10 searches / Sonnet** — fast, cheap, covers the basics most homeowners need before calling back an estimate.
- **Plus / 25 / Sonnet** — adds the stuff that exposes shell companies and mail-drop offices without going to Opus.
- **Deep Dive / 50 / Opus-4-7** — court records and regulatory history need structured reasoning over messy sources; Opus' larger context + reasoning justifies the step up despite the ~3× input-token cost.
- **Forensic / 80 / Opus-4-7** — the evidence bundle requires primary-source citation for every material claim. Opus' tokenizer may inflate token counts up to ~35% on structured data; monitor actual vs. estimated spend post-launch (Open Item 9).

---

## SECTION 11 — Inferred Decisions Log

Agent 2 (2026-04-17) made inferences where the inline spec was silent. This section reconciles each against the spec in BLOCKER 1.

### Status key
- **CONFIRMED** — inference matches the spec exactly
- **CHANGED** — spec provides a real decision; inferred value updated to match (files edited)
- **FLAGGED FOR REVIEW** — spec is silent or ambiguous; Juan to resolve before Agent 3 runs

### Inferred decisions (8)

| # | Topic | Inferred by Agent 2 | Spec (BLOCKER 1) | Status | Files touched for update |
|---|---|---|---|---|---|
| 1 | **Badge criteria** | legit = SoS VERIFIED + not dissolved/suspended; insured = public COI evidence; WC covered = active WC *OR* sole-prop exemption; well-reviewed = ≥4.0 avg over ≥10 reviews with non-NEGATIVE sentiment | legit = active SoS + **2+ years** in operation; insured = COI in last **12 months** OR state board; WC = state WC DB hit OR state board (no exemption path); well-reviewed = **≥20 reviews AND ≥4.3 avg across ≥2 platforms** | **CHANGED** | `homeowner-standard.ts`, `homeowner-plus.ts`, `homeowner-deep-dive.ts`, `homeowner-forensic.ts` |
| 2 | **Score bands** | 85-100 / 70-84 / 55-69 / **35-54** / **0-34** | 85-100 / 70-84 / 55-69 / **40-54** / **0-39** | **CHANGED** | `homeowner-standard.ts`, `homeowner-plus.ts`, `homeowner-deep-dive.ts`, `homeowner-forensic.ts` |
| 3 | **Scorecard subtraction/addition deltas** (CMRA, domain-mismatch, principal-overlap penalties, shell-game cap, etc.) | Self-consistent defaults (CMRA −8 from business_legitimacy; domain-age mismatch −5; 3+ principal overlaps −5; shell-game pattern → cap at 29) | Silent | **FLAGGED FOR REVIEW** | None yet |
| 4 | **Deep Dive integrations** (PACER / Lexis / state court portals) | 50 web searches + `/** PHASE 3 TODO **/` marker for paid integrations | Scope confirmed (50 + Opus-4-7); integration list not specified | **CONFIRMED (scope)** / **FLAGGED (integration list)** | None |
| 5 | **Forensic integrations** (PACER / Lexis / FMCSA deep / SoS bulk / D&B / TLO / Westlaw / PDF service) | 80 web searches + `/** PHASE 4 TODO **/` marker | Scope confirmed (80 + Opus-4-7); integration list not specified | **CONFIRMED (scope)** / **FLAGGED (integration list)** | None |
| 6 | **Report access window** | `trust_report_access.expires_at = NOW() + 90 days` in `/api/trust/route.ts` | **30 days** per access grant | **FLAGGED FOR REVIEW** (Juan explicitly flagged this) | None yet — code change pending review |
| 7 | **Cache TTLs for new tiers** | Not touched; falls into 24h `ELSE` branch of `set_cached_trust_report` RPC | Open Item #8 in BUILD_LOG already proposed standard 30d / plus 14d / deep_dive 14d / forensic 7d — not yet confirmed | **FLAGGED FOR REVIEW** | None yet |
| 8 | **Credits table idempotency** | `trust_credits_ledger` shipped without `idempotency_key TEXT UNIQUE` column | Silent; user accepted as Agent 3 responsibility | **FLAGGED FOR REVIEW** (Agent 3 decides) | None yet |

### Items requiring Juan's resolution before Agent 3
- **#3** — scorecard penalty deltas (dozen-ish values embedded in the prompts). Propose keeping Agent 2 defaults unless you want to override.
- **#4** — Deep Dive Phase 3 integration list (what paid APIs matter in Phase 3?).
- **#5** — Forensic Phase 4 integration list (same question for Phase 4).
- **#6** — report access window. Spec says 30d; code is 90d. Recommend honoring spec (30d) and fixing the code before Agent 3.
- **#7** — per-tier cache TTLs. Tentative: standard 30d / plus 14d / deep_dive 14d / forensic 7d. Confirm or revise.
- **#8** — whether Agent 3 should add `idempotency_key` to `trust_credits_ledger` on first write-through from the Stripe webhook, or whether we tolerate the drift.

---

## Living pointers

- Source of truth for prompts: `src/lib/trust/prompts/*.ts`
- Source of truth for tier routing: `src/lib/trust/tier-config.ts`
- Source of truth for Zod schemas: `src/lib/trust/trust-validator.ts` (b2b) and `src/lib/trust/schemas.ts` (homeowner)
- Source of truth for entitlement: `src/lib/trust/entitlement.ts`
- Migrations applied: `020_trust_tier_expansion.sql`, `021_trust_entitlements.sql`
- Running hand-offs: `BUILD_LOG.md`
