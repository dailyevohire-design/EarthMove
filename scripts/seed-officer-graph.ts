/**
 * Seed the officer graph with real CO contractor data.
 *
 * Phase 1: query CO SOS Socrata (data.colorado.gov/resource/4ykn-tg5h.json) for
 *          small Denver-metro construction LLCs in Good Standing.
 * Phase 2: enqueue each via enqueue_trust_job RPC + fire trust/job.requested.v2
 *          Inngest event (concurrency 5, all in parallel).
 * Phase 3: poll trust_jobs.status until all reach 'completed' or 'failed' or
 *          a 240s overall timeout.
 * Phase 4: report final job_ids + total trust_officer_links rows added.
 *
 * Filter (Phase 1):
 *   - entitytype = DLLC (domestic LLC)
 *   - entitystatus = Good Standing
 *   - entityname LIKE '%CONSTRUCTION%' or '%CONTRACTOR%' or '%BUILDERS%'
 *   - principalcity ∈ Denver-metro list (Denver, Aurora, Lakewood, Westminster,
 *     Centennial, Englewood, Wheat Ridge, Arvada, Thornton, Littleton)
 *   - limit 5 (Socrata default ordering, not deterministic across calls)
 *
 * Usage:
 *   pnpm exec tsx --env-file=.env.local scripts/seed-officer-graph.ts --phase 1
 *   pnpm exec tsx --env-file=.env.local scripts/seed-officer-graph.ts
 *
 * Prereqs: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY +
 *          INNGEST_EVENT_KEY (for phase 2+).
 */

import { createAdminClient } from '../src/lib/supabase/server';
import { inngest } from '../src/lib/inngest';

const SOCRATA_ENDPOINT = 'https://data.colorado.gov/resource/4ykn-tg5h.json';
const TARGET_COUNT = 45;
const OFFSET = 5;
const POLL_MS = 10_000;
const TIMEOUT_MS = 600_000;  // 10 min — 45 jobs × ~40s / Inngest-concurrency 5 ≈ 6 min + slack

const DENVER_METRO = [
  'DENVER', 'AURORA', 'LAKEWOOD', 'WESTMINSTER', 'CENTENNIAL',
  'ENGLEWOOD', 'WHEAT RIDGE', 'ARVADA', 'THORNTON', 'LITTLETON',
];

const NAME_KEYWORDS = [
  'CONSTRUCTION', 'EXCAVATION', 'EARTHWORK', 'GRADING', 'CONCRETE',
  'REMODEL', 'BUILDERS', 'CONTRACTING', 'ROOFING', 'PLUMBING',
];

interface CoSosRow {
  entityid: string;
  entityname: string;
  entitystatus: string;
  entitytype: string;
  entityformdate?: string;
  principalcity?: string;
  principaladdress1?: string;
  agentfirstname?: string;
  agentlastname?: string;
  agentorganizationname?: string;
}

