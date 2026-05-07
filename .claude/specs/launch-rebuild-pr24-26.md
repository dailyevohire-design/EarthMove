# LAUNCH REBUILD — PR #24, #25, #26

Single branch `feat/launch-rebuild-pr24-26`. Three commits, one PR review at end.
Verification ritual after every commit:
  pnpm exec tsc --noEmit && pnpm exec eslint src/lib/trust src/app/api/trust src/components/trust
Skip pnpm next build (Vercel is the gate). After each commit: paste hash + tsc/eslint output to Claude.ai chat. Wait for ack before next commit.

Migrations are committed to repo as .sql files but NOT applied — Claude.ai applies via MCP after PR opens. Use the next available migration number after `ls supabase/migrations/ | sort -V | tail -1`. Document the actual numbers chosen in commit body. The spec uses 228/229/230 as placeholders.

## CONTEXT (already done by Claude.ai via MCP, do not re-do)
- Stuck Bedrock deep_dive job d34ea85f force-failed
- Mike's deep_dive credit reversed (reversal_credit_id 142a6600)
- Don't touch trust_jobs in this rebuild

## DEVIATION RULE
If the codebase differs from spec at file/function naming level: adapt to the codebase, keep architectural intent, document deviations in the commit body. No permission needed for filename changes. ASK Claude.ai before architectural changes (e.g. swapping sync↔async on the free-tier path).

---

## COMMIT 1 — PR #24: Orchestrator collapse + free-tier wiring + no-data UX

### AUDIT FIRST (do not write code yet)

Read these files and report shapes back to Claude.ai chat:
1. `src/app/api/trust/route.ts`
2. `src/app/api/trust/lookup/anon/route.ts`
3. The Inngest function file containing `runTrustJobV2` and `runTrustSynthesizeV2` (likely `src/lib/trust/inngest-functions.ts` per session memory)
4. `src/lib/trust/anthropic-watchdog.ts`
5. `ls src/lib/trust/scrapers/` directory listing
6. Whatever component renders the trust report — grep for `data_integrity_status` in `src/components`
7. `cat package.json | grep -E '"(vitest|jest|mocha|@testing-library)"'` — confirm test runner
8. `ls supabase/migrations/ | sort -V | tail -3` — confirm latest migration number
9. Schema check (in chat to Claude.ai, NOT via MCP yourself): "what columns does `trust_source_registry` have for tier mapping?" — Claude.ai answers via MCP

After audit: ONE message to Claude.ai with file paths, function signatures, current free-tier flow, vitest presence, latest migration number. WAIT for ack before writing code.

### REQUIRED CHANGES

#### (A) New: `src/lib/trust/orchestrator-v2.ts`
Single function `runTrustOrchestratorV2(input, opts)` that all tiers route through.

Input: `{ contractor_name: string, state_code: string, city?: string, requested_by_user_id?: string, jobId?: string }`

Opts: `{ tier: Tier, runSynthesis: boolean, scraperKeys: string[], synthesisModel: string|null, nameVariants: string[] }`

Returns: full report-shaped object including `data_integrity_status`, `synthesis_model`, `data_sources_searched[]`, all evidence-derived fields.

Behavior:
1. Run scrapers in parallel via `Promise.allSettled`, each scraper receives `nameVariants[]` and iterates internally
2. SAM.gov backpressure: gate `sam_gov_exclusions` calls behind a process-level semaphore (max 3 concurrent). Use `p-limit` if installed, otherwise inline a tiny semaphore. Note in PR body.
3. Insert evidence rows from each scraper result (existing pattern in current code — preserve hash chain)
4. If `runSynthesis === false`: build report via new `buildEvidenceDerivedReport(evidence[])` helper (see (B))
5. If `runSynthesis === true`: call existing synthesis pipeline (commit 3 fixes its watchdog)
6. ALWAYS write `data_integrity_status` ∈ {ok, partial, entity_not_found, degraded, failed} — never null, never 'unknown'
7. ALWAYS write `synthesis_model` — for free tier use literal `'templated_evidence_derived'`

#### (B) New: `src/lib/trust/build-evidence-derived-report.ts`
Pure function `buildEvidenceDerivedReport(evidence: TrustEvidence[]): Partial<TrustReport>`

