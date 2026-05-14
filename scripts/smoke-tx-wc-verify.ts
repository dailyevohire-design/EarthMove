/**
 * Smoke: tx_wc_verify v2 — Socrata dual-dataset architecture
 *
 * Output:
 *   1. SCHEMA_RECON block — first-row keys from each dataset via unfiltered $limit=1
 *   2. Per-target result with extracted_facts diagnostic
 *   3. RESULT_JSON tally
 */
import { scrapeTxWcVerify } from '../src/lib/trust/scrapers/state-insurance/tx-wc-verify';

const TARGETS = [
  'Austin Industries',
  'Manhattan Construction',
  'The Beck Group',
];

const SUBSCRIBER_PROBE = 'https://data.texas.gov/resource/c4xz-httr.json?$limit=1';
const NON_SUBSCRIBER_PROBE = 'https://data.texas.gov/resource/azae-8krr.json?$limit=1';

async function probeSchema(url: string, label: string) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => []);
    const row = Array.isArray(body) && body.length > 0 ? body[0] : null;
    console.log(`SCHEMA_RECON ${label}: status=${res.status} keys=${row ? JSON.stringify(Object.keys(row)) : 'EMPTY'}`);
  } catch (err) {
    console.log(`SCHEMA_RECON ${label}: ERROR ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  console.log(`=== tx_wc_verify smoke (v2 — Socrata dual-dataset) ===`);
  console.log('');
  console.log('--- SCHEMA RECON (unfiltered $limit=1) ---');
  await probeSchema(SUBSCRIBER_PROBE, 'subscriber c4xz-httr');
  await probeSchema(NON_SUBSCRIBER_PROBE, 'non_subscriber azae-8krr');
  console.log('');

  let pass = 0, warn = 0, fail = 0;

  for (const target of TARGETS) {
    console.log(`--- Target: ${target} ---`);
    try {
      const result = await scrapeTxWcVerify({ legalName: target, stateCode: 'TX' });
      const findings = Array.isArray(result) ? result : [result];
      const findingTypes = findings.map((f) => f.finding_type);
      console.log(`  findings: ${JSON.stringify(findingTypes)}`);
      for (const f of findings) {
        const fact = f.extracted_facts ? JSON.stringify(f.extracted_facts).slice(0, 600) : 'none';
        console.log(`  [${f.finding_type}] ${f.finding_summary}`);
        console.log(`    facts: ${fact}`);
      }
      const hasActive = findingTypes.includes('insurance_active_wc');
      const hasLapsed = findingTypes.includes('insurance_lapsed');
      const hasNotApplicable = findingTypes.includes('source_not_applicable');
      const hasError = findingTypes.includes('source_error');

      if (hasError) { fail++; console.log('  STATUS: FAIL (source_error)'); }
      else if (hasActive || hasLapsed) { pass++; console.log('  STATUS: PASS'); }
      else if (hasNotApplicable) { warn++; console.log('  STATUS: WARN (no match — expected for some firms or schema drift)'); }
      else { warn++; console.log('  STATUS: WARN (unexpected finding mix)'); }
    } catch (err) {
      fail++;
      console.log(`  STATUS: FAIL (threw) ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log('');
  }

  const total = pass + warn + fail;
  console.log(`RESULT_JSON ${JSON.stringify({ pass, warn, fail, total })}`);
}

main().catch((err) => {
  console.error('Smoke harness threw:', err);
  process.exit(1);
});
