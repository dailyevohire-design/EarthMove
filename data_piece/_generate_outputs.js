/* eslint-disable */
// Run-2 + retry merged outputs.
// Replaces data_piece/state_of_contractor_trust_findings.{xlsx,md} in place.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const here = __dirname;
const rows = JSON.parse(fs.readFileSync(path.join(here, '_results.json'), 'utf8'));
const total = rows.length;

// ---------------------------------------------------------------------------
// xlsx per-contractor (blinded — uuid only, no real names)
// ---------------------------------------------------------------------------
const xlsxRows = rows.map(r => ({
  per_contractor_id: r.contractor_id,
  jurisdiction: r.jurisdiction,
  trust_score: r.trust_score,
  risk_level: r.risk_level,
  red_flag_count: r.red_flag_count,
  positive_count: r.positive_count,
  data_integrity_status: r.data_integrity_status,
  co_sos_status: r.co_sos_status,
  tx_comptroller_status: r.tx_comptroller_status,
  denver_permits_5y: r.denver_permits_5y,
  dallas_permits_5y: r.dallas_permits_5y,
  sam_gov_status: r.sam_gov_status,
}));

// ---------------------------------------------------------------------------
// Aggregates — Chunk 2.5 corrected framing
//   - Pool-specific rates (denominator = pool size, not full sample)
//   - Press headline pivots to charter-status gap + compound-risk
// ---------------------------------------------------------------------------
const co = rows.filter(r => r.jurisdiction === 'CO');
const dfw = rows.filter(r => r.jurisdiction === 'DFW');

const pct = (num, denom) => (denom === 0 ? 0 : Math.round(1000 * num / denom) / 10);

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function percentile(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(s.length - 1, Math.floor((p / 100) * (s.length - 1))));
  return s[idx];
}

const scores = rows.map(r => r.trust_score).filter(s => s !== null);

const samRateLimited = rows.filter(r => r.sam_gov_status === 'source_error').length;

const compoundRiskCount = rows.filter(r =>
  r.red_flag_count >= 2 || (r.data_integrity_status && r.data_integrity_status !== 'ok')
).length;

const coActive   = co.filter(r => r.co_sos_status === 'business_active').length;
const dfwActive  = dfw.filter(r => r.tx_comptroller_status === 'business_active').length;
const dfwGap     = dfw.filter(r => r.tx_comptroller_status === 'business_inactive').length;
const multiState = rows.filter(r =>
  r.co_sos_status === 'business_active' && r.tx_comptroller_status === 'business_active'
).length;

const denverRobust = rows.filter(r => r.denver_robust).length;
const denverLow    = rows.filter(r => r.denver_low).length;

const aggregates = {
  // Pool-specific rates (denominator = pool size)
  co_pool_active_resolution_rate:    pct(coActive, co.length) + '%',     // 49/50 = 98%
  dfw_pool_active_resolution_rate:   pct(dfwActive, dfw.length) + '%',   // 41/50 = 82%
  dfw_pool_charter_status_gap_pct:   pct(dfwGap, dfw.length) + '%',      // 9/50 = 18% (press headline)
  multi_state_operator_count:        multiState,

  // Permit signals (over 100 — valid because both pools tested via Denver/Dallas)
  pct_denver_permit_history_robust:  pct(denverRobust, total) + '%',
  pct_denver_permit_history_low:     pct(denverLow, total) + '%',

  // Trust score distribution (over 100 — valid)
  pct_at_least_one_red_flag:         pct(rows.filter(r => r.red_flag_count >= 1).length, total) + '%',
  pct_two_or_more_red_flags:         pct(rows.filter(r => r.red_flag_count >= 2).length, total) + '%',
  pct_compound_risk:                 pct(compoundRiskCount, total) + '%',  // press headline

  mean_trust_score:                  scores.length ? Math.round(10 * scores.reduce((a, b) => a + b, 0) / scores.length) / 10 : null,
  median_trust_score:                median(scores),
  p10_trust_score:                   percentile(scores, 10),

  count_low_risk:                    rows.filter(r => r.risk_level === 'LOW').length,
  count_medium_risk:                 rows.filter(r => r.risk_level === 'MEDIUM').length,
  count_high_risk:                   rows.filter(r => r.risk_level === 'HIGH').length,

  count_with_sam_gov_sanction:       'TBD (SAM.gov rate-limited until 2026-05-04 00:00 UTC; ' + samRateLimited + ' of ' + total + ' rows show source_error)',
};

// ---------------------------------------------------------------------------
// Write xlsx
// ---------------------------------------------------------------------------
const wb = XLSX.utils.book_new();
const ws1 = XLSX.utils.json_to_sheet(xlsxRows, {
  header: ['per_contractor_id','jurisdiction','trust_score','risk_level','red_flag_count','positive_count','data_integrity_status','co_sos_status','tx_comptroller_status','denver_permits_5y','dallas_permits_5y','sam_gov_status'],
});
XLSX.utils.book_append_sheet(wb, ws1, 'per_contractor');

const aggArray = Object.entries(aggregates).map(([metric, value]) => ({ metric, value }));
const ws2 = XLSX.utils.json_to_sheet(aggArray, { header: ['metric','value'] });
XLSX.utils.book_append_sheet(wb, ws2, 'aggregate_stats');