Maps finding_types to report fields deterministically:
- `business_not_found` → biz_status='Not Found'
- `business_active` → biz_status='Active'
- `business_dissolved` → biz_status='Dissolved', red_flag '+business_dissolved'
- `license_revoked` → lic_status='Revoked', red_flag '+license_revoked'
- `license_revoked_but_operating` → lic_status='Revoked + Operating', red_flag '+phoenix_operating'
- `sanction_hit` → red_flag '+federal_sanction'
- `sanction_clear` → positive_indicator '+no_federal_sanctions'
- `legal_no_actions` → legal_status='No Actions Found'
- `legal_finding` → red_flag with summary
- `permit_history_clean` / `_low` / `_high` → biz signal
- `*_not_found` / `*_no_actions` / `*_clear` / `*_no_record` → not "meaningful" — count toward `entity_not_found` determination

Determine `data_integrity_status`:
- If every finding_type ends in `_not_found|_no_actions|_clear|_no_record` AND zero `_active|_hit|_revoked|_finding|_dissolved`: `entity_not_found`
- If any scraper returned source_error: `partial` (or `degraded` if >50% errored)
- If all scrapers succeeded with mixed findings: `ok`

Compute `trust_score` for free tier via simple deterministic rule (no LLM):
- Base 75
- −20 per red_flag
- +10 per positive_indicator
- Floor 0, ceil 100
- If entity_not_found: trust_score = NULL, risk_level = NULL, confidence_level = 'LOW'

#### (C) New: `src/lib/trust/tier-config.ts`
```typescript
export type Tier = 'free'|'standard'|'plus'|'deep_dive'|'forensic'

export interface TierConfig {
  runSynthesis: boolean
  nameVariantLimit: number
  synthesisModel: string | null
  maxConcurrent: number      // global cap for this tier (backpressure)
  freeTierScraperFallback?: { CO: string[]; TX: string[] } // hardcoded for free, otherwise resolved at runtime
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  free:      { runSynthesis: false, nameVariantLimit: 3, synthesisModel: null,                    maxConcurrent: 3,
               freeTierScraperFallback: {
                 CO: ['sam_gov_exclusions','co_sos_biz','co_dora','courtlistener_fed','state_ag_enforcement'],
                 TX: ['sam_gov_exclusions','tx_sos_biz','tx_tdlr','courtlistener_fed','state_ag_enforcement'],
               }},
  standard:  { runSynthesis: true,  nameVariantLimit: 5, synthesisModel: 'claude-sonnet-4-6',     maxConcurrent: 10 },
  plus:      { runSynthesis: true,  nameVariantLimit: 5, synthesisModel: 'claude-sonnet-4-6',     maxConcurrent: 10 },
  deep_dive: { runSynthesis: true,  nameVariantLimit: 5, synthesisModel: 'claude-opus-4-7',       maxConcurrent: 5  },
  forensic:  { runSynthesis: true,  nameVariantLimit: 5, synthesisModel: 'claude-opus-4-7',       maxConcurrent: 3  },
}

export async function resolveScrapersForTier(tier: Tier, state: 'CO'|'TX'): Promise<string[]> {
  if (tier === 'free') return TIER_CONFIG.free.freeTierScraperFallback![state]
  // For paid tiers: query trust_source_registry where is_active=true AND tier_min ordinal <= this tier
  // Filter by state applicability (state_specific_to IS NULL OR state_specific_to = state)
  // Implementation depends on actual trust_source_registry columns — adapt to schema
  // Return ordered string[] of source_keys
}
```

#### (D) Free-tier API path
Modify `src/app/api/trust/route.ts` AND `src/app/api/trust/lookup/anon/route.ts`:
- For `tier === 'free'`: call `runTrustOrchestratorV2(input, { ...TIER_CONFIG.free, scraperKeys: await resolveScrapersForTier('free', state), nameVariants: [contractor_name] /* PR #25 expands this */ })` SYNCHRONOUSLY. Return result inline. Target <8s.
- For paid tiers: keep existing Inngest enqueue (`trust/job.requested.v2`). No behavior change at the API layer. The Inngest function body changes in (E).

#### (E) Modify `runTrustJobV2` (Inngest function)
Replace the internal scraper loop with a call to `runTrustOrchestratorV2` with `runSynthesis: true`. The existing synthesis call site within runTrustJobV2 stays in place — commit 3 patches its watchdog.

