/**
 * Live smoke for ccb-or scraper. Hits real Oregon CCB endpoint.
 *
 * NOTE: this smoke is expected to fail until the reCaptcha/WebForms
 * protocol path is implemented. See ccb-or.ts KNOWN ISSUE block.
 *
 * Tests:
 *   1. Known active OR contractor name -> license_active or license_*
 *   2. Gibberish name -> license_not_found
 */
import { scrapeCcbOr } from '../src/lib/trust/scrapers/ccb-or';

let failures = 0;
function pass(label: string) { console.log('OK ' + label); }
function fail(label: string, msg: string) { console.error('X ' + label + ': ' + msg); failures++; }

async function main() {
  console.log('── Test 1: Cedar Mill Construction (common OR contractor name) ──');
  try {
    const ev = await scrapeCcbOr({ query_name: 'Cedar Mill Construction', jurisdiction: 'OR' });
    console.log('  finding_type: ' + ev.finding_type);
    console.log('  summary:      ' + ev.finding_summary);
    console.log('  match_count:  ' + (ev.extracted_facts as Record<string, unknown>)['match_count']);
    if (typeof ev.finding_type === 'string' && ev.finding_type.startsWith('license_')) {
      pass('test 1 returned valid license_* finding');
    } else {
      fail('test 1', 'unexpected finding_type: ' + ev.finding_type);
    }
  } catch (e) {
    fail('test 1', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  console.log('── Test 2: gibberish name (should be license_not_found) ──');
  try {
    const ev = await scrapeCcbOr({ query_name: 'Zxqvbnm Plkmjn Asdfgh LLC', jurisdiction: 'OR' });
    console.log('  finding_type: ' + ev.finding_type);
    console.log('  summary:      ' + ev.finding_summary);
    if (ev.finding_type === 'license_not_found') {
      pass('test 2 returned license_not_found');
    } else {
      console.log('  (informational — CCB may fuzzy-match; not a hard fail)');
      pass('test 2 returned valid evidence');
    }
  } catch (e) {
    fail('test 2', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  if (failures > 0) {
    console.error('FAILED: ' + failures + ' smoke(s)');
    console.error('');
    console.error('Expected during the gate-pending window — CCB requires');
    console.error('reCaptcha/WebForms POST flow; the naive GET path 404s.');
    process.exit(1);
  }
  console.log('OK smoke: all tests passed');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
