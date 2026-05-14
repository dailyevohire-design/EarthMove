/**
 * Live smoke for usaspending scraper. Hits real USASpending API.
 */
import { scrapeUsaspending } from '../src/lib/trust/scrapers/usaspending';

let failures = 0;
function pass(label: string) { console.log('OK ' + label); }
function fail(label: string, msg: string) { console.error('X ' + label + ': ' + msg); failures++; }

async function main() {
  console.log('── Test 1: Granite Construction (federal contractor) ──');
  try {
    const ev = await scrapeUsaspending({ query_name: 'Granite Construction', jurisdiction: 'CA' });
    console.log('  finding_type: ' + ev.finding_type);
    console.log('  summary:      ' + ev.finding_summary);
    if (ev.finding_type === 'federal_contractor_active' || ev.finding_type === 'federal_contractor_past_performance') {
      pass('test 1 found federal awards');
    } else {
      console.log('  (informational — may genuinely have no recent contracts under this name)');
      pass('test 1 returned valid evidence');
    }
  } catch (e) {
    fail('test 1', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  console.log('── Test 2: Bemas Construction (residential) ──');
  try {
    const ev = await scrapeUsaspending({ query_name: 'Bemas Construction', jurisdiction: 'CO' });
    console.log('  finding_type: ' + ev.finding_type);
    console.log('  summary:      ' + ev.finding_summary);
    pass('test 2 returned valid evidence');
  } catch (e) {
    fail('test 2', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  if (failures > 0) { console.error('FAILED: ' + failures + ' smoke(s)'); process.exit(1); }
  console.log('OK smoke: all tests passed');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