#### (F) Migration: `supabase/migrations/{NEXT_NUM}_data_integrity_status_enum.sql`
```sql
-- Backfill all NULL or non-canonical rows
UPDATE trust_reports SET data_integrity_status = CASE
  WHEN trust_score IS NULL AND COALESCE(searches_performed, 0) > 0 THEN 'failed'
  WHEN trust_score IS NULL THEN 'entity_not_found'
  WHEN biz_status IS NULL AND lic_status IS NULL THEN 'partial'
  ELSE 'ok'
END
WHERE data_integrity_status IS NULL
   OR data_integrity_status NOT IN ('ok','partial','entity_not_found','degraded','failed');

-- Enforce enum + NOT NULL
ALTER TABLE trust_reports
  ADD CONSTRAINT trust_reports_data_integrity_status_check
  CHECK (data_integrity_status IN ('ok','partial','entity_not_found','degraded','failed'));
ALTER TABLE trust_reports ALTER COLUMN data_integrity_status SET DEFAULT 'partial';
ALTER TABLE trust_reports ALTER COLUMN data_integrity_status SET NOT NULL;

-- Add data_integrity_status to trust_jobs too for parity
ALTER TABLE trust_jobs
  ADD COLUMN IF NOT EXISTS data_integrity_status text;
```
Commit body must include: `MIGRATION_PENDING_MCP_APPLY: {NEXT_NUM}` (use real number).

#### (G) New component: `src/components/trust/no-entity-found-card.tsx`
Props: `{ searchedName: string; stateCode: string; sourcesSearched: string[]; variantSuggestions: string[] }`

Renders:
- Heading: `We didn't find a public business record matching "{searchedName}" in {stateCode}.`
- Sources block: `We checked: {sourcesSearched.join(', ')}`
- Variant suggestions: each suggestion is a clickable link that re-runs the search with the variant. For commit 1, render text-only (no click handler) — wired to actual re-search in commit 2.
- External-search panel: pre-built links to BBB / Google Business Profile / state SOS for the searched name
- Disclaimer: "Absence of public records is not a clean record. Some legitimate businesses operate without formal registration, and some bad actors operate under unregistered or just-formed entities. Use this signal alongside in-person verification."

Style consistent with existing trust report cards — use the em-surface classes from PR #21 if applicable, or match `src/components/trust/trust-report-display.tsx` (or wherever the report card lives) styling.

#### (H) Report renderer: integrate `<NoEntityFoundCard />`
In whichever component renders the report (likely `src/components/trust/trust-report-display.tsx` or `src/components/trust/TrustPublicClient.tsx` or similar — grep for `red_flags` and `trust_score` in src/components):
- After fetching report, branch:
  - If `data_integrity_status === 'entity_not_found'`: render `<NoEntityFoundCard />` with props derived from report
  - Else: existing render path
- For variantSuggestions in commit 1: stub with `[searchedName + ' LLC', searchedName + ' Inc', searchedName + ' Corporation']`. Commit 2 replaces with real variants.

### ACCEPTANCE — COMMIT 1
- tsc 0, eslint 0
- New files exist: orchestrator-v2.ts, build-evidence-derived-report.ts, tier-config.ts, no-entity-found-card.tsx, {NEXT_NUM}_*.sql
- Free-tier API routes through orchestrator-v2 synchronously
- runTrustJobV2 internally calls orchestrator-v2
- Commit message: `feat(trust): collapse to one orchestrator, wire free-tier scrapers, add no-data UX`
- Commit body lists changed files, deviations from spec (if any), and `MIGRATION_PENDING_MCP_APPLY: {actual number}`
- **CHECKPOINT 1** — paste commit hash + verification output to Claude.ai. Wait for ack.

---

## COMMIT 2 — PR #25: Name variant expansion

### New: `src/lib/trust/name-variants.ts`

```typescript
export function expandContractorNameVariants(input: string, limit = 5): string[] {
  const out = new Set<string>()
  const cleaned = input.trim().replace(/\s+/g, ' ')
  if (!cleaned) return [input]
  out.add(cleaned)
  out.add(toTitleCase(cleaned))

  const stripped = stripCorporateSuffixes(cleaned)
  if (stripped !== cleaned) out.add(stripped)
  out.add(toTitleCase(stripped))

  for (const suffix of ['LLC','Inc','Corp','Corporation','Co']) {
    if (!new RegExp(`\\b${suffix}\\b`, 'i').test(cleaned)) {
      out.add(`${stripped} ${suffix}`)
      out.add(`${toTitleCase(stripped)} ${suffix}`)
    }
  }

  const stems: Array<[RegExp, string]> = [
    [/\bExcavation\b/gi, 'Excavating'],
    [/\bExcavating\b/gi, 'Excavation'],
    [/\bExcavators\b/gi, 'Excavating'],
    [/\bConstruction\b/gi, 'Constructors'],
    [/\bContracting\b/gi, 'Contractors'],
    [/\bContractors\b/gi, 'Contracting'],
    [/\bRoofers\b/gi, 'Roofing'],
    [/\bPlumbers\b/gi, 'Plumbing'],
    [/\bBuilders\b/gi, 'Building'],
  ]
  for (const [pattern, replacement] of stems) {
    const v = cleaned.replace(pattern, replacement)
    if (v !== cleaned) out.add(v)
  }

  // Light typo dedupe — heavy fuzzy match is post-launch
  const dedoubled = cleaned.replace(/([a-z])\1{2,}/gi, '$1$1')
  if (dedoubled !== cleaned) out.add(dedoubled)

  return Array.from(out).slice(0, limit)
}

function stripCorporateSuffixes(s: string): string {
  return s.replace(/\b(LLC|Inc|Corp|Corporation|Co|Company|Ltd|LP|LLP)\.?\b/gi, '').trim().replace(/\s+/g,' ')
}
function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}
```