async function phase1Query(): Promise<CoSosRow[]> {
  const cityList = DENVER_METRO.map((c) => `'${c}'`).join(',');
  const nameOr = NAME_KEYWORDS
    .map((kw) => `upper(entityname) like '%${kw}%'`)
    .join(' OR ');
  const where = [
    `entitytype = 'DLLC'`,
    `entitystatus = 'Good Standing'`,
    `(${nameOr})`,
    `upper(principalcity) in (${cityList})`,
  ].join(' AND ');
  const url = `${SOCRATA_ENDPOINT}?$where=${encodeURIComponent(where)}&$limit=${TARGET_COUNT}&$offset=${OFFSET}`;

  console.log(`[seed] phase 1: querying CO SOS Socrata`);
  console.log(`[seed]   ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`CO SOS query failed: HTTP ${resp.status}`);
  }
  const rows = (await resp.json()) as CoSosRow[];
  console.log(`[seed]   returned ${rows.length} rows`);
  for (const r of rows) {
    const agent = r.agentorganizationname?.trim()
      ? `agent_org=${r.agentorganizationname.trim()}`
      : `agent=${(r.agentfirstname ?? '').trim()} ${(r.agentlastname ?? '').trim()}`.trim();
    console.log(
      `[seed]   - ${r.entityname} | ${r.principalcity ?? '?'} | formed ${r.entityformdate ?? '?'} | ${agent}`,
    );
  }
  return rows;
}

interface DispatchedJob {
  candidate: CoSosRow;
  jobId: string;
  contractorId: string | null;
  startedAt: number;
}

async function phase2EnqueueAll(candidates: CoSosRow[]): Promise<DispatchedJob[]> {
  const admin = createAdminClient();
  console.log(`[seed] phase 2: enqueueing ${candidates.length} jobs in parallel`);

  const dispatched = await Promise.all(
    candidates.map(async (c) => {
      const idempotencyKey = `SEEDOG_${Date.now()}_${c.entityid}`;
      const { data, error } = await admin.rpc('enqueue_trust_job', {
        p_contractor_name: c.entityname,
        p_state_code: 'CO',
        p_city: c.principalcity ?? null,
        p_tier: 'standard',
        p_user_id: null,
        p_credit_id: null,
        p_idempotency_key: idempotencyKey,
      });
      if (error) {
        console.error(`[seed]   enqueue FAIL ${c.entityname}: ${error.message}`);
        return null;
      }
      const job = (Array.isArray(data) ? data[0] : data) as { id?: string; contractor_id?: string | null } | null;
      if (!job?.id) {
        console.error(`[seed]   enqueue returned no id for ${c.entityname}`);
        return null;
      }

      try {
        await inngest.send({
          name: 'trust/job.requested.v2',
          data: { job_id: job.id },
        });
      } catch (err) {
        console.error(`[seed]   inngest.send FAIL ${c.entityname}: ${err instanceof Error ? err.message : err}`);
        return null;
      }

      console.log(`[seed]   ✓ ${c.entityname} → job_id=${job.id}`);
      return {
        candidate: c,
        jobId: job.id,
        contractorId: job.contractor_id ?? null,
        startedAt: Date.now(),
      } satisfies DispatchedJob;
    }),
  );

  return dispatched.filter((d): d is DispatchedJob => d !== null);
}

interface JobStatusRow {
  id: string;
  status: string;
  evidence_count: number | null;
  sources_completed: number | null;
  sources_failed: number | null;
  total_sources_planned: number | null;
  error_message: string | null;
}

async function phase3Poll(dispatched: DispatchedJob[]): Promise<Map<string, JobStatusRow>> {
  const admin = createAdminClient();
  const terminal = new Map<string, JobStatusRow>();
  const deadline = Date.now() + TIMEOUT_MS;

  console.log(`[seed] phase 3: polling ${dispatched.length} jobs (timeout=${TIMEOUT_MS}ms, poll=${POLL_MS}ms)`);

  while (terminal.size < dispatched.length && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const pending = dispatched.filter((d) => !terminal.has(d.jobId)).map((d) => d.jobId);
    const { data, error } = await admin
      .from('trust_jobs')
      .select('id, status, evidence_count, sources_completed, sources_failed, total_sources_planned, error_message')
      .in('id', pending);

    if (error) {
      console.error(`[seed]   poll error: ${error.message}`);
      continue;
    }

    for (const row of (data ?? []) as JobStatusRow[]) {
      if (row.status === 'completed' || row.status === 'failed') {
        terminal.set(row.id, row);
        const d = dispatched.find((x) => x.jobId === row.id)!;
        const elapsed = ((Date.now() - d.startedAt) / 1000).toFixed(1);
        console.log(
          `[seed]   ✓ DONE ${d.candidate.entityname} | status=${row.status} ` +
          `evidence=${row.evidence_count ?? 0} ` +
          `sources=${row.sources_completed ?? 0}/${row.total_sources_planned ?? 0} ` +
          `failed=${row.sources_failed ?? 0} elapsed=${elapsed}s` +
          (row.error_message ? ` err="${row.error_message}"` : ''),
        );
      }
    }
  }

  return terminal;
}

async function phase4Report(dispatched: DispatchedJob[], terminal: Map<string, JobStatusRow>): Promise<void> {
  const admin = createAdminClient();
  const contractorIds = dispatched
    .map((d) => d.contractorId)
    .filter((id): id is string => typeof id === 'string');

  // Count officer_links for these contractors AT THE END (post-synth)
  let linkCount = 0;
  if (contractorIds.length > 0) {
    const { count, error } = await admin
      .from('trust_officer_links')
      .select('id', { count: 'exact', head: true })
      .in('contractor_id', contractorIds);
    if (error) {
      console.error(`[seed]   officer_links count error: ${error.message}`);
    } else {
      linkCount = count ?? 0;
    }
  }

  const completed = Array.from(terminal.values()).filter((r) => r.status === 'completed').length;
  const failed = Array.from(terminal.values()).filter((r) => r.status === 'failed').length;
  const incomplete = dispatched.length - terminal.size;

  console.log('');
  console.log(`[seed] phase 4: summary`);
  console.log(`[seed]   dispatched=${dispatched.length} completed=${completed} failed=${failed} timed_out=${incomplete}`);
  console.log(`[seed]   officer_links rows for these contractors: ${linkCount}`);
  console.log('');
  console.log(`[seed] job_ids:`);
  for (const d of dispatched) {
    console.log(`  ${d.jobId}  ${d.candidate.entityname}`);
  }

  if (failed > 0 || incomplete > 0) {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const phaseIdx = argv.indexOf('--phase');
  const phase = phaseIdx >= 0 ? parseInt(argv[phaseIdx + 1] ?? '0', 10) : 0;

  const candidates = await phase1Query();
  if (candidates.length === 0) {
    console.error('[seed] phase 1 returned 0 candidates — refine filter');
    process.exit(2);
  }

  if (phase === 1) {
    console.log('');
    console.log('[seed] phase 1 only — exiting before enqueue. Re-run without --phase 1 to continue.');
    return;
  }

  const dispatched = await phase2EnqueueAll(candidates);
  if (dispatched.length === 0) {
    console.error('[seed] phase 2 dispatched 0 jobs — aborting');
    process.exit(3);
  }

  const terminal = await phase3Poll(dispatched);
  await phase4Report(dispatched, terminal);
}

main().catch((err) => {
  console.error('[seed] fatal:', err instanceof Error ? err.message : err);
  process.exit(99);
});
