import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import type { ScraperEvidence } from '../src/lib/trust/scrapers/types';
import { scrapeStateAgEnforcement, _resetStateAgThrottle } from '../src/lib/trust/scrapers/state-ag-enforcement';

interface Subject {
  label: string;
  contractor_name: string;
  state_code: string;
  pass: (ev: ScraperEvidence[]) => boolean;
  expectedNote?: string;
}

const SUBJECTS: Subject[] = [
  {
    label: 'Judge DFW LLC (TX) — known $5M fraud subject',
    contractor_name: 'Judge DFW LLC',
    state_code: 'TX',
    pass: (ev) =>
      ev.length >= 1 &&
      (ev[0].finding_type === 'legal_no_actions' ||
        ev[0].finding_type === 'legal_action_found' ||
        ev[0].finding_type === 'legal_judgment_against'),
    expectedNote: 'any of legal_no_actions / legal_action_found / legal_judgment_against',
  },
  {
    label: 'Clean Denver baseline — Brannan Sand & Gravel',
    contractor_name: 'Brannan Sand & Gravel',
    state_code: 'CO',
    pass: (ev) => ev.length === 1 && ev[0].finding_type === 'legal_no_actions',
    expectedNote: 'exactly legal_no_actions',
  },
  {
    label: 'CO AG action target — Plains Building Systems, LLC (Morgan County felony theft, charged 8/3/22)',
    contractor_name: 'Plains Building Systems, LLC',
    state_code: 'CO',
    pass: (ev) =>
      ev.some((e) => e.finding_type === 'legal_action_found' || e.finding_type === 'legal_judgment_against'),
    expectedNote: '≥1 legal_action_found or legal_judgment_against',
  },
  {
    label: 'Out-of-scope state (FL) — must skip',
    contractor_name: 'Acme Roofing',
    state_code: 'FL',
    pass: (ev) => ev.length === 1 && ev[0].finding_type === 'source_not_applicable',
    expectedNote: 'exactly source_not_applicable',
  },
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const s of SUBJECTS) {
    _resetStateAgThrottle();
    console.log(`\n===== ${s.label} =====`);
    console.log(`  contractor=${s.contractor_name} state=${s.state_code}`);
    console.log(`  expected: ${s.expectedNote ?? '(custom)'}`);
    try {
      const ev = await scrapeStateAgEnforcement({
        legalName: s.contractor_name,
        stateCode: s.state_code,
      });

      const types: Record<string, number> = {};
      const classified: Record<string, number> = {};
      let realCount = 0;
      let withCitation = 0;
      const dates: Array<string | null> = [];
      const urls: string[] = [];

      for (const e of ev) {
        types[e.finding_type] = (types[e.finding_type] ?? 0) + 1;
        const ef = e.extracted_facts as { citation_url?: string | null; classified_action?: string; action_date?: string | null; url?: string };
        if (e.finding_type !== 'legal_no_actions' && e.finding_type !== 'source_not_applicable') {
          realCount++;
        }
        if (typeof ef.citation_url === 'string' && ef.citation_url.startsWith('http')) {
          withCitation++;
        }
        if (typeof ef.classified_action === 'string') {
          classified[ef.classified_action] = (classified[ef.classified_action] ?? 0) + 1;
        }
        dates.push(ef.action_date ?? null);
        if (typeof ef.url === 'string') urls.push(ef.url);
      }

      console.log(`  evidence rows: ${ev.length}  finding_type breakdown: ${JSON.stringify(types)}`);
      if (Object.keys(classified).length > 0) {
        console.log(`  classified_action breakdown: ${JSON.stringify(classified)}`);
      }
      console.log(`  real findings: ${realCount}  with citation_url: ${withCitation}`);
      if (urls.length > 0) {
        console.log(`  URLs (up to 3):`);
        for (const u of urls.slice(0, 3)) console.log(`    - ${u}`);
      }
      if (dates.some((d) => d)) {
        console.log(`  action_dates: ${dates.filter(Boolean).slice(0, 5).join(', ')}`);
      }
      if (ev[0]) {
        console.log(`  sample summary: ${ev[0].finding_summary}`);
      }

      const ok = s.pass(ev);
      if (ok) {
        console.log('  ✅ PASS');
        passed++;
      } else {
        console.log(`  ❌ FAIL — ${s.expectedNote ?? '(custom criterion not met)'}`);
        failed++;
      }
    } catch (e: unknown) {
      console.error(`  ❌ ERROR: ${e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e)}`);
      failed++;
    }
  }
  console.log(`\n===== ${passed}/${passed + failed} PASSED =====`);
  process.exit(failed === 0 ? 0 : 1);
})();