### Tests: `src/lib/trust/__tests__/name-variants.test.ts`
ONLY if vitest is wired (audit step (7) confirms). If vitest not wired: write the tests but skip the .describe block with `.skip` and add a TODO comment to wire vitest in a follow-up. Do NOT block commit on test runner setup.

Cases (8 minimum):
1. `expandContractorNameVariants('Bedrock excavation')` includes 'Bedrock Excavation','Bedrock excavating','Bedrock Excavation LLC','Bedrock Excavation Corp'
2. `expandContractorNameVariants('bedrock construction llc')` strips llc, includes 'Bedrock Construction Inc'
3. `expandContractorNameVariants('Judge dwf llc')` preserves typo at index 0 (no auto-correct in this PR)
4. `expandContractorNameVariants('PCL Construction Services')` doesn't double-add existing words
5. `expandContractorNameVariants('')` returns `['']` defensively
6. `expandContractorNameVariants('   ')` returns whitespace-cleaned input only
7. `expandContractorNameVariants('BeMaS CoNsTrUcTiOn')` produces a clean title-cased variant
8. `expandContractorNameVariants('Bedrock Excavation', 2)` returns exactly 2 elements

### Wiring
- `runTrustOrchestratorV2` calls `expandContractorNameVariants(input.contractor_name, opts.tier_config.nameVariantLimit)` and passes the result to scrapers via `nameVariants: string[]` parameter
- Each scraper module: change signature from `name: string` to `nameVariants: string[]`. Iterate variants in order, return first hit. If all variants miss: return `*_not_found` finding for variant[0] only. Don't pollute evidence with N negative findings.
- Replace commit 1's variantSuggestions stub in NoEntityFoundCard with real variants

### ACCEPTANCE — COMMIT 2
- tsc 0, eslint 0
- If vitest wired: `pnpm exec vitest run src/lib/trust/__tests__/name-variants.test.ts` all pass
- All scraper modules updated to accept nameVariants[]
- Commit message: `feat(trust): name variant expansion + scraper wiring`
- **CHECKPOINT 2** — paste hash + test output (or "vitest not wired, tests skipped") to Claude.ai. Wait for ack.

---

## COMMIT 3 — PR #26: Watchdog audit + fix + sweeper + diagnostics

### AUDIT FIRST (do not patch yet)

Read `src/lib/trust/anthropic-watchdog.ts` + every call site (grep for the watchdog function name across `src/lib/trust/`). Identify which of three failure modes applies to the stuck-Bedrock-style hang:

1. **Promise rejection swallowed** — caller `await`s without `.catch()`, watchdog rejection lost. Symptom: synthesis hangs but no error logged anywhere.
2. **AbortSignal not propagated** — watchdog calls `abort()` on a signal not passed to the Anthropic SDK fetch. Symptom: watchdog timer fires, but the underlying network call keeps running and resolves later.
3. **Step boundary** — watchdog wrapped INSIDE `step.run(...)` so Inngest retries fight the timer. Symptom: stuck job, retry counter on the step incrementing, no resolution.

**CHECKPOINT 3a** — report finding to Claude.ai chat with file paths and line numbers. Wait for ack on the patch direction before writing code.

### Apply the matching fix
- Mode 1: ensure all callers of synthesis `.catch()` errors and write to `trust_jobs.error_message` + `status='failed'` + `synthesis_completed_at = now()`
- Mode 2: thread AbortSignal through to anthropic SDK: `anthropic.messages.create({ ..., signal: ctrl.signal })`. Verify SDK version supports the `signal` option (`@anthropic-ai/sdk` ≥ 0.27 has it).
- Mode 3: hoist watchdog OUTSIDE step.run. The step body becomes a single straight-line awaitable. The watchdog wraps the step.run call.

