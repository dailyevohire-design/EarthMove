// Smoke test: wrapper rejects Trinity Industries match for "Austin Industries" query.
// Also asserts that a legitimate match (e.g. "Granite Construction Incorporated") is
// preserved unchanged.
import { enforceSecEdgarStrictMatch } from '../src/lib/trust/scrapers/wrappers/sec-edgar-strict';
import type { ScraperEvidence } from '../src/lib/trust/scrapers/types';

const BASE: Omit<ScraperEvidence, 'finding_type' | 'finding_summary' | 'extracted_facts'> = {
  source_key: 'sec_edgar',
  confidence: 'verified_structured',
  query_sent: null,
  response_sha256: null,
  response_snippet: null,
  duration_ms: 0,
  cost_cents: 0,
};

let failures = 0;
function pass(label: string) { console.log('OK ' + label); }
function fail(label: string, msg: string) { console.error('X ' + label + ': ' + msg); failures++; }

async function main() {
  // Reproduce the exact Austin Industries report wrong-match
  const wrongMatch: ScraperEvidence = {
    ...BASE,
    finding_type: 'business_inactive',
    finding_summary: 'SEC EDGAR: 219 filings for "TRINITY INDUSTRIES INC  (TRN)  (CIK 0000099780)" (CIK 0000099780), most recent 2022-04-07',
    extracted_facts: { hits: 219 },
  };

  const downgraded = enforceSecEdgarStrictMatch('Austin Industries', wrongMatch);

  console.log('--- wrong-match input ---');
  console.log(JSON.stringify(wrongMatch, null, 2));
  console.log('\n--- wrapper output ---');
  console.log(JSON.stringify(downgraded, null, 2));

  if (downgraded.finding_type !== 'source_not_applicable') {
    fail('downgrade', `expected source_not_applicable, got ${downgraded.finding_type}`);
  } else {
    pass('Trinity downgraded to source_not_applicable for "Austin Industries" query');
  }

  // Legit match preservation — same SEC entity name and query name
  const legitMatch: ScraperEvidence = {
    ...BASE,
    finding_type: 'business_active',
    finding_summary: 'SEC EDGAR: 42 filings for "Granite Construction Incorporated (GVA) (CIK 0000861459)" (CIK 0000861459), most recent 2026-04-15',
    extracted_facts: { hits: 42 },
  };
  const preserved = enforceSecEdgarStrictMatch('Granite Construction', legitMatch);
  if (preserved.finding_type !== 'business_active') {
    fail('preserve', `legit match was unexpectedly downgraded: ${preserved.finding_type}`);
  } else {
    pass('legit Granite Construction match preserved as business_active');
  }

  // Pass-through for non-typed findings
  const notFound: ScraperEvidence = {
    ...BASE,
    finding_type: 'business_not_found',
    finding_summary: 'SEC EDGAR: no filings found for "Anything"',
    extracted_facts: {},
  };
  const passthrough = enforceSecEdgarStrictMatch('Anything', notFound);
  if (passthrough.finding_type !== 'business_not_found') {
    fail('pass-through', `business_not_found was unexpectedly changed: ${passthrough.finding_type}`);
  } else {
    pass('business_not_found pass-through preserved');
  }

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log(`\nRESULT_JSON: ${JSON.stringify({ ok: true, all_assertions_pass: true })}`);
}

main().catch((e) => {
  console.error('[smoke] crashed', e);
  process.exit(1);
});
