/**
 * Smoke test for runTrustSynthesizeV2 — two modes.
 *
 * MODE 1: single positional <job_id>
 *   Calls runTrustSynthesizeV2.fn directly with a mock Inngest step.
 *   Bypasses fan-out entirely. Assumes evidence rows already exist.
 *
 * MODE 2: --tier / --state / [--city] / --name (repeatable)
 *   Per name: enqueue_trust_job RPC → inngest.send('trust/job.requested.v2')
 *   then poll trust_jobs.status until terminal or timeout.
 *   Exercises the full chain: fan-out → scrapers → synth → finalize.
 *   Used pre-launch to validate the Tier 3 #1 officer-graph + phoenix
 *   synthesis chain end-to-end with real contractor names.
 *
 * Usage:
 *   pnpm exec tsx scripts/smoke-trust-synth.ts <job_id>
 *
 *   pnpm exec tsx scripts/smoke-trust-synth.ts \
 *     --tier standard --state CO [--city Denver] \
 *     --name "ACME Construction LLC" \
 *     --name "Beta Electric LLC" \
 *     [--timeout-ms 180000] [--poll-ms 3000]
 *
 * Prereqs: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * For paid tiers (standard/plus/deep_dive/forensic): ANTHROPIC_API_KEY.
 */

import { runTrustSynthesizeV2 } from '../src/lib/trust/inngest-functions';
import { createAdminClient } from '../src/lib/supabase/server';
import { inngest } from '../src/lib/inngest';

(async () => {
  const argv = process.argv.slice(2);
  const hasFlags = argv.some((a) => a.startsWith('--'));
  if (!hasFlags) {
    return runSingleJob(argv[0]);
  }
  return runMultiName(parseArgs(argv));
})().catch((err) => {
  console.error('[smoke] fatal:', err instanceof Error ? err.message : err);
  process.exit(99);
});

// ---------------------------------------------------------------------------
// MODE 1 — single positional <job_id> (existing behavior, preserved)
// ---------------------------------------------------------------------------

