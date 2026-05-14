/**
 * Live smoke for tx-assessor scraper. Hits real DCAD + TAD endpoints.
 *
 * If smoke red on test 1: the scraper's `extracted_facts.attempts` array
 * has every URL it tried + the HTTP status. Use that to identify the real
 * DCAD/TAD ArcGIS service path for the next iteration.
 */
import { scrapeTxAssessor } from '../src/lib/trust/scrapers/tx-assessor';

let failures = 0;
function pass(label: string) { console.log('OK ' + label); }
function fail(label: string, msg: string) { console.error('X ' + label + ': ' + msg); failures++; }

async function main() {
  console.log('── Test 1: City of Dallas (large landowner, will hit DCAD) ──');
  try {
    const ev = await scrapeTxAssessor({
      query_name: 'City of Dallas',
      jurisdiction: 'TX',
      city: 'Dallas',
    });
    console.log('  finding_type: ' + ev.finding_type);
    console.log('  summary:      ' + ev.finding_summary);
    const facts = ev.extracted_facts as Record<string, unknown>;
    console.log('  district:     ' + (facts.district ?? 'n/a'));
    console.log('  match_count:  ' + (facts.match_count ?? 'n/a'));
    if (facts.top_owner) console.log('  top_owner:    ' + facts.top_owner);

    if (ev.finding_type === 'source_error') {
      console.error('');
      console.error('  source_error — attempts:');
      const attempts = (facts.attempts ?? []) as Array<Record<string, unknown>>;
      for (const a of attempts) {
        console.error(`    [${a.district}] ${a.status}  ${a.url}  | ${a.note}`);
      }
      fail('test 1', 'all DCAD/TAD endpoints failed — check attempts above');
    } else if (typeof ev.finding_type === 'string' && /^(business_|address_)/.test(ev.finding_type)) {
      pass('test 1 returned valid finding (' + ev.finding_type + ')');
    } else {
      fail('test 1', 'unexpected finding_type: ' + ev.finding_type);
    }
  } catch (e) {
    fail('test 1', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  console.log('── Test 2: City of Fort Worth (will hit TAD via city routing) ──');
  try {
    const ev = await scrapeTxAssessor({
      query_name: 'City of Fort Worth',
      jurisdiction: 'TX',
      city: 'Fort Worth',
    });
    console.log('  finding_type: ' + ev.finding_type);
    console.log('  summary:      ' + ev.finding_summary);
    const facts = ev.extracted_facts as Record<string, unknown>;
    console.log('  district:     ' + (facts.district ?? 'n/a'));
    if (typeof ev.finding_type === 'string' && /^(business_|address_)/.test(ev.finding_type)) {
      pass('test 2 returned valid finding (' + ev.finding_type + ')');
    } else if (ev.finding_type === 'source_error') {
      console.log('  (TAD may be unreachable — see attempts in test 1 if same)');
      pass('test 2 returned source_error gracefully');
    } else {
      fail('test 2', 'unexpected finding_type: ' + ev.finding_type);
    }
  } catch (e) {
    fail('test 2', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  console.log('── Test 3: gibberish owner (negative control) ──');
  try {
    const ev = await scrapeTxAssessor({
      query_name: 'Zxqvbnm Plkmjn Asdfgh Holdings LLC',
      jurisdiction: 'TX',
      city: 'Dallas',
    });
    console.log('  finding_type: ' + ev.finding_type);
    if (ev.finding_type === 'business_not_found' || ev.finding_type === 'source_error') {
      pass('test 3 returned valid empty finding');
    } else {
      fail('test 3', 'gibberish returned unexpected: ' + ev.finding_type);
    }
  } catch (e) {
    fail('test 3', (e as Error).constructor.name + ': ' + (e as Error).message);
  }
  console.log('');

  if (failures > 0) {
    console.error('FAILED: ' + failures + ' smoke(s)');
    console.error('');
    console.error('Next: copy the `attempts` array from test 1 output');
    console.error('and identify the real DCAD/TAD ArcGIS service path');
    process.exit(1);
  }
  console.log('OK smoke: all tests passed');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
