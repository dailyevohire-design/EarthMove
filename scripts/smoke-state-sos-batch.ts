// Smoke test: hit all 7 newly-built state SOS scrapers against known entities.
// Pass = each scraper returns a valid finding_type:
//   business_active | business_inactive | business_dissolved | business_not_found
//   | source_error WITH attempts diagnostic captured (Pattern H)
// FAIL = unhandled throw OR source_error with NO attempts captured.

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
import { scrapeFlSunbiz } from '../src/lib/trust/scrapers/state-entity/fl-sunbiz';
import { scrapeOrSosBiz } from '../src/lib/trust/scrapers/state-entity/or-sos-biz';
import { scrapeAzEcorp } from '../src/lib/trust/scrapers/state-entity/az-ecorp';
import { scrapeGaSosBiz } from '../src/lib/trust/scrapers/state-entity/ga-sos-biz';
import { scrapeNySosBiz } from '../src/lib/trust/scrapers/state-entity/ny-sos-biz';
import { scrapeWaSosBiz } from '../src/lib/trust/scrapers/state-entity/wa-sos-biz';
import { scrapeNcSosBiz } from '../src/lib/trust/scrapers/state-entity/nc-sos-biz';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

interface ProbeCase {
  source_key: string;
  target: string;
  expected_finding: string;
  fn: (n: string) => Promise<{
    finding_type: string;
    finding_summary: string;
    extracted_facts: Record<string, unknown>;
  }>;
}

const PROBES: ProbeCase[] = [
  { source_key: 'fl_sunbiz',  target: 'WALT DISNEY PARKS AND RESORTS U.S., INC.', expected_finding: 'business_active', fn: scrapeFlSunbiz },
  { source_key: 'or_sos_biz', target: 'NIKE, INC.',                                expected_finding: 'business_active', fn: scrapeOrSosBiz },
  { source_key: 'az_ecorp',   target: 'SUNDT CONSTRUCTION INC',                    expected_finding: 'business_active', fn: scrapeAzEcorp },
  { source_key: 'ga_sos_biz', target: 'HOME DEPOT U.S.A., INC.',                   expected_finding: 'business_active', fn: scrapeGaSosBiz },
  { source_key: 'ny_sos_biz', target: 'TRUMP ORGANIZATION LLC',                    expected_finding: 'business_active', fn: scrapeNySosBiz },
  { source_key: 'wa_sos_biz', target: 'THE BOEING COMPANY',                        expected_finding: 'business_active', fn: scrapeWaSosBiz },
  { source_key: 'nc_sos_biz', target: 'BANK OF AMERICA CORPORATION',               expected_finding: 'business_active', fn: scrapeNcSosBiz },
];

async function main() {
  console.log(`[smoke] running ${PROBES.length} state SOS probes`);
  let pass = 0;
  let warn = 0;
  let fail = 0;
  const results: Array<{ source_key: string; finding_type: string; ok: boolean; note: string }> = [];

  for (const probe of PROBES) {
    const t0 = Date.now();
    try {
      const r = await probe.fn(probe.target);
      const ms = Date.now() - t0;
      const validFindingTypes = [
        'business_active',
        'business_inactive',
        'business_dissolved',
        'business_not_found',
        'source_error',
      ];
      const validFinding = validFindingTypes.includes(r.finding_type);
      const hasAttempts = Array.isArray((r.extracted_facts as { attempts?: unknown[] }).attempts);

      if (!validFinding) {
        fail++;
        console.error(`  X ${probe.source_key} (${ms}ms): INVALID finding_type=${r.finding_type}`);
        results.push({ source_key: probe.source_key, finding_type: r.finding_type, ok: false, note: 'invalid finding_type' });
        continue;
      }

      if (r.finding_type === 'source_error' && !hasAttempts) {
        fail++;
        console.error(`  X ${probe.source_key} (${ms}ms): source_error WITHOUT attempts diagnostic (Pattern H violation)`);
        results.push({ source_key: probe.source_key, finding_type: r.finding_type, ok: false, note: 'no attempts captured' });
        continue;
      }

      if (r.finding_type === probe.expected_finding) {
        pass++;
        console.log(`  OK ${probe.source_key} (${ms}ms): ${r.finding_type} - ${r.finding_summary}`);
      } else if (r.finding_type === 'source_error') {
        warn++;
        console.log(`  WARN ${probe.source_key} (${ms}ms): ${r.finding_type} (structured w/ attempts) - ${r.finding_summary}`);
      } else {
        warn++;
        console.log(`  WARN ${probe.source_key} (${ms}ms): ${r.finding_type} (expected ${probe.expected_finding}) - ${r.finding_summary}`);
      }
      results.push({ source_key: probe.source_key, finding_type: r.finding_type, ok: true, note: r.finding_summary.slice(0, 80) });
    } catch (e: unknown) {
      fail++;
      console.error(`  X ${probe.source_key}: UNHANDLED THROW - ${e instanceof Error ? e.message : String(e)}`);
      results.push({ source_key: probe.source_key, finding_type: 'throw', ok: false, note: e instanceof Error ? e.message : String(e) });
    }
  }

  console.log(`\n[smoke] pass=${pass} warn=${warn} fail=${fail} (of ${PROBES.length})`);
  console.log(`RESULT_JSON: ${JSON.stringify({ pass, warn, fail, total: PROBES.length, results })}`);

  if (fail > 0) {
    console.error('\nSMOKE FAILED - at least one probe threw unhandled or returned invalid finding_type');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[smoke] top-level crash', e);
  process.exit(1);
});
