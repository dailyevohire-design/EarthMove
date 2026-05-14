// Smoke: probe TX DWC workers-comp verification against known TX entities.
// Major TX construction firms — should have active WC.
import { scrapeTxWcVerify } from '../src/lib/trust/scrapers/state-insurance/tx-wc-verify';

const TARGETS = [
  'Austin Industries',
  'The Beck Group',
  'Manhattan Construction',
];

async function main() {
  let pass = 0;
  let warn = 0;
  let fail = 0;

  for (const name of TARGETS) {
    const t0 = Date.now();
    try {
      const r = await scrapeTxWcVerify(name);
      const ms = Date.now() - t0;
      const valid = [
        'insurance_active_wc',
        'insurance_lapsed',
        'insurance_no_record',
        'insurance_below_minimum',
        'source_not_applicable',
        'source_error',
      ].includes(r.finding_type);
      const hasAttempts = Array.isArray((r.extracted_facts as { attempts?: unknown[] }).attempts);

      if (!valid) {
        fail++;
        console.error(`  X ${name} (${ms}ms): invalid finding_type=${r.finding_type}`);
        continue;
      }
      if (r.finding_type === 'source_error' && !hasAttempts) {
        fail++;
        console.error(`  X ${name} (${ms}ms): source_error without attempts diagnostic`);
        continue;
      }
      if (r.finding_type === 'insurance_active_wc') {
        pass++;
        console.log(`  OK ${name} (${ms}ms): active WC coverage - ${r.finding_summary}`);
      } else if (r.finding_type === 'source_error') {
        warn++;
        console.log(`  WARN ${name} (${ms}ms): source_error w/ attempts diagnostic - ${r.finding_summary}`);
        const attempts = (r.extracted_facts as { attempts?: Array<Record<string, unknown>> }).attempts ?? [];
        for (const a of attempts) {
          console.log(`      [${a.strategy}] ${a.method} ${a.http_status ?? a.error}  duration=${a.duration_ms}ms`);
        }
      } else {
        warn++;
        console.log(`  WARN ${name} (${ms}ms): ${r.finding_type} - ${r.finding_summary}`);
      }
    } catch (e: unknown) {
      fail++;
      console.error(`  X ${name}: unhandled throw - ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\nRESULT_JSON: ${JSON.stringify({ pass, warn, fail, total: TARGETS.length })}`);
  if (fail > 0) {
    console.error('SMOKE FAILED - fix before commit');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[smoke] top-level crash', e);
  process.exit(1);
});
