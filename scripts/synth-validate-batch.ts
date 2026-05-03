/**
 * Synth-validate batch — pre-wire validation rubric.
 *
 * Fires 5 mixed-profile contractors through the full v2 pipeline (fan-out →
 * scrapers → synth → finalize) and applies a 10-point rubric to every result.
 * 5/5 pass = GO for wire-submit. 1+ fail = STOP, paste failure detail.
 *
 * Path: enqueue_trust_job RPC + inngest.send (or direct HTTP fallback when
 * SUPABASE_SERVICE_ROLE_KEY is unavailable). Execution today routes through
 * MCP+curl manually because SRK is missing from .env.local.
 *
 * Rubric (per contractor — all must pass):
 *   1. status='completed' within 60s
 *   2. sources_completed >= 4 (sam_gov rate-limit acceptable)
 *   3. trust_score is non-null and 0 <= n <= 100
 *   4. data_integrity_status = 'ok'
 *   5. evidence_ids[] non-empty AND every id is a real trust_evidence row for the job
 *   6. summary cites at least 1 source by name (CO SOS / TX Comptroller / Denver / Dallas)
 *   7. red_flags[] + positive_indicators[] together >= 1 item
 *   8. No raw cite tags ([cite-N], <cite>) leaked into summary, red_flags, or positive_indicators
 *   9. api_cost_usd <= 2.00 (200 cents)
 *  10. processing_ms < 30000
 *
 * Usage (when SRK present):
 *   pnpm exec tsx --env-file=.env.local scripts/synth-validate-batch.ts
 *
 * Prereqs: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + INNGEST_EVENT_KEY.
 */

import { createAdminClient } from '../src/lib/supabase/server';
import { inngest } from '../src/lib/inngest';

interface Candidate {
  name: string;
  state: string;
  city: string;
  note: string;
}

const CANDIDATES: Candidate[] = [
  { name: 'PCL Construction Services',                          state: 'CO', city: 'Denver',   note: 'clean enterprise GC' },
  { name: 'DEKAN REMODELING AND CONSTRUCTION COMPANY, LLC >>',  state: 'CO', city: 'Denver',   note: 'name-edge-case (trailing >>)' },
  { name: 'Brannan Sand and Gravel',                            state: 'CO', city: 'Denver',   note: 'established mid-size supplier' },
  { name: 'Bemas Construction',                                 state: 'CO', city: 'Denver',   note: 'Juan-known-positive' },
  { name: 'Pinnacle Prestige Homes LLC',                        state: 'CO', city: 'Denver',   note: 'pre-existing seed graph (officer-edge surfacing)' },
];

const POLL_MS = 5_000;
const TIMEOUT_MS = 90_000;

interface DispatchedJob {
  candidate: Candidate;
  jobId: string;
  contractorId: string | null;
  startedAt: number;
}

interface JobRow {
  id: string;
  status: string;
  evidence_count: number | null;
  sources_completed: number | null;
  sources_failed: number | null;
  total_sources_planned: number | null;
  completed_at: string | null;
  error_message: string | null;
}

interface ReportRow {
  id: string;
  job_id: string;
  trust_score: number | null;
  risk_level: string | null;
  data_integrity_status: string | null;
  evidence_ids: string[] | null;
  summary: string | null;
  red_flags: string[] | null;
  positive_indicators: string[] | null;
  api_cost_usd: number | null;
  processing_ms: number | null;
}

