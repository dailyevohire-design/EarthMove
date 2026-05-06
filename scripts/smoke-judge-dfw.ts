import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const inngest = new Inngest({ id: 'smoke-judge-dfw', eventKey: process.env.INNGEST_EVENT_KEY! });

const NAME = 'Judge DFW LLC';
const STATE = 'TX';
const CITY = null; // let pipeline figure out city
const TIER = 'deep_dive';

(async () => {
  const idemKey = `JUDGE_DFW_DEEPDIVE_${Date.now()}`;
  const { data, error } = await supabase.rpc('enqueue_trust_job', {
    p_contractor_name: NAME,
    p_state_code: STATE,
    p_city: CITY,
    p_tier: TIER,
    p_user_id: null,
    p_credit_id: null,
    p_idempotency_key: idemKey,
  });
  if (error || !data) { console.error('enqueue failed:', error?.message ?? 'no data'); process.exit(1); }
  const job = Array.isArray(data) ? data[0] : data;
  console.log(`enqueued job_id=${job.id} contractor_id=${job.contractor_id} tier=${TIER} idem=${idemKey}`);

  await inngest.send({ name: 'trust/job.requested.v2', data: { job_id: job.id } });
  console.log(`sent trust/job.requested.v2`);

  // Poll up to 5 minutes (deep_dive is Opus, slower than standard)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data: j } = await supabase.from('trust_jobs')
      .select('status, error_message, total_cost_cents')
      .eq('id', job.id)
      .single();
    process.stdout.write(`[${(i + 1) * 5}s] status=${j?.status} cost=${j?.total_cost_cents ?? 0}c `);
    if (j?.status === 'completed' || j?.status === 'failed') {
      console.log('');
      if (j.status === 'failed') {
        console.error(`\nFAILED: ${j.error_message}`);
        process.exit(2);
      }
      break;
    }
  }

  // Pull the full report
  const { data: report } = await supabase.from('trust_reports')
    .select('id, trust_score, summary, red_flags, positive_indicators, evidence_ids, created_at')
    .eq('job_id', job.id)
    .single();

  const { data: cts } = await supabase.from('contractor_trust_scores')
    .select('composite_score, grade, risk_level, license_score, business_entity_score, legal_score, osha_score, bbb_score, phoenix_score, age_score, sanction_hit, license_suspended, inputs_snapshot')
    .eq('job_id', job.id)
    .single();

  const { data: ev } = await supabase.from('trust_evidence')
    .select('source_key, finding_type, confidence, finding_summary, extracted_facts')
    .eq('job_id', job.id)
    .order('source_key');

  console.log('\n========================================');
  console.log('=== CONSUMER-FACING REPORT (deep_dive) ===');
  console.log('========================================\n');
  console.log(`Contractor: ${NAME} (${STATE})`);
  console.log(`Trust Score: ${report?.trust_score} / 100`);
  console.log(`Grade: ${cts?.grade}  Risk Level: ${cts?.risk_level}`);
  console.log(`Sanction hit: ${cts?.sanction_hit}  License suspended: ${cts?.license_suspended}`);
  console.log('');
  console.log(`Sub-scores:`);
  console.log(`  license:         ${cts?.license_score ?? 'NULL'}`);
  console.log(`  business_entity: ${cts?.business_entity_score ?? 'NULL'}`);
  console.log(`  legal:           ${cts?.legal_score ?? 'NULL'}`);
  console.log(`  osha:            ${cts?.osha_score ?? 'NULL'}`);
  console.log(`  bbb:             ${cts?.bbb_score ?? 'NULL'}`);
  console.log(`  phoenix:         ${cts?.phoenix_score ?? 'NULL'}`);
  console.log(`  age:             ${cts?.age_score ?? 'NULL'}`);
  console.log(`  permit:          ${cts?.inputs_snapshot?.permit_score ?? 'NULL'} (${cts?.inputs_snapshot?.permit_finding ?? 'NULL'})`);
  console.log('');
  console.log(`Summary:`);
  console.log(`  ${report?.summary}\n`);

  console.log(`Red flags (${(report?.red_flags ?? []).length}):`);
  for (const rf of (report?.red_flags ?? [])) {
    console.log(`  - ${typeof rf === 'string' ? rf : rf.text}`);
  }
  console.log('');

  console.log(`Positive indicators (${(report?.positive_indicators ?? []).length}):`);
  for (const pi of (report?.positive_indicators ?? [])) {
    console.log(`  - ${typeof pi === 'string' ? pi : pi.text}`);
  }
  console.log('');

  console.log(`Raw evidence (${(ev ?? []).length} rows):`);
  for (const e of (ev ?? [])) {
    console.log(`  [${e.source_key}/${e.finding_type}/${e.confidence}] ${e.finding_summary}`);
  }
  console.log('');

  console.log(`Run cost: ${cts?.composite_score ? '$' + (Number(cts?.inputs_snapshot?.weakest_category_score ?? 0) / 100).toFixed(2) : 'unknown'}`);
  console.log(`job_id: ${job.id}`);
  console.log(`report_id: ${report?.id}`);
})();
