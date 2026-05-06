import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { scrapeCourtListenerFed, _resetCourtListenerThrottle } from '../src/lib/trust/scrapers/courtlistener-fed';

const SUBJECTS = [
  { name: 'Judge DFW LLC',                expect: { kind: 'no_actions', max: 0 } },
  { name: 'Bemas Construction',           expect: { kind: 'no_actions', max: 0 } },
  { name: 'PCL Construction Services',    expect: { kind: 'capped',      max: 14 } },
  { name: 'Toll Brothers',                expect: { kind: 'min',         min: 3 } },
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const s of SUBJECTS) {
    _resetCourtListenerThrottle();
    console.log(`\n===== ${s.name} =====`);
    try {
      const evs = await scrapeCourtListenerFed({ legalName: s.name });
      const types = evs.map((e) => e.finding_type);
      const noActions = evs.filter((e) => e.finding_type === 'legal_no_actions');
      const real = evs.filter((e) => e.finding_type !== 'legal_no_actions');
      const withCitation = real.filter((e) => {
        const ef = e.extracted_facts as { citation_url?: string | null };
        return typeof ef.citation_url === 'string' && ef.citation_url.startsWith('https://');
      });

      console.log(`  evidence rows: ${evs.length}  types: ${types.join(', ')}`);
      console.log(`  real findings: ${real.length}  with citation_url: ${withCitation.length}`);
      const sampleEv = real[0] ?? noActions[0];
      if (sampleEv) {
        console.log(`  sample: ${sampleEv.finding_summary}`);
        const ef = sampleEv.extracted_facts as Record<string, unknown>;
        if ('totalRawCount' in ef) {
          console.log(`  diag: rawCount=${ef.totalRawCount} scanned=${ef.scannedCount} dropPartyMismatch=${ef.droppedPartyMismatch} dropPlaintiffAmb=${ef.droppedPlaintiffOrAmbiguous} dropNos=${ef.droppedNosOutOfAllowlist}`);
        }
      }

      // Pass criteria
      let ok = false;
      let reason = '';
      if (s.expect.kind === 'no_actions') {
        ok = real.length === 0 && noActions.length === 1;
        reason = `expected legal_no_actions only; got ${real.length} real findings`;
      } else if (s.expect.kind === 'capped') {
        ok = real.length > 0 && real.length < (s.expect.max as number);
        reason = `expected 1..${s.expect.max} real findings; got ${real.length}`;
      } else if (s.expect.kind === 'min') {
        const minCitations = (s.expect.min as number);
        ok = withCitation.length >= minCitations;
        reason = `expected >=${minCitations} real findings with valid citation_url; got ${withCitation.length}`;
      }
      if (ok) {
        console.log(`  ✅ PASS`);
        passed++;
      } else {
        console.log(`  ❌ FAIL — ${reason}`);
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
