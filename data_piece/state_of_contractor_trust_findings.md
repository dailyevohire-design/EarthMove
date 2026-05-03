# State of Contractor Trust — Earth Pro Connect Findings

**Selection date:** 2026-05-03
**Sample size:** 100 contractors (Pool A: 50 Colorado SOS active LLCs/Corps in Denver-metro; Pool B: 50 Texas Comptroller franchise-tax accounts in DFW-area counties)

---

## Methodology

Selection date: 2026-05-03. Random sample (PostgreSQL random()) from filtered public records. Pool A: 50 contractors from Colorado Secretary of State (entity_status='Good Standing', principal_address_state='CO', Denver-metro cities, construction-keyword name match). Pool B: 50 contractors from Texas Comptroller franchise tax records (active right-to-transact, DFW-area counties: Dallas, Tarrant, Collin, Denton, construction-keyword name match). Standard tier full pipeline including AI synthesis. Cross-source entity-name normalization applied: legal entity-form suffixes (Inc., LLC, Corp., Ltd., LP, LLP, PC, PLLC, with/without commas and periods) stripped before querying secondary public-records sources. Resolution rates and charter-status findings are reported per-pool because cross-pool aggregation would conflate distinct selection criteria. No individual contractor names in public output.

---

## Disclaimer

This document compiles publicly available business records sourced from state regulatory agencies, Secretary of State filings, and municipal permit databases. It is not a consumer report under the Fair Credit Reporting Act. Findings are point-in-time observations as of 2026-05-03. Companies named in any underlying public record may contact Earth Pro Connect LLC at [contact] if any cited record requires correction.

---

## Aggregate findings

| metric | value |
|---|---|
| `co_pool_active_resolution_rate`      | 98% |
| `dfw_pool_active_resolution_rate`     | 82% |
| `dfw_pool_charter_status_gap_pct`     | 18% |
| `multi_state_operator_count`          | 8 |
| `pct_denver_permit_history_robust`    | 1% |
| `pct_denver_permit_history_low`       | 95% |
| `pct_at_least_one_red_flag`           | 18% |
| `pct_two_or_more_red_flags`           | 8% |
| **`pct_compound_risk`** (press headline) | **8%** |
| `mean_trust_score`                    | 93.5 |
| `median_trust_score`                  | 100 |
| `p10_trust_score`                     | 51 |
| `count_low_risk`                      | 87 |
| `count_medium_risk`                   | 0 |
| `count_high_risk`                     | 12 |
| `count_with_sam_gov_sanction`         | TBD (SAM.gov rate-limited until 2026-05-04 00:00 UTC; 100 of 100 rows show source_error) |

---

## Press headline findings (plain English, ready for copy lift)

1. **Charter-status gap (Texas):** 18% of DFW-area contractors with active Texas franchise tax registration carry non-clean charter status with the Texas Secretary of State — meaning they're current on tax filings but their underlying entity authorization is suspended, dissolved, or withdrawn. This is the kind of gap a homeowner can't see by checking "is this contractor in good standing?" on a single state portal.

2. **Compound-risk cohort:** 8% of randomly-sampled active contractors (across both states) trigger the compound-risk threshold — two or more adverse public-records signals despite being currently registered to operate.

3. **Distribution:** 12 of 100 sampled contractors are classified HIGH risk by the deterministic trust scoring; bottom-decile (p10) trust score is 51/100, while the median sits at 100/100.

4. **Cross-state operations:** 8 of the 100 sampled contractors hold active registrations in BOTH Colorado and Texas, indicating multi-state operations.

---

## Notes on data integrity

- **CO Pool resolution:** 49/50 = 98%. The remaining row is `Rocky Mountain Construction Company`, which the scraper classified as `business_dissolved`. **This is a known measurement artifact** (`FOLLOWUP-PICKBESTMATCH-DISSOLVED-PREFERENCE`): three CO SOS rows match the input name, and the scraper's `pickBestMatch` selects the first row in Socrata's default order, which happens to be `Rocky Mountain Construction Company L.L.C., Dissolved June 7, 2010`. The actual Rocky Mountain Construction Company (Englewood, CO; entity ID 20071298552) is in Good Standing in CO SOS as of report date. Treat the CO pool true-resolution rate as 50/50 once `pickBestMatch` is corrected to prefer Good Standing > Delinquent > Dissolved.
- **DFW Pool charter-status gap:** 9/50 = 18% of DFW contractors have `right_to_transact='A'` (active for franchise tax) but `sos_status_code != 'A'` (charter not in active state). This is a real public-records signal, not measurement artifact.
- **SAM.gov exclusions** check was rate-limited at run time (quota exhaustion through 2026-05-04 00:00 UTC). `count_with_sam_gov_sanction` is TBD; row-level `sam_gov_status` shows `source_error` for all 100 entries.
- **Dallas Open Data permits** dataset (`e7gq-4sah`) is frozen at end of 2019; `dallas_permits_5y` therefore shows 0 across the DFW subsample. Tracked as `FOLLOWUP-DALLAS-DATASET-STALE`.
- **6 transient timeouts** in the original 100-job run were retried as fresh jobs after the cross-source name-normalization fix landed; all 6 retries resolved cleanly. Run-2 + retry total cost: ~$145.
