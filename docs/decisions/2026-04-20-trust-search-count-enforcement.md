# Decision: Accept current ROOFER_CLASS search-count enforcement behavior

**Date:** 2026-04-20
**Scope:** `src/lib/trust/trust-engine.ts` SYSTEM_PROMPT STEP 2 (mandatory searches)
**Status:** Accepted

## Context

STEP 2 of SYSTEM_PROMPT mandates a 10-search minimum when ROOFER_CLASS triggers (7 base + 3 roofer-specific), and 11+ when MULTI_STATE_STORM_CORRIDOR triggers. The `web_search` tool is configured with `max_uses: 12`, which is the ceiling — not a floor.

The model occasionally self-terminates below the ROOFER_CLASS minimum:

| Run | Contractor | Class | `searches_performed` |
|---|---|---|---|
| commit `a01e08f` | Roof Squad Colorado | ROOFER + MULTI_STATE | 8 |
| commit `25c1508` | Golden Triangle Construction | (disambiguated, not roofer) | 9 |

The content quality in both cases was attorney-grade: class identification correct, class caps correctly applied, adverse findings surfaced (e.g., $800K City of Longmont lawsuit against GTC, insurance-supplement behavioral marker on Roof Squad), required AG/SOS sources listed (even when marked UNRESOLVED), entity resolution traced to operating LLC. The search-count under-run did not produce degraded output.

## Decision

Accept current behavior. Do not tighten the prompt to hard-enforce 10+ searches.

## Rationale

1. **Quality is the metric that matters.** The purpose of the 10-search minimum is coverage, not compliance. Reports produced at 8–9 searches already pass the coverage bar; the floor is a prompt-level safety rail, not a performance target.
2. **Hard-enforcing 10+ would risk wasted searches.** Some class-level sources (state AG consumer databases) aren't publicly searchable. Forcing the model to hit a number when it has no more productive queries to run would spend web_search fees ($0.01 per use) on redundant queries without adding signal.
3. **Observed variance is acceptable.** 8 of 10 (80%) hits the budget; the two under-runs were at 8 and 9, both within one of target. No run fell below the base 7-search minimum.

## Reconsider when

- Any future `data_sources_searched` output clearly shows missing required sources for a ROOFER_CLASS or MULTI_STATE_STORM_CORRIDOR run with quality degradation (weak findings, missed adverse records).
- Search count falls below the base 7-minimum on any run.
- Cost-per-call drops significantly and the marginal cost of wasted searches becomes negligible relative to the coverage guarantee.

## Instrumentation in place

- `meta.searches_performed` is in every response body (commit `feb7169`), making under-runs trivially observable.
- `trust_reports.searches_performed` column persists the value for historical review.