const SOURCE_MENTION_RE = /\b(CO SOS|Colorado SOS|TX Comptroller|Texas Comptroller|Denver|Dallas)\b/i;
const RAW_CITE_RE = /\[cite-\d+\]|<cite>|\{\{cite/i;

interface RubricResult {
  passed: boolean;
  failures: string[];
}

function evaluateRubric(args: {
  cand: Candidate;
  job: JobRow;
  report: ReportRow | null;
  evidenceIdsForJob: Set<string>;
  duration_sec: number;
}): RubricResult {
  const { job, report, evidenceIdsForJob, duration_sec } = args;
  const failures: string[] = [];

  // 1. status='completed' within 60s
  if (job.status !== 'completed') failures.push(`#1 status=${job.status} (expected completed)`);
  if (duration_sec > 60) failures.push(`#1 duration=${duration_sec.toFixed(1)}s (expected <=60s)`);

  // 2. sources_completed >= 4
  if ((job.sources_completed ?? 0) < 4) {
    failures.push(`#2 sources_completed=${job.sources_completed} (expected >=4)`);
  }

  if (!report) {
    failures.push(`#3-10 no trust_report row for job_id`);
    return { passed: false, failures };
  }

  // 3. trust_score non-null + 0..100
  if (report.trust_score === null) failures.push(`#3 trust_score is null`);
  else if (report.trust_score < 0 || report.trust_score > 100) failures.push(`#3 trust_score=${report.trust_score} out of range`);

  // 4. data_integrity_status = 'ok'
  if (report.data_integrity_status !== 'ok') failures.push(`#4 data_integrity_status=${report.data_integrity_status} (expected ok)`);

  // 5. evidence_ids non-empty AND every id is a real trust_evidence row for the job
  const evIds = report.evidence_ids ?? [];
  if (evIds.length === 0) failures.push(`#5 evidence_ids[] empty`);
  else {
    const orphans = evIds.filter((id) => !evidenceIdsForJob.has(id));
    if (orphans.length > 0) failures.push(`#5 ${orphans.length} evidence_ids[] not present in trust_evidence for this job: ${orphans.slice(0, 3).join(',')}`);
  }

  // 6. summary cites at least one source by name
  const summary = report.summary ?? '';
  if (!SOURCE_MENTION_RE.test(summary)) failures.push(`#6 summary cites no recognised source (CO SOS / TX Comptroller / Denver / Dallas)`);

  // 7. red_flags + positive_indicators >= 1
  const flagCount = (report.red_flags ?? []).length + (report.positive_indicators ?? []).length;
  if (flagCount < 1) failures.push(`#7 red_flags + positive_indicators total=${flagCount} (expected >=1)`);

  // 8. No raw cite tags in summary/red_flags/positive_indicators
  const allText = [
    summary,
    ...(report.red_flags ?? []),
    ...(report.positive_indicators ?? []),
  ].join('\n');
  if (RAW_CITE_RE.test(allText)) failures.push(`#8 raw cite tag leaked into summary/flags/positives`);

  // 9. api_cost_usd <= 2.00
  if ((report.api_cost_usd ?? 0) > 2.0) failures.push(`#9 api_cost_usd=${report.api_cost_usd} (expected <=2.00)`);

  // 10. processing_ms < 30000
  if ((report.processing_ms ?? 0) >= 30000) failures.push(`#10 processing_ms=${report.processing_ms} (expected <30000)`);

  return { passed: failures.length === 0, failures };
}

async function phase1Enqueue(): Promise<DispatchedJob[]> {
  const admin = createAdminClient();
  console.log(`[synth-val] phase 1: enqueue ${CANDIDATES.length} candidates in parallel`);
  const dispatched = await Promise.all(
    CANDIDATES.map(async (c) => {
      const idem = `SYNTHVAL_${Date.now()}_${c.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}`;
      const { data, error } = await admin.rpc('enqueue_trust_job', {
        p_contractor_name: c.name,
        p_state_code: c.state,
        p_city: c.city,
        p_tier: 'standard',
        p_user_id: null,
        p_credit_id: null,
        p_idempotency_key: idem,
      });
      if (error) {
        console.error(`[synth-val]   FAIL enqueue "${c.name}": ${error.message}`);
        return null;
      }
      const j = (Array.isArray(data) ? data[0] : data) as { id: string; contractor_id: string | null };
      try {
        await inngest.send({ name: 'trust/job.requested.v2', data: { job_id: j.id } });
      } catch (err) {
        console.error(`[synth-val]   FAIL inngest.send "${c.name}": ${err instanceof Error ? err.message : err}`);
        return null;
      }
      console.log(`[synth-val]   ✓ "${c.name}" → job_id=${j.id}`);
      return { candidate: c, jobId: j.id, contractorId: j.contractor_id, startedAt: Date.now() } satisfies DispatchedJob;
    }),
  );
  return dispatched.filter((d): d is DispatchedJob => d !== null);
}

async function phase2Poll(dispatched: DispatchedJob[]): Promise<Map<string, JobRow>> {
  const admin = createAdminClient();
  const terminal = new Map<string, JobRow>();
  const deadline = Date.now() + TIMEOUT_MS;
  console.log(`[synth-val] phase 2: polling ${dispatched.length} jobs (timeout=${TIMEOUT_MS}ms)`);
  while (terminal.size < dispatched.length && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const pending = dispatched.filter((d) => !terminal.has(d.jobId)).map((d) => d.jobId);
    const { data } = await admin
      .from('trust_jobs')
      .select('id, status, evidence_count, sources_completed, sources_failed, total_sources_planned, completed_at, error_message')
      .in('id', pending);
    for (const row of (data ?? []) as JobRow[]) {
      if (row.status === 'completed' || row.status === 'failed') {
        terminal.set(row.id, row);
      }
    }
  }
  return terminal;
}

async function phase3Validate(
  dispatched: DispatchedJob[],
  terminal: Map<string, JobRow>,
): Promise<{ pass: number; fail: number; rows: Array<{ cand: Candidate; result: RubricResult; report: ReportRow | null; job: JobRow | null }> }> {
  const admin = createAdminClient();

  const jobIds = dispatched.map((d) => d.jobId);
  const { data: reports } = await admin
    .from('trust_reports')
    .select('id, job_id, trust_score, risk_level, data_integrity_status, evidence_ids, summary, red_flags, positive_indicators, api_cost_usd, processing_ms')
    .in('job_id', jobIds);
  const reportByJob = new Map<string, ReportRow>();
  for (const r of (reports ?? []) as ReportRow[]) reportByJob.set(r.job_id, r);

  const { data: evidence } = await admin
    .from('trust_evidence')
    .select('id, job_id')
    .in('job_id', jobIds);
  const evidenceByJob = new Map<string, Set<string>>();
  for (const e of (evidence ?? []) as { id: string; job_id: string }[]) {
    if (!evidenceByJob.has(e.job_id)) evidenceByJob.set(e.job_id, new Set());
    evidenceByJob.get(e.job_id)!.add(e.id);
  }

  const rows: Array<{ cand: Candidate; result: RubricResult; report: ReportRow | null; job: JobRow | null }> = [];
  let pass = 0, fail = 0;
  for (const d of dispatched) {
    const job = terminal.get(d.jobId) ?? null;
    const report = reportByJob.get(d.jobId) ?? null;
    const evidenceIdsForJob = evidenceByJob.get(d.jobId) ?? new Set<string>();
    const duration_sec = (Date.now() - d.startedAt) / 1000;
    const result = job
      ? evaluateRubric({ cand: d.candidate, job, report, evidenceIdsForJob, duration_sec })
      : { passed: false, failures: ['job did not reach terminal state within timeout'] };
    if (result.passed) pass += 1; else fail += 1;
    rows.push({ cand: d.candidate, result, report, job });
  }
  return { pass, fail, rows };
}

async function main(): Promise<void> {
  const dispatched = await phase1Enqueue();
  if (dispatched.length === 0) { console.error('[synth-val] no jobs dispatched'); process.exit(1); }
  const terminal = await phase2Poll(dispatched);
  const summary = await phase3Validate(dispatched, terminal);

  console.log('');
  console.log('=== synth-validate rubric results ===');
  for (const row of summary.rows) {
    const tag = row.result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${tag} ${row.cand.name}`);
    if (!row.result.passed) {
      for (const f of row.result.failures) console.log(`       - ${f}`);
    }
    if (row.report) {
      console.log(`       trust_score=${row.report.trust_score} risk=${row.report.risk_level} red_flags=${(row.report.red_flags ?? []).length} positives=${(row.report.positive_indicators ?? []).length} cost=$${row.report.api_cost_usd}`);
    }
  }
  console.log('');
  console.log(`[synth-val] FINAL: ${summary.pass}/${dispatched.length} passed, ${summary.fail} failed`);
  if (summary.fail > 0) {
    console.log('[synth-val] STOP — wire-submit GATE = NO-GO');
    process.exit(1);
  } else {
    console.log('[synth-val] PROCEED — wire-submit GATE = GO');
  }
}

main().catch((err) => { console.error('[synth-val] fatal:', err instanceof Error ? err.message : err); process.exit(99); });