If multiple modes apply: fix each, document in commit body.

### Migration: `supabase/migrations/{NEXT_NUM+1}_synthesis_stall_sweeper.sql`
```sql
CREATE OR REPLACE FUNCTION sweep_stalled_synthesis() RETURNS void AS $$
BEGIN
  UPDATE trust_jobs
  SET status = 'failed',
      completed_at = now(),
      error_message = COALESCE(error_message,'') || E'\n[sweeper ' || now()::text || '] force-failed: synthesizing > 4min'
  WHERE status = 'synthesizing'
    AND started_at < now() - interval '4 minutes';
END;
$$ LANGUAGE plpgsql;

-- Schedule every minute
SELECT cron.schedule('sweep-stalled-synthesis', '* * * * *', $cmd$SELECT sweep_stalled_synthesis();$cmd$);
```
Commit body: `MIGRATION_PENDING_MCP_APPLY: {actual number}`

### Migration: `supabase/migrations/{NEXT_NUM+2}_synthesis_diagnostics.sql`
```sql
ALTER TABLE trust_jobs
  ADD COLUMN IF NOT EXISTS synthesis_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS synthesis_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS synthesis_attempt_count smallint DEFAULT 0;
```
Commit body: `MIGRATION_PENDING_MCP_APPLY: {actual number}`

### Wiring
- Set `synthesis_started_at = now()` at synthesis call entry
- Set `synthesis_completed_at = now()` at every return path (success, fallback, failure)
- Increment `synthesis_attempt_count` per attempt — Opus → Sonnet → template = up to 3 increments

### ACCEPTANCE — COMMIT 3
- Watchdog failure mode identified, documented in commit body with file:line refs
- Patch applied per matched mode(s)
- Three migration files in repo (data_integrity_status from commit 1 + sweeper + diagnostics)
- Diagnostics columns wired into synthesis paths
- tsc 0, eslint 0
- Commit message: `fix(trust): watchdog wiring + pg_cron stall sweeper + synthesis diagnostics`
- **CHECKPOINT 3b** — paste hash + verification + identified mode(s) to Claude.ai. Wait for ack.

---

## FINAL: push + open PR

After all 3 commits ack'd by Claude.ai:

```bash
git push origin feat/launch-rebuild-pr24-26

gh pr create --base main --head feat/launch-rebuild-pr24-26 \
  --title "Launch rebuild: orchestrator + name variants + watchdog (PR #24-26)" \
  --body "$(cat <<'PR_EOF'
## Summary
Closes the launch-blocking free-tier silent-stub bug, adds entity-name normalization, and fixes the synthesis hang surfaced by the stuck Bedrock deep_dive job earlier today.

## Commits
1. **feat(trust): collapse to one orchestrator, wire free-tier scrapers, add no-data UX** — eliminates the 21-day-old free-tier silent-stub regression. All tiers now route through `runTrustOrchestratorV2`. Free tier runs the same deterministic scrapers as paid tiers but skips LLM synthesis. New `<NoEntityFoundCard />` renders when the entity isn't in any source.
2. **feat(trust): name variant expansion + scraper wiring** — every scraper now queries top N name variants. Fixes the "Bedrock excavation" → no-match-on-Bedrock-Excavating-Corporation class of bugs.
3. **fix(trust): watchdog wiring + pg_cron stall sweeper + synthesis diagnostics** — root-cause fix for the watchdog hang + deterministic minute-resolution backstop via pg_cron + diagnostics columns for future debugging.

## Migrations pending MCP apply (Claude.ai applies, do not run via supabase CLI)
- {N}: data_integrity_status enum + backfill + NOT NULL
- {N+1}: synthesis_stall_sweeper pg_cron job
- {N+2}: synthesis_started_at / synthesis_completed_at / synthesis_attempt_count columns on trust_jobs

## Test plan
- Free-tier search "Bedrock Excavation" / Denver / CO → should return entity-found OR entity_not_found card with variant suggestions, NOT empty
- Free-tier search "bedrock excavating corp" / Parker / CO → should match the Parker-based real entity via co_sos_biz
- Deep-dive search same — synthesis must complete OR sweeper must force-fail it within 4 minutes
- Backfill query: `SELECT data_integrity_status, COUNT(*) FROM trust_reports GROUP BY 1` — zero NULLs, only the 5 canonical values

## Watchdog failure mode identified
{filled in by commit 3 body}
PR_EOF
)"
```

Ping Claude.ai with the PR URL. Claude.ai applies migrations via MCP, smoke-tests via SQL queries, gives you the merge GO.