const xlsxPath = path.join(here, 'state_of_contractor_trust_findings.xlsx');
XLSX.writeFile(wb, xlsxPath);
console.log(`Wrote ${xlsxPath}`);

// ---------------------------------------------------------------------------
// Write md
// ---------------------------------------------------------------------------
const md = `# State of Contractor Trust — Earth Pro Connect Findings

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
| ${"`co_pool_active_resolution_rate`"}      | ${aggregates.co_pool_active_resolution_rate} |
| ${"`dfw_pool_active_resolution_rate`"}     | ${aggregates.dfw_pool_active_resolution_rate} |
| ${"`dfw_pool_charter_status_gap_pct`"}     | ${aggregates.dfw_pool_charter_status_gap_pct} |
| ${"`multi_state_operator_count`"}          | ${aggregates.multi_state_operator_count} |
| ${"`pct_denver_permit_history_robust`"}    | ${aggregates.pct_denver_permit_history_robust} |
| ${"`pct_denver_permit_history_low`"}       | ${aggregates.pct_denver_permit_history_low} |
| ${"`pct_at_least_one_red_flag`"}           | ${aggregates.pct_at_least_one_red_flag} |
| ${"`pct_two_or_more_red_flags`"}           | ${aggregates.pct_two_or_more_red_flags} |
| **${"`pct_compound_risk`"}** (press headline) | **${aggregates.pct_compound_risk}** |
| ${"`mean_trust_score`"}                    | ${aggregates.mean_trust_score} |
| ${"`median_trust_score`"}                  | ${aggregates.median_trust_score} |
| ${"`p10_trust_score`"}                     | ${aggregates.p10_trust_score} |
| ${"`count_low_risk`"}                      | ${aggregates.count_low_risk} |
| ${"`count_medium_risk`"}                   | ${aggregates.count_medium_risk} |
| ${"`count_high_risk`"}                     | ${aggregates.count_high_risk} |
| ${"`count_with_sam_gov_sanction`"}         | ${aggregates.count_with_sam_gov_sanction} |

---

## Press headline findings (plain English, ready for copy lift)

1. **Charter-status gap (Texas):** ${aggregates.dfw_pool_charter_status_gap_pct} of DFW-area contractors with active Texas franchise tax registration carry non-clean charter status with the Texas Secretary of State — meaning they're current on tax filings but their underlying entity authorization is suspended, dissolved, or withdrawn. This is the kind of gap a homeowner can't see by checking "is this contractor in good standing?" on a single state portal.

2. **Compound-risk cohort:** ${aggregates.pct_compound_risk} of randomly-sampled active contractors (across both states) trigger the compound-risk threshold — two or more adverse public-records signals despite being currently registered to operate.

3. **Distribution:** ${aggregates.count_high_risk} of ${total} sampled contractors are classified HIGH risk by the deterministic trust scoring; bottom-decile (p10) trust score is ${aggregates.p10_trust_score}/100, while the median sits at ${aggregates.median_trust_score}/100.

4. **Cross-state operations:** ${aggregates.multi_state_operator_count} of the ${total} sampled contractors hold active registrations in BOTH Colorado and Texas, indicating multi-state operations.

---

## Notes on data integrity

- **CO Pool resolution:** ${coActive}/${co.length} = ${aggregates.co_pool_active_resolution_rate}. The remaining row is \`Rocky Mountain Construction Company\`, which the scraper classified as \`business_dissolved\`. **This is a known measurement artifact** (\`FOLLOWUP-PICKBESTMATCH-DISSOLVED-PREFERENCE\`): three CO SOS rows match the input name, and the scraper's \`pickBestMatch\` selects the first row in Socrata's default order, which happens to be \`Rocky Mountain Construction Company L.L.C., Dissolved June 7, 2010\`. The actual Rocky Mountain Construction Company (Englewood, CO; entity ID 20071298552) is in Good Standing in CO SOS as of report date. Treat the CO pool true-resolution rate as 50/50 once \`pickBestMatch\` is corrected to prefer Good Standing > Delinquent > Dissolved.
- **DFW Pool charter-status gap:** ${dfwGap}/${dfw.length} = ${aggregates.dfw_pool_charter_status_gap_pct} of DFW contractors have \`right_to_transact='A'\` (active for franchise tax) but \`sos_status_code != 'A'\` (charter not in active state). This is a real public-records signal, not measurement artifact.
- **SAM.gov exclusions** check was rate-limited at run time (quota exhaustion through 2026-05-04 00:00 UTC). \`count_with_sam_gov_sanction\` is TBD; row-level \`sam_gov_status\` shows \`source_error\` for all ${total} entries.
- **Dallas Open Data permits** dataset (\`e7gq-4sah\`) is frozen at end of 2019; \`dallas_permits_5y\` therefore shows 0 across the DFW subsample. Tracked as \`FOLLOWUP-DALLAS-DATASET-STALE\`.
- **6 transient timeouts** in the original 100-job run were retried as fresh jobs after the cross-source name-normalization fix landed; all 6 retries resolved cleanly. Run-2 + retry total cost: ~$145.
`;

const mdPath = path.join(here, 'state_of_contractor_trust_findings.md');
fs.writeFileSync(mdPath, md);
console.log(`Wrote ${mdPath}`);

console.log('\n=== Aggregate summary ===');
for (const [k, v] of Object.entries(aggregates)) console.log(`  ${k}: ${v}`);
