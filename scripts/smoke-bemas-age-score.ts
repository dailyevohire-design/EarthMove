import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const inngest = new Inngest({ id: 'smoke-bemas', eventKey: process.env.INNGEST_EVENT_KEY! });

(async () => {
  const idempotency_key = `BEMAS_AGE_SMOKE_${Date.now()}`;
  const { data, error } = await supabase.rpc('enqueue_trust_job', {
    p_contractor_name: 'Bemas Construction',
    p_state_code: 'CO',
    p_city: 'Denver',
    p_tier: 'standard',
    p_user_id: null,
    p_credit_id: null,
    p_idempotency_key: idempotency_key,
  });
  if (error || !data) { console.error('enqueue failed:', error?.message ?? 'no data'); process.exit(1); }
  const job = Array.isArray(data) ? data[0] : data;
  const job_id = job.id;
  console.log(`enqueued job_id=${job_id}, idempotency_key=${idempotency_key}`);

  await inngest.send({ name: 'trust/job.requested.v2', data: { job_id } });
  console.log(`sent trust/job.requested.v2`);

  // Poll up to 90s
  for (let i = 0; i < 18; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data: j } = await supabase.from('trust_jobs').select('status').eq('id', job_id).single();
    process.stdout.write(`[${i*5+5}s] status=${j?.status} `);
    if (j?.status === 'completed' || j?.status === 'failed') {
      console.log('\n');
      break;
    }
  }

  const { data: ev } = await supabase.from('trust_evidence').select('source_key, finding_type, extracted_facts').eq('job_id', job_id).eq('source_key', 'co_sos_biz').eq('finding_type', 'business_active').single();
  console.log(`\n=== co_sos_biz business_active extracted_facts.formation_date ===`);
  console.log(`  formation_date: ${ev?.extracted_facts?.formation_date ?? 'NULL'}`);

  const { data: cts } = await supabase.from('contractor_trust_scores').select('composite_score, license_score, business_entity_score, age_score, inputs_snapshot').eq('job_id', job_id).single();
  console.log(`\n=== score row ===`);
  console.log(`  composite=${cts?.composite_score} license=${cts?.license_score} business=${cts?.business_entity_score} age=${cts?.age_score}`);
  console.log(`  inputs_snapshot.formation_date=${cts?.inputs_snapshot?.formation_date} age_days=${cts?.inputs_snapshot?.age_days}`);

  if (ev?.extracted_facts?.formation_date && cts?.age_score !== null) {
    console.log(`\n✓ PASS: parseCoDate ISO 8601 fix is in effect`);
  } else {
    console.log(`\n✗ FAIL: parseCoDate fix NOT in effect (formation_date=${ev?.extracted_facts?.formation_date}, age_score=${cts?.age_score})`);
    process.exit(1);
  }
})();
