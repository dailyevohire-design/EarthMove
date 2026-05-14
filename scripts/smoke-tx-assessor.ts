/**
 * Live smoke for tx-assessor v2 (DCAD WebForms).
 */
import { scrapeTxAssessor } from '../src/lib/trust/scrapers/tx-assessor';

let failures = 0;
function pass(label: string) { console.log('OK ' + label); }
function fail(label: string, msg: string) { console.error('X ' + label + ': ' + msg); failures++; }

function dumpAttempts(ev: { extracted_facts: unknown }) {
  const facts = ev.extracted_facts as Record<string, unknown>;
  const attempts = (facts.attempts ?? []) as Array<Record<string, unknown>>;
  if (attempts.length === 0) return;
  console.error('  attempts:');
  for (const a of attempts) {
    console.error(`    [${a.step}] ${a.status}  ${a.url}`);
    console.error(`            ${a.note}`);
  }
}

async function main() {
  console.log('── Test 1: "City of Dallas" (major Dallas County landowner) ──');
  try {
    const ev = await scrapeTxAssessor({ query_name: 'City of Dallas', jurisdiction: 'TX', city: 'Dallas' });
    console.log('  finding_type: ' + ev.finding_type);
    console.log('  summary:      ' + ev.finding_summary);
    const facts = ev.extracted_facts as Record<string, unknown>;
    if (facts.match_count != null) console.log('  match_count:  ' + facts.match_count);
    if (facts.top_owner) console.log('  top_owner:    ' + facts.top_owner);
    if (facts.top_account) console.log('  top_account:  ' + facts.top_account);

    if (ev.finding_type === 'source_error') {
      dumpAttempts(ev);
      fail('test 1', 'all DCAD endpoints failed — check attempts above');
    } else if (typeof ev.finding_type === 'string' && /^(business_|address_)/.test(ev.finding_type)) {
      pass('test 1 valid (' + ev.finding_type + ')');
    } else {
      fail('test 1', 'unexpected finding_type: ' + ev.finding_type);
    }
  } catch (e) {
    fail('test 1', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  console.log('── Test 2: "Dallas Independent School District" (large entity) ──');
  try {
    const ev = await scrapeTxAssessor({ query_name: 'Dallas Independent School District', jurisdiction: 'TX', city: 'Dallas' });
    console.log('  finding_type: ' + ev.finding_type);
    console.log('  summary:      ' + ev.finding_summary);
    if (ev.finding_type === 'source_error') {
      console.log('  (matches test 1 outcome — see attempts in test 1)');
      pass('test 2 graceful');
    } else if (typeof ev.finding_type === 'string' && /^(business_|address_|business_not_found)/.test(ev.finding_type)) {
      pass('test 2 valid (' + ev.finding_type + ')');
    } else {
      fail('test 2', 'unexpected: ' + ev.finding_type);
    }
  } catch (e) {
    fail('test 2', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  console.log('── Test 3: gibberish (negative control) ──');
  try {
    const ev = await scrapeTxAssessor({ query_name: 'Zxqvbnm Plkmjn Holdings LLC', jurisdiction: 'TX', city: 'Dallas' });
    console.log('  finding_type: ' + ev.finding_type);
    if (ev.finding_type === 'business_not_found' || ev.finding_type === 'source_error') {
      pass('test 3 graceful');
    } else {
      fail('test 3', 'unexpected: ' + ev.finding_type);
    }
  } catch (e) {
    fail('test 3', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  if (failures > 0) {
    console.error('FAILED: ' + failures + ' smoke(s)');
    console.error('');
    console.error('attempts array shows exact step (GET/POST), URL, HTTP status,');
    console.error('and error message for each DCAD host tried — use for v3 if needed.');
    process.exit(1);
  }
  console.log('OK smoke: all tests passed');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
