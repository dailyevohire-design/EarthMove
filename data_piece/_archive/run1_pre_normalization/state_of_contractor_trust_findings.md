# State of Contractor Trust — Earth Pro Connect Findings

**Selection date:** 2026-05-03
**Sample size:** 100 contractors (50 Colorado SOS active LLCs/Corps in Denver-metro; 50 Texas Comptroller franchise-tax accounts in DFW-area counties)

---

## Methodology

Selection date: 2026-05-03. Random sample (PostgreSQL random()) from filtered public records. 50 contractors from Colorado Secretary of State (entity_status='Good Standing', principal_address_state='CO', Denver-metro cities, construction-keyword name match). 50 contractors from Texas Comptroller franchise tax records (active right-to-transact, DFW-area counties: Dallas, Tarrant, Collin, Denton, construction-keyword name match). Standard tier full pipeline including AI synthesis. No individual contractor names in public output.

---

## Disclaimer

This document compiles publicly available business records sourced from state regulatory agencies, Secretary of State filings, and municipal permit databases. It is not a consumer report under the Fair Credit Reporting Act. Findings are point-in-time observations as of 2026-05-03. Companies named in any underlying public record may contact Earth Pro Connect LLC at [contact] if any cited record requires correction.

---

## Aggregate findings

| metric | value |
|---|---|
| `pct_co_sos_good_standing` | 46.0% |
| `pct_tx_comptroller_active` | 43.0% |
| `pct_denver_permit_history_robust` | 0.0% |
| `pct_denver_permit_history_low` | 100.0% |
| `pct_at_least_one_red_flag` | 14.0% |
| `pct_two_or_more_red_flags` | 10.0% |
| `pct_compound_risk` | 10.0% |
| `pct_tx_active_right_to_transact` | 82.0% |
| `pct_tx_comptroller_match_when_searched` | 0.0% |
| `mean_trust_score` | 93.5 |
| `median_trust_score` | 100 |
| `p10_trust_score` | 51 |
| `count_low_risk` | 87 |
| `count_medium_risk` | 0 |
| `count_high_risk` | 13 |
| `count_with_sam_gov_sanction` | TBD (SAM.gov rate-limited until 2026-05-04 00:00 UTC; 100 of 100 rows show source_error) |

---

## Headline findings (plain English, for press lift)

- 46.0% of sampled contractors hold an active "Good Standing" registration with the Colorado Secretary of State.
- 43.0% hold an active right-to-transact-business status with the Texas Comptroller.
- 0.0% have a robust Denver permit history (5+ permits in the last five years, most recent within six months).
- 100.0% have a low Denver permit history (fewer than 5 permits in the last five years).
- 14.0% have at least one red flag in their public-records profile.
- 10.0% have two or more red flags.
- 10.0% fall into the "compound-risk" cohort — two or more red flags OR a non-clean data-integrity status.
- 82.0% of the DFW-area subsample hold active TX Comptroller right-to-transact (a definitional check; deviations indicate dataset drift).
- 0.0% of the DFW-area subsample also surface in Colorado SOS records, indicating multi-state operations.
- Mean trust score: 93.5/100.
- Median trust score: 100/100.
- Bottom-decile cutoff (p10) trust score: 51/100.
- 87 contractors classified LOW risk.
- 0 contractors classified MEDIUM risk.
- 13 contractors classified HIGH risk.
- Federal exclusion (SAM.gov) status: TBD (SAM.gov rate-limited until 2026-05-04 00:00 UTC; 100 of 100 rows show source_error)

---

## Notes on data integrity (read before press use)

Three findings in this report are dominated by measurement artifacts rather than market signal and should NOT be lifted into press copy without explicit hedging:

- **`pct_denver_permit_history_robust` (0%)** and **`pct_denver_permit_history_low` (100%)**: the Denver ArcGIS permits scraper matches `UPPER(CONTRACTOR_NAME) LIKE UPPER('%input%')`, which is defeated when the input legal name carries an entity suffix (e.g. `PLAZA CONSTRUCTION, INC.` → 0 hits; `PLAZA CONSTRUCTION` → 1 hit). Most rows in Pool A include `, INC.` / `, LLC` suffixes from CO SOS. Tracked as `FOLLOWUP-CROSS-SOURCE-NAME-NORM`.
- **`pct_co_sos_good_standing` (46%)** and **`pct_tx_active_right_to_transact` (82%)**: both pools were filtered ON active status at selection time, so a 100% resolution rate was the theoretical ceiling. The shortfall (under-100%) reflects scraper name-resolution friction, not entity inactivation. Useful as a "first-pass resolution rate" methodology finding, NOT as a market-quality finding.
- The federal **SAM.gov exclusions** check was rate-limited at run time (quota exhaustion through 2026-05-04 00:00 UTC). Aggregate stat `count_with_sam_gov_sanction` is therefore TBD; row-level `sam_gov_status` shows `source_error` for all 100 entries. A re-run after the quota reset will resolve this.
- The **Dallas Open Data permits** dataset (`e7gq-4sah`) is frozen at end of 2019; `dallas_permits_5y` therefore shows 0 across the DFW subsample. Data-source limitation, not a contractor-quality signal. Tracked as `FOLLOWUP-DALLAS-DATASET-STALE`.

### Stats safe for press lift, with hedging

- **`pct_compound_risk` (10%)** — share of randomly-sampled active construction businesses where the pipeline assigns 2+ red flags or non-clean data integrity.
- **`count_high_risk` (13 of 100)** — share classified HIGH risk by the deterministic scoring function. Note: a portion of HIGH-risk classifications trace to the same name-resolution friction described above (when no source returns `business_active` for a contractor's name, the scoring drops to HIGH by default). Migration 127 fixed the directional bias, but contractors whose names don't match any source still default to HIGH.
- **`pct_tx_comptroller_match_when_searched` (0%)** — share of DFW contractors that also surface in CO SOS. Zero indicates the TX-registered entities operate single-state, which is consistent with the underlying data.

### Run cost

API spend: $127.84 across 100 standard-tier syntheses (avg ~123s/job, concurrency 5).
