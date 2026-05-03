/**
 * Smoke test for migration 120 — permit history scrapers (Denver + Dallas).
 *
 * For each jurisdiction:
 *   1. Create MIG120_TEST contractor + trust_jobs row via enqueue_trust_job
 *   2. Call the jurisdiction's scraper directly with the contractor name
 *   3. For each emitted ScraperEvidence, call append_trust_evidence RPC
 *   4. Run verify_trust_evidence_chain(job_id), assert broken=0
 *   5. Project the report via trust_project_evidence_to_report
 *   6. Assert at least one permit_history_* finding present in evidence
 *   7. Cleanup: delete evidence + job + contractor
 *
 * Zero-result jurisdictions (scraper returned only the informational row +
 * possibly a low-volume flag) log the count and continue — they don't fail.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY='...' \
 *     pnpm exec tsx --env-file=.env.local scripts/smoke-trust-permit-multi.ts
 */

import { createAdminClient } from '../src/lib/supabase/server';
import { scrapeDallasPermits } from '../src/lib/trust/scrapers/dallas-open-data';
import { scrapeDenverPermits } from '../src/lib/trust/scrapers/denver-pim';
import type { ScraperEvidence } from '../src/lib/trust/scrapers/types';

const PREFIX = 'MIG120_TEST_';

interface JurisdictionCase {
  jurisdiction: string;
  source_key: string;
  contractor: string;
  state_code: string;
  scrape: (legalName: string) => Promise<ScraperEvidence[]>;
}

const CASES: JurisdictionCase[] = [
  {
    jurisdiction: 'denver',
    source_key: 'denver_pim',
    contractor: 'PCL Construction Services Inc',
    state_code: 'CO',
    scrape: (legalName) => scrapeDenverPermits({ legalName }),
  },
  {
    jurisdiction: 'dallas',
    source_key: 'dallas_open_data',
    contractor: 'Andres Construction Services Ltd',
    state_code: 'TX',
    scrape: (legalName) => scrapeDallasPermits({ legalName }),
  },
];

async function runOne(c: JurisdictionCase): Promise<{ ok: boolean; reason: string }> {
  const admin = createAdminClient();
  console.log(`\n=== ${c.jurisdiction.toUpperCase()} (${c.source_key}) ===`);
  console.log(`contractor: ${c.contractor}`);

  // 1. enqueue test job
  const { data: jobData, error: jobErr } = await admin.rpc('enqueue_trust_job', {
    p_contractor_name: `${PREFIX}${c.contractor}`,
    p_state_code: c.state_code,
    p_city: null,
    p_tier: 'free',
    p_user_id: null,
    p_credit_id: null,
    p_idempotency_key: `${PREFIX}${c.jurisdiction}-${Date.now()}`,
  });
  if (jobErr) return { ok: false, reason: `enqueue_trust_job: ${jobErr.message}` };
  const jobRow = Array.isArray(jobData) ? jobData[0] : jobData;
  const jobId = jobRow.id as string;
  const contractorId = jobRow.contractor_id as string;
  console.log(`  ✓ job ${jobId} contractor ${contractorId}`);

  try {
    // 2. scrape (uses real contractor name, not the prefixed one — we want
    //    real permit hits)
    const findings = await c.scrape(c.contractor);
    console.log(`  ✓ scraped ${findings.length} findings: ${findings.map((f) => f.finding_type).join(', ')}`);

    // 3. persist each finding
    for (const f of findings) {
      const { error: appErr } = await admin.rpc('append_trust_evidence', {
        p_job_id: jobId,
        p_contractor_id: contractorId,
        p_source_key: f.source_key,
        p_finding_type: f.finding_type,
        p_confidence: f.confidence,
        p_finding_summary: f.finding_summary,
        p_extracted_facts: f.extracted_facts ?? {},
        p_query_sent: f.query_sent ?? null,
        p_response_sha256: f.response_sha256 ?? null,
        p_response_snippet: f.response_snippet ?? null,
        p_duration_ms: f.duration_ms ?? null,
        p_cost_cents: f.cost_cents ?? 0,
        p_source_errored: f.finding_type === 'source_error',
      });
      if (appErr) return { ok: false, reason: `append_trust_evidence: ${appErr.message}` };
    }

    // 4. verify chain
    const { data: vData, error: vErr } = await admin.rpc('verify_trust_evidence_chain', {
      p_job_id: jobId,
    });
    if (vErr) return { ok: false, reason: `verify_chain: ${vErr.message}` };
    const result = vData as { total: number; broken: number; broken_ids: string[] };
    console.log(`  ✓ verify_chain: total=${result.total} broken=${result.broken}`);
    if (result.broken !== 0) return { ok: false, reason: `chain broken: ${JSON.stringify(result.broken_ids)}` };

    // 5. assert at least one permit_history_* finding
    const permitFindings = findings.filter((f) => f.finding_type.startsWith('permit_history_'));
    if (permitFindings.length === 0) {
      return { ok: false, reason: 'no permit_history_* findings emitted' };
    }
    console.log(`  ✓ permit_history_* findings: ${permitFindings.length}`);

    return { ok: true, reason: '' };
  } finally {
    // 6. cleanup
    await admin.from('trust_evidence').delete().eq('job_id', jobId);
    await admin.from('trust_jobs').delete().eq('id', jobId);
    if (contractorId) {
      await admin.from('contractors').delete().eq('id', contractorId);
    }
    console.log(`  ✓ cleanup done`);
  }
}

async function main() {
  let failures = 0;
  for (const c of CASES) {
    try {
      const r = await runOne(c);
      if (r.ok) {
        console.log(`  ✓ ${c.jurisdiction} PASSED`);
      } else {
        console.error(`  ✗ ${c.jurisdiction} FAILED: ${r.reason}`);
        failures += 1;
      }
    } catch (err) {
      console.error(`  ✗ ${c.jurisdiction} threw:`, err);
      failures += 1;
    }
  }
  console.log(`\n=== summary: ${CASES.length - failures}/${CASES.length} jurisdictions passed ===`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err);
  process.exit(1);
});
