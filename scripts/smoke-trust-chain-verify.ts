/**
 * Smoke test for migration 119 — verify_trust_evidence_chain audit function.
 *
 * Inserts a job + 3 evidence rows via append_trust_evidence RPC (the canonical
 * insert path), calls verify_trust_evidence_chain, asserts { total: 3, broken: 0 }.
 * Then deletes the middle row + inserts a synthetic replacement directly with
 * mismatched prev_hash, re-runs verify, asserts broken > 0.
 *
 * All seed data prefixed MIG119_TEST_ and cleaned up in finally{}.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY='...' \
 *     pnpm exec tsx --env-file=.env.local \
 *     scripts/smoke-trust-chain-verify.ts
 */

import { createAdminClient } from '../src/lib/supabase/server';

const PREFIX = 'MIG119_TEST_';

async function main() {
  const admin = createAdminClient();

  // Create a contractor + job to anchor evidence rows.
  // enqueue_trust_job upserts contractor and creates trust_jobs atomically.
  const { data: jobData, error: jobErr } = await admin.rpc('enqueue_trust_job', {
    p_contractor_name: `${PREFIX}Acme Smoke LLC`,
    p_state_code: 'CO',
    p_city: null,
    p_tier: 'free',
    p_user_id: null,
    p_credit_id: null,
    p_idempotency_key: `${PREFIX}smoke-${Date.now()}`,
  });
  if (jobErr) throw new Error(`enqueue_trust_job failed: ${jobErr.message}`);
  const jobRow = Array.isArray(jobData) ? jobData[0] : jobData;
  const jobId = jobRow.id as string;
  const contractorId = jobRow.contractor_id as string;
  console.log(`✓ created job ${jobId} for contractor ${contractorId}`);

  let evidenceIds: string[] = [];
  try {
    // Insert 3 evidence rows via the RPC.
    for (let i = 0; i < 3; i++) {
      const { data, error } = await admin.rpc('append_trust_evidence', {
        p_job_id: jobId,
        p_contractor_id: contractorId,
        p_source_key: `mig119_smoke_source_${i}`,
        p_finding_type: 'business_active',
        p_confidence: 'verified_structured',
        p_finding_summary: `Smoke test row ${i}`,
        p_extracted_facts: { test_index: i },
        p_query_sent: `q=${i}`,
        p_response_sha256: `${'0'.repeat(63)}${i}`,
        p_response_snippet: '{}',
        p_duration_ms: 10,
        p_cost_cents: 0,
        p_source_errored: false,
      });
      if (error) throw new Error(`append_trust_evidence #${i} failed: ${error.message}`);
      const row = Array.isArray(data) ? data[0] : data;
      evidenceIds.push(row.id as string);
      console.log(`  ✓ inserted evidence ${i}: id=${row.id} seq=${row.sequence_number} chain=${(row.chain_hash as string).slice(0, 16)}...`);
    }

    // Initial chain should be intact.
    const { data: v1Data, error: v1Err } = await admin.rpc('verify_trust_evidence_chain', {
      p_job_id: jobId,
    });
    if (v1Err) throw new Error(`verify_trust_evidence_chain failed: ${v1Err.message}`);
    console.log('\n=== verify on intact chain ===');
    console.log(JSON.stringify(v1Data, null, 2));
    if ((v1Data as { total: number; broken: number }).total !== 3) {
      throw new Error(`expected total=3, got ${(v1Data as { total: number }).total}`);
    }
    if ((v1Data as { broken: number }).broken !== 0) {
      throw new Error(`expected broken=0 on intact chain, got ${(v1Data as { broken: number }).broken}`);
    }
    console.log('✓ intact chain: total=3, broken=0');

    // Tamper: DELETE middle row, INSERT synthetic replacement directly
    // (bypassing RPC) with mismatched prev_hash. The mutation trigger blocks
    // UPDATE so DELETE+INSERT is the only tampering vector.
    const middleId = evidenceIds[1];
    const { error: delErr } = await admin
      .from('trust_evidence')
      .delete()
      .eq('id', middleId);
    if (delErr) throw new Error(`delete middle row failed: ${delErr.message}`);

    const { error: insErr } = await admin
      .from('trust_evidence')
      .insert({
        job_id: jobId,
        contractor_id: contractorId,
        source_key: 'mig119_smoke_source_1_TAMPERED',
        sequence_number: 1,
        finding_type: 'business_active',
        confidence: 'verified_structured',
        finding_summary: 'Tampered replacement',
        extracted_facts: { tampered: true },
        query_sent: null,
        response_sha256: 'f'.repeat(64),
        response_snippet: null,
        prev_hash: 'deadbeef'.repeat(8), // wrong on purpose
        chain_hash: 'cafebabe'.repeat(8), // wrong on purpose
        duration_ms: 0,
        cost_cents: 0,
      });
    if (insErr) throw new Error(`insert tampered row failed: ${insErr.message}`);
    console.log('\n✓ tampered: deleted middle row, inserted synthetic with bad prev_hash + chain_hash');

    // Verify should now flag the broken row.
    const { data: v2Data, error: v2Err } = await admin.rpc('verify_trust_evidence_chain', {
      p_job_id: jobId,
    });
    if (v2Err) throw new Error(`verify_trust_evidence_chain (tampered) failed: ${v2Err.message}`);
    console.log('\n=== verify on tampered chain ===');
    console.log(JSON.stringify(v2Data, null, 2));
    if ((v2Data as { broken: number }).broken === 0) {
      throw new Error('expected broken > 0 after tampering, got 0');
    }
    console.log(`✓ tampered chain: broken=${(v2Data as { broken: number }).broken}`);
    console.log('\n=== SMOKE PASSED ===');
  } finally {
    // Cleanup: best-effort. Delete evidence + job + contractor.
    console.log('\n=== cleanup ===');
    await admin.from('trust_evidence').delete().eq('job_id', jobId);
    await admin.from('trust_jobs').delete().eq('id', jobId);
    if (contractorId) {
      await admin.from('contractors').delete().eq('id', contractorId);
    }
    console.log(`✓ cleaned up job ${jobId}, contractor ${contractorId}, all ${PREFIX} evidence rows`);
  }
}

main().catch((err) => {
  console.error('\n=== SMOKE FAILED ===');
  console.error(err);
  process.exit(1);
});
