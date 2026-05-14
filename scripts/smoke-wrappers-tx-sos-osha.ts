import { enforceTxSosBizRtbPrecedence } from '../src/lib/trust/scrapers/wrappers/tx-sos-biz-strict';
import { enforceOshaStrictMatch } from '../src/lib/trust/scrapers/wrappers/osha-strict';
import type { ScraperEvidence } from '../src/lib/trust/scrapers/types';

const BASE: Omit<ScraperEvidence, 'source_key' | 'finding_type' | 'finding_summary' | 'extracted_facts'> = {
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
  // --- tx_sos_biz ---
  const austinTxSos: ScraperEvidence = {
    ...BASE,
    source_key: 'tx_sos_biz',
    finding_type: 'business_inactive',
    finding_summary: 'TX Comptroller: "Austin Industries" status SOS=R RTB=A',
    extracted_facts: {},
  };
  const corrected = enforceTxSosBizRtbPrecedence(austinTxSos);
  if (corrected.finding_type !== 'business_active') {
    fail('tx_sos_biz RTB=A', `expected business_active, got ${corrected.finding_type}`);
  } else {
    pass('tx_sos_biz: SOS=R RTB=A flipped to business_active');
  }

  const forfeitedTxSos: ScraperEvidence = {
    ...BASE,
    source_key: 'tx_sos_biz',
    finding_type: 'business_inactive',
    finding_summary: 'TX Comptroller: "Some Dead LLC" status SOS=F RTB=F',
    extracted_facts: {},
  };
  const stillForfeited = enforceTxSosBizRtbPrecedence(forfeitedTxSos);
  if (stillForfeited.finding_type !== 'business_inactive') {
    fail('tx_sos_biz RTB=F', `expected business_inactive, got ${stillForfeited.finding_type}`);
  } else {
    pass('tx_sos_biz: RTB=F preserved as business_inactive');
  }

  const alreadyActive: ScraperEvidence = {
    ...BASE,
    source_key: 'tx_sos_biz',
    finding_type: 'business_active',
    finding_summary: 'TX Comptroller: "Foo Inc" is active',
    extracted_facts: {},
  };
  const passthrough = enforceTxSosBizRtbPrecedence(alreadyActive);
  if (passthrough.finding_type !== 'business_active') {
    fail('tx_sos_biz active passthrough', `got ${passthrough.finding_type}`);
  } else {
    pass('tx_sos_biz: already-active pass-through');
  }

  // --- osha_est_search ---
  const wrongOsha: ScraperEvidence = {
    ...BASE,
    source_key: 'osha_est_search',
    finding_type: 'osha_inspection_no_violation',
    finding_summary: 'OSHA: 1 inspection on file for "VERA INDUSTRIES LLC" — no citations',
    extracted_facts: {},
  };
  const downgraded = enforceOshaStrictMatch('Austin Industries', wrongOsha);
  if (downgraded.finding_type !== 'source_not_applicable') {
    fail('osha VERA INDUSTRIES', `expected source_not_applicable, got ${downgraded.finding_type}`);
  } else {
    pass('osha: VERA INDUSTRIES LLC downgraded for "Austin Industries" query');
  }

  const legitOsha: ScraperEvidence = {
    ...BASE,
    source_key: 'osha_est_search',
    finding_type: 'osha_inspection_no_violation',
    finding_summary: 'OSHA: 3 inspections on file for "AUSTIN INDUSTRIES INC" — no citations',
    extracted_facts: {},
  };
  const legitPreserved = enforceOshaStrictMatch('Austin Industries', legitOsha);
  if (legitPreserved.finding_type !== 'osha_inspection_no_violation') {
    fail('osha legit preserve', `got ${legitPreserved.finding_type}`);
  } else {
    pass('osha: legit Austin Industries match preserved');
  }

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log(`\nRESULT_JSON: ${JSON.stringify({ ok: true, all_pass: true })}`);
}

main().catch((e) => {
  console.error('[smoke] crashed', e);
  process.exit(1);
});
