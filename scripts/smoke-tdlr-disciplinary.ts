/**
 * Smoke test for tdlr_disciplinary scraper via the Serper provider.
 *
 * Gitignored (scripts/.gitignore). One-shot. Not committed.
 *
 * Run:
 *   SERPER_API_KEY=... SEARCH_PROVIDER=serper pnpm tsx scripts/smoke-tdlr-disciplinary.ts
 */

import { scrapeTdlrDisciplinary } from '../src/lib/trust/scrapers/tdlr-disciplinary';
import {
  ScraperAuthError,
  ScraperRateLimitError,
  ScraperTimeoutError,
  ScraperUpstreamError,
  type ScraperEvidence,
} from '../src/lib/trust/scrapers/types';

interface Target {
  legalName: string;
  note: string;
}

const TARGETS: Target[] = [
  {
    legalName: 'PRO SERVICE MECHANICAL LLC',
    note: 'known active — expect license_no_record, verified_structured',
  },
  {
    legalName: 'Sparky Joe Electric LLC',
    note: 'no-match false-positive test — expect license_no_record, verified_structured',
  },
  {
    legalName: 'Acme Electric',
    note: 'common name test — expect either no_record or finding rows, never crash',
  },
];

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '(n/a)';
  if (typeof v === 'string') return v;
  return String(v);
}

async function smokeOne(target: Target): Promise<void> {
  console.log(`\n── ${target.legalName} (TX) — ${target.note}`);
  const start = Date.now();
  try {
    const result = await scrapeTdlrDisciplinary({
      legalName: target.legalName,
      stateCode: 'TX',
    });
    const elapsed = Date.now() - start;
    const rows: ScraperEvidence[] = Array.isArray(result) ? result : [result];
    console.log(`  elapsed: ${elapsed}ms | rows: ${rows.length}`);
    for (const [i, row] of rows.entries()) {
      const facts = row.extracted_facts as Record<string, unknown>;
      console.log(
        `  [${i}] finding_type=${row.finding_type}  confidence=${row.confidence}`,
      );
      console.log(
        `      summary: ${(row.finding_summary ?? '').slice(0, 100)}`,
      );
      console.log(
        `      search_provider=${fmt(facts.search_provider)}  match_source=${fmt(facts.match_source)}  sanction_keyword=${fmt(facts.sanction_keyword)}`,
      );
    }
  } catch (err: unknown) {
    const elapsed = Date.now() - start;
    if (err instanceof ScraperAuthError) {
      console.log(`  ScraperAuthError after ${elapsed}ms: ${err.message}`);
    } else if (err instanceof ScraperRateLimitError) {
      console.log(
        `  ScraperRateLimitError after ${elapsed}ms: ${err.message}  retry_after=${err.retryAfterSec}`,
      );
    } else if (err instanceof ScraperTimeoutError) {
      console.log(`  ScraperTimeoutError after ${elapsed}ms: ${err.message}`);
    } else if (err instanceof ScraperUpstreamError) {
      console.log(
        `  ScraperUpstreamError after ${elapsed}ms: status=${err.status} ${err.message}`,
      );
    } else {
      const name = err instanceof Error ? err.constructor.name : typeof err;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  UNEXPECTED ${name} after ${elapsed}ms: ${msg}`);
    }
  }
}

async function main(): Promise<void> {
  console.log('═══ tdlr_disciplinary smoke (Serper provider) ═══');
  console.log(
    `SEARCH_PROVIDER=${process.env.SEARCH_PROVIDER ?? '(unset, code default = serper)'}`,
  );
  console.log(
    `SERPER_API_KEY=${process.env.SERPER_API_KEY ? '(set)' : '(NOT SET — auth will fail)'}`,
  );
  for (const target of TARGETS) {
    await smokeOne(target);
  }
  console.log('\n═══ done ═══');
}

main().catch((err: unknown) => {
  console.error('FATAL:', err);
  process.exit(1);
});
