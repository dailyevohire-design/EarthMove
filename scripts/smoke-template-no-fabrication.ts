// Smoke test: assert the templated fallback does NOT fabricate red flags
// when no backing evidence exists in trust_evidence.
//
// Reference job: Austin Industries forensic (bb5cfa83). Earlier results showed
// the templated_after_stall fallback stamping "Phoenix-company pattern
// indicators present" red flag despite ZERO phoenix evidence rows. This smoke
// confirms the gate flips that fabricated output back to silence.
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Project keys live in .env.local, not .env — load explicitly.
dotenvConfig({ path: resolve(process.cwd(), '.env.local') });
import {
  hasBackingEvidence,
  evidenceBackedFlags,
  PHOENIX_BACKING_FINDING_TYPES,
  LICENSE_SUSPENDED_BACKING_FINDING_TYPES,
  BUSINESS_INACTIVE_BACKING_FINDING_TYPES,
} from '../src/lib/trust/synth/templated-flag-gate';

let failures = 0;
function pass(label: string) { console.log('OK ' + label); }
function fail(label: string, msg: string) { console.error('X ' + label + ': ' + msg); failures++; }

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sr) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (in .env.local)');
    process.exit(2);
  }
  const supabase = createClient(url, sr);

  // Reference job: Austin Industries forensic. Earlier evidence inspection:
  //   sec_edgar: business_inactive
  //   tx_assessor: business_active
  //   tx_sos_biz: business_active
  //   google_reviews: open_web_verified
  //   (others: no_actions, no_record, no_violation, source_error, etc.)
  // No phoenix_* or license_suspended finding_types in this job.
  const AUSTIN_JOB_ID = 'bb5cfa83-254f-4d99-965a-94af16461987';

  console.log(`[smoke] testing gate against job ${AUSTIN_JOB_ID}`);

  const phoenix = await hasBackingEvidence(supabase, AUSTIN_JOB_ID, PHOENIX_BACKING_FINDING_TYPES);
  const license = await hasBackingEvidence(supabase, AUSTIN_JOB_ID, LICENSE_SUSPENDED_BACKING_FINDING_TYPES);
  const businessInactive = await hasBackingEvidence(supabase, AUSTIN_JOB_ID, BUSINESS_INACTIVE_BACKING_FINDING_TYPES);

  console.log(`  phoenix backing evidence:           ${phoenix}`);
  console.log(`  license_suspended backing evidence: ${license}`);
  console.log(`  business_inactive backing evidence: ${businessInactive}`);

  if (phoenix !== false) fail('phoenix gate', 'should be false (no phoenix evidence rows)');
  else pass('phoenix correctly NOT backed');

  if (license !== false) fail('license_suspended gate', 'should be false (clean record)');
  else pass('license_suspended correctly NOT backed');

  if (businessInactive !== true) fail('business_inactive gate', 'should be true (sec_edgar emitted business_inactive)');
  else pass('business_inactive correctly backed by sec_edgar evidence');

  // Also verify the combined evidenceBackedFlags helper agrees.
  const flags = await evidenceBackedFlags({ supabase, jobId: AUSTIN_JOB_ID });
  if (flags.phoenix !== false || flags.license_suspended !== false || flags.business_inactive !== true) {
    fail('evidenceBackedFlags combined', `unexpected: ${JSON.stringify(flags)}`);
  } else {
    pass('evidenceBackedFlags combined matches per-field');
  }

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log(`\nRESULT_JSON: ${JSON.stringify({
    ok: true,
    job_id: AUSTIN_JOB_ID,
    phoenix_backed: phoenix,
    license_suspended_backed: license,
    business_inactive_backed: businessInactive,
  })}`);
}

main().catch((err) => {
  console.error('[smoke] crashed', err);
  process.exit(1);
});
