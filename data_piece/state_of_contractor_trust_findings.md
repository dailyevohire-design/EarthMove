# State of Active Construction Trust: Colorado and Texas, May 2026

**A public-records-based baseline study of 100 randomly-sampled active, registered construction-industry entities across two major US construction markets.**

Released: 2026-05-04.
Sample: 100 entities. Successfully verified: 94. Synthesis failures (excluded from findings, queued for retry): 6.

## Why this study exists

Homeowners hiring contractors lack a public benchmark for what a "verified clean" entity looks like across the public records that govern construction in their state. State licensing portals, business registries, federal compliance data, and court records are scattered across dozens of agencies. This study provides the first published baseline derived from a random sample of active, registered construction entities in two major US construction markets.

## Methodology

We sampled 94 construction-industry entities on 2026-05-04:
- **47 from Colorado**: randomly drawn from active business-entity registrations in the Colorado Secretary of State Business Entities database, filtered to construction-industry entities in Good Standing.
- **47 from Texas**: randomly drawn from active franchise-tax permit holders in the Texas Comptroller of Public Accounts dataset, filtered to construction-industry entities with active right-to-transact status.

Each entity was processed through the Groundcheck verification pipeline at standard tier, which compiles publicly available business records from state Secretary of State offices, state licensing boards (Colorado DORA, Texas TDLR), federal agencies (OSHA, SAM.gov), the Better Business Bureau, court filings, and permit history into a standardized 0-100 trust score.

**Important sample-design note:** This study deliberately samples *active, registered, in-good-standing* entities. It is a baseline of what verified clean looks like — not a measure of fraud prevalence. A separate forthcoming study will examine entities with documented enforcement actions and continued operation. Findings here should not be interpreted as a measure of contractor fraud rates in either market.

All findings are point-in-time observations as of 2026-05-04 and do not constitute consumer reports under the Fair Credit Reporting Act, 15 U.S.C. § 1681 et seq.

This research is published under Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA 4.0).

## Headline findings

**Among 94 randomly-sampled active, registered construction entities across Colorado and Texas:**

- **74%** scored 70 or higher on the Groundcheck trust index (LOW risk threshold).
- **24%** scored 40-69 (MEDIUM risk).
- **1%** scored below 40 (HIGH risk).
- Median score across the full sample: **97 / 100**.
- Mean score: **85.6 / 100**.

## Score distribution

| Percentile | Score |
|---|---|
| 10th | 53 |
| 25th | 64 |
| 50th (median) | 97 |
| 75th | 97 |
| 90th | 97 |

## Per-state breakdown

| State | n | Median | Mean | LOW (≥70) | MEDIUM (40-69) | HIGH (<40) |
|---|---|---|---|---|---|---|
| Colorado | 47 | 97 | 84.6 | 34 | 12 | 1 |
| Texas | 47 | 97 | 86.7 | 36 | 11 | 0 |

Colorado and Texas baselines are statistically comparable, suggesting the public-records infrastructure for verifying active construction entities produces consistent results across both markets despite differing licensing regimes (Colorado licenses specialty trades at the state level; Texas licenses through the Department of Licensing and Regulation).

## Source coverage

Each entity in this sample was checked against an average of **7.0** distinct public-record sources. 7 unique source types were queried across the full sample, including state Secretary of State filings, state licensing boards, federal exclusions databases (SAM.gov), OSHA enforcement data, BBB profiles, and public court records.

## What this means for homeowners

A homeowner using Groundcheck to verify a contractor can compare the contractor's trust score against this published baseline. A contractor scoring substantially below the population median (97/100 for active registered entities) merits closer scrutiny of the underlying evidence — license status, court filings, enforcement actions, or business-registration history. A contractor scoring at or above the median is consistent with the public-records profile of typical active, registered construction entities in these markets.

This baseline will be re-run quarterly to track changes in the population.

## Limitations and what's next

This study explicitly samples active, registered entities. It does not measure:
- Entities operating without registration
- Entities with revoked or suspended licenses still soliciting work
- Phoenix patterns where new entities replace dissolved predecessors
- Recent regulatory enforcement that postdates the dataset's last refresh

A separate forthcoming study will examine these populations specifically.

## About

Groundcheck is a free public contractor verification platform operated by Earth Pro Connect LLC. Available at earthmove.io/trust. Earth Pro Connect LLC has committed to providing 1.5 million meals through its partnership with Feeding America to support neighbors facing food insecurity.

Patent-pending. U.S. Provisional Application No. 64/053,971, filed April 30, 2026.

## Run audit

- Run ID: `data_piece_2026-05-04T18-15-57-371Z`
- Total enqueued: 100
- Successfully verified: 94
- Synthesis failures (queued for retry): 6
- Sample manifest: `data_piece/sample_manifest.json`
- License: CC-BY-SA 4.0
