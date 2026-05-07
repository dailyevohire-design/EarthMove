# HOTFIX: dashboard NoEntityFoundCard branch + remove individual-classifier gate

Two bugs surfaced by Juan's live smoke tests post-PR-#24 deploy:

## BUG 1 — dashboard renderer doesn't branch on entity_not_found
Backend writes data_integrity_status='entity_not_found' correctly (verified via MCP, row 5e6ec563). TrustReportView.tsx was patched in commit 1, but the dashboard's contractor-check result page uses a DIFFERENT component that doesn't have the branch.

## BUG 2 — individual-name classifier blocks "Bedrock Excavating"
Search rejected pre-orchestrator with "verification failed - individual lookup requires Checkr". The classifier sees no LLC/Inc/Corp suffix, flags as possible individual, routes to FCRA path. This blocks the most common business-search shape.

## AUDIT FIRST (no code yet)
1. Find the dashboard contractor-check result renderer:
   `grep -rn "trust_score\|red_flags\|data_integrity_status" src/app/dashboard/gc/contractors/ src/components/`
2. Find the individual-classifier gate:
   `grep -rn -i "individual lookup\|requires checkr\|requires.*checkr\|verification failed" src/app/api/trust/ src/lib/trust/ src/components/trust/`
3. Find any name-classification logic:
   `grep -rn -i "isIndividual\|classifyName\|isPersonName\|llc\|inc\|corp" src/lib/trust/ src/app/api/trust/ | head -40`

Report findings to Claude.ai BEFORE patching. File paths + line numbers + the actual rejection logic for bug 2.

## FIX 1 — dashboard renderer
Whichever component renders the dashboard contractor-check result needs the same branch we added to TrustReportView.tsx. Mirror the pattern:
```tsx
if (report.data_integrity_status === 'entity_not_found') {
  return <NoEntityFoundCard
    searchedName={report.contractor_name}
    stateCode={report.state_code}
    sourcesSearched={report.data_sources_searched ?? []}
    variantSuggestions={expandContractorNameVariants(report.contractor_name, 4).slice(1)}
  />
}
```
Place ABOVE the existing rendering branch. Use the existing NoEntityFoundCard component from src/components/trust/no-entity-found-card.tsx.

## FIX 2 — remove or scope the individual-classifier gate
Free-tier and any business-tier search must bypass the individual-classifier entirely. Individual lookups are a SEPARATE product surface (driver checks, etc.) that should be its own route, NOT gated inside the contractor/business trust route.

Two implementation options — pick whichever is smaller blast radius after audit:

**Option A** (preferred if classifier is in route handler): comment out the classifier gate in `/api/trust/route.ts` for tier ∈ {free, standard, plus, deep_dive, forensic}. Add a TODO: "Individual lookups belong on a separate /api/checkr-screen route. This contractor route is business-only by definition."

**Option B** (if classifier is shared util): add an explicit `searchType: 'business'` param to the trust route call site, default to 'business', skip the individual classifier when business.

Either way: do NOT fix the classifier's heuristic to be smarter. The fix is removing it from the business path entirely. Smarter classification is a wrong-shape solution — every business search will eventually look ambiguous to a heuristic, and FCRA-gating business searches makes Groundcheck unusable.

## ACCEPTANCE
- tsc 0, eslint 0
- "Bedrock excavation" / Denver / CO / free renders <NoEntityFoundCard /> in dashboard, NOT a generic report card with empty fields
- "Bedrock Excavating" / Parker / CO / free reaches orchestrator-v2 and produces a trust_reports row (regardless of whether co_sos_biz hits — that's a separate concern)
- Commit message: `hotfix: dashboard render branch on entity_not_found + remove individual-classifier gate from business trust route`
- CHECKPOINT: paste hash + verification + (a) the dashboard renderer file path + (b) the individual-classifier file:line that was removed
