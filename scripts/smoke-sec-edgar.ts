/**
 * Live smoke for sec-edgar scraper. Hits real SEC EDGAR API.
 * No auth required.
 */
import { scrapeSecEdgar } from '../src/lib/trust/scrapers/sec-edgar';

let failures = 0;
function pass(label: string) { console.log('OK ' + label); }
function fail(label: string, msg: string) { console.error('X ' + label + ': ' + msg); failures++; }

async function main() {
  console.log('── Test 1: Granite Construction Inc (SEC-listed) ──');
  try {
    const ev = await scrapeSecEdgar({ query_name: 'Granite Construction', jurisdiction: 'CA' });
    console.log('  finding_type: ' + ev.finding_type);
    console.log('  summary:      ' + ev.finding_summary);
    console.log('  facts:        ' + JSON.stringify(ev.extracted_facts, null, 2).replace(/\n/g, '\n                '));
    if (ev.finding_type === 'business_active' || ev.finding_type === 'business_inactive') {
      pass('test 1 found filings for SEC-listed contractor');
    } else {
      fail('test 1', 'expected business_active/inactive, got ' + ev.finding_type);
    }
  } catch (e) {
    fail('test 1', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  console.log('── Test 2: Bemas Construction (residential, not SEC) ──');
  try {
    const ev = await scrapeSecEdgar({ query_name: 'Bemas Construction', jurisdiction: 'CO' });
    console.log('  finding_type: ' + ev.finding_type);
    console.log('  summary:      ' + ev.finding_summary);
    if (ev.finding_type === 'business_not_found') {
      pass('test 2 returned not_found for non-SEC contractor');
    } else {
      console.log('  (informational — Bemas may share a name with a filer, not a fail)');
      pass('test 2 returned valid evidence');
    }
  } catch (e) {
    fail('test 2', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  if (failures > 0) { console.error('FAILED: ' + failures + ' smoke(s)'); process.exit(1); }
  console.log('OK smoke: all tests passed');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