async function runSingleJob(jobId: string | undefined): Promise<void> {
  if (!jobId) {
    console.error('USAGE: pnpm exec tsx scripts/smoke-trust-synth.ts <job_id>');
    console.error('   OR: pnpm exec tsx scripts/smoke-trust-synth.ts --tier <t> --state <CO> [--city <C>] --name <N1> [--name <N2> ...]');
    process.exit(1);
  }

  type AnyFn = (...args: unknown[]) => unknown;
  const fnObj = runTrustSynthesizeV2 as unknown as Record<string, unknown>;
  const handler =
    (fnObj.fn as AnyFn | undefined) ??
    (fnObj.handler as AnyFn | undefined) ??
    (fnObj['_fn'] as AnyFn | undefined);

  if (typeof handler !== 'function') {
    console.error('ERR: could not locate handler on runTrustSynthesizeV2; introspecting:');
    console.error(Object.keys(fnObj));
    process.exit(2);
  }

  const mockStep = {
    run: async <T>(_name: string, fn: () => Promise<T>): Promise<T> => {
      const start = Date.now();
      try {
        const result = await fn();
        console.log(`  ✓ step "${_name}" (${Date.now() - start}ms)`);
        return result;
      } catch (err) {
        console.error(`  ✗ step "${_name}" failed after ${Date.now() - start}ms:`, err);
        throw err;
      }
    },
    sendEvent: async (name: string, payload: unknown) => {
      console.log(`  → step.sendEvent "${name}":`, JSON.stringify(payload));
    },
  };

  const mockEvent = {
    name: 'trust/job.synthesize.requested',
    data: { job_id: jobId },
    ts: Date.now(),
  };

  console.log(`\n=== invoking runTrustSynthesizeV2 with job_id=${jobId} ===\n`);

  try {
    const result = await handler({ event: mockEvent, step: mockStep });
    console.log('\n=== handler returned ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('\n=== handler threw ===');
    console.error(err);
    process.exit(3);
  }
}

// ---------------------------------------------------------------------------
// MODE 2 — multi-name fan-out + poll
// ---------------------------------------------------------------------------

type Tier = 'free' | 'standard' | 'plus' | 'deep_dive' | 'forensic';

interface MultiArgs {
  tier: Tier;
  state: string; // 2-char
  city?: string;
  names: string[];
  timeoutMs: number;
  pollMs: number;
}

function parseArgs(argv: string[]): MultiArgs {
  const out: Partial<MultiArgs> & { names: string[]; timeoutMs: number; pollMs: number } = {
    names: [],
    timeoutMs: 180_000,
    pollMs: 3_000,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${a}`);
      return v;
    };
    switch (a) {
      case '--tier':       out.tier = next() as Tier; break;
      case '--state':      out.state = next().toUpperCase(); break;
      case '--city':       out.city = next(); break;
      case '--name':       out.names.push(next()); break;
      case '--timeout-ms': out.timeoutMs = parseInt(next(), 10); break;
      case '--poll-ms':    out.pollMs = parseInt(next(), 10); break;
      default: throw new Error(`unknown flag: ${a}`);
    }
  }
  if (!out.tier) throw new Error('--tier required');
  if (!out.state || out.state.length !== 2) throw new Error('--state required (2-char)');
  if (out.names.length === 0) throw new Error('at least one --name required');
  if (!['free', 'standard', 'plus', 'deep_dive', 'forensic'].includes(out.tier)) {
    throw new Error(`invalid tier: ${out.tier}`);
  }
  return out as MultiArgs;
}

interface DispatchedJob {
  name: string;
  jobId: string;
  contractorId: string | null;
  startedAt: number;
}

interface JobRow {
  id: string;
  contractor_id: string | null;
  status: string;
  evidence_count: number | null;
  sources_completed: number | null;
  sources_failed: number | null;
  completed_at: string | null;
  error_message: string | null;
}

async function runMultiName(args: MultiArgs): Promise<void> {
  const admin = createAdminClient();

  console.log(
    `[smoke-multi] tier=${args.tier} state=${args.state}` +
    `${args.city ? ` city=${args.city}` : ''} names=${args.names.length}`,
  );

  // ── Phase 1: enqueue + send Inngest event for each name ────────────────
  const dispatched: DispatchedJob[] = [];

  for (const name of args.names) {
    const idempotencyKey = `SMOKETEST_${Date.now()}_${name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}`;
    const { data, error } = await admin.rpc('enqueue_trust_job', {
      p_contractor_name: name,
      p_state_code: args.state,
      p_city: args.city ?? null,
      p_tier: args.tier,
      p_user_id: null,
      p_credit_id: null,
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      console.error(`[smoke-multi] FAIL enqueue name="${name}" error=${error.message}`);
      process.exitCode = 1;
      continue;
    }
    const job = (Array.isArray(data) ? data[0] : data) as { id?: string; contractor_id?: string | null } | null;
    if (!job?.id) {
      console.error(`[smoke-multi] FAIL enqueue returned no id name="${name}"`);
      process.exitCode = 1;
      continue;
    }

    try {
      await inngest.send({
        name: 'trust/job.requested.v2',
        data: { job_id: job.id },
      });
    } catch (err) {
      console.error(`[smoke-multi] FAIL inngest.send name="${name}" job_id=${job.id} error=${err instanceof Error ? err.message : err}`);
      process.exitCode = 1;
      continue;
    }

    console.log(
      `[smoke-multi] enqueued name="${name}" job_id=${job.id} ` +
      `contractor_id=${job.contractor_id ?? 'pending'}`,
    );
    dispatched.push({
      name,
      jobId: job.id,
      contractorId: job.contractor_id ?? null,
      startedAt: Date.now(),
    });
  }

  if (dispatched.length === 0) {
    console.error('[smoke-multi] FAIL no jobs dispatched');
    process.exit(1);
  }

  console.log(
    `[smoke-multi] all ${dispatched.length} jobs dispatched, polling for completion ` +
    `(timeout=${args.timeoutMs}ms, poll=${args.pollMs}ms)`,
  );

  // ── Phase 2: poll until all reach terminal state or timeout ────────────
  const terminal = new Set<string>();
  const finalRows = new Map<string, JobRow>();
  const deadline = Date.now() + args.timeoutMs;

  while (terminal.size < dispatched.length && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, args.pollMs));

    const pending = dispatched.filter((d) => !terminal.has(d.jobId)).map((d) => d.jobId);
    const { data, error } = await admin
      .from('trust_jobs')
      .select('id, contractor_id, status, evidence_count, sources_completed, sources_failed, completed_at, error_message')
      .in('id', pending);

    if (error) {
      console.error(`[smoke-multi] poll error=${error.message}`);
      continue;
    }

    for (const row of (data ?? []) as JobRow[]) {
      if (row.status === 'completed' || row.status === 'failed') {
        terminal.add(row.id);
        finalRows.set(row.id, row);
        const d = dispatched.find((x) => x.jobId === row.id)!;
        const elapsed = ((Date.now() - d.startedAt) / 1000).toFixed(1);
        const errMsg = row.error_message;
        console.log(
          `[smoke-multi] DONE name="${d.name}" job_id=${row.id} ` +
          `contractor_id=${row.contractor_id ?? 'null'} status=${row.status} ` +
          `evidence_count=${row.evidence_count ?? 0} ` +
          `sources_completed=${row.sources_completed ?? 0} sources_failed=${row.sources_failed ?? 0} ` +
          `elapsed=${elapsed}s` +
          (errMsg ? ` error="${errMsg}"` : ''),
        );
      }
    }
  }

  // ── Phase 3: summary + exit code ───────────────────────────────────────
  const incomplete = dispatched.filter((d) => !terminal.has(d.jobId));
  const failed = Array.from(finalRows.values()).filter((r) => r.status === 'failed');
  const completed = terminal.size - failed.length;

  console.log('');
  console.log(
    `[smoke-multi] summary: dispatched=${dispatched.length} completed=${completed} ` +
    `failed=${failed.length} timed_out=${incomplete.length}`,
  );

  if (incomplete.length > 0) {
    for (const d of incomplete) {
      console.error(`[smoke-multi] TIMEOUT name="${d.name}" job_id=${d.jobId}`);
    }
  }

  if (failed.length > 0 || incomplete.length > 0) {
    process.exit(1);
  }

  // Print job_ids one per line for easy MCP consumption
  console.log('');
  console.log('[smoke-multi] job_ids for MCP verification:');
  for (const d of dispatched) {
    console.log(d.jobId);
  }
}
