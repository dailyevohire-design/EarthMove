/**
 * Enqueue a trust_job via enqueue_trust_job RPC and fire trust/job.requested.v2
 * Inngest event so the prod orchestrator picks it up.
 *
 * Requires in env (or .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   INNGEST_EVENT_KEY
 *
 * Usage:
 *   pnpm exec tsx scripts/fire-trust-job.ts \
 *     --name "Austin Industries" --state TX --city Dallas --tier forensic
 *
 * Prints the job_id on success. Exit non-zero on any step failure.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnvIntoProcess(path: string) {
  let body: string;
  try {
    body = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith('--')) {
        out[key] = 'true';
      } else {
        out[key] = val;
        i++;
      }
    }
  }
  return out;
}

async function main() {
  loadDotEnvIntoProcess(resolve(process.cwd(), '.env.local'));

  const args = parseArgs(process.argv.slice(2));
  const name = args.name;
  const state = (args.state ?? '').toUpperCase();
  const city = args.city ?? null;
  const tier = args.tier ?? 'free';

  if (!name || !state) {
    console.error('Usage: fire-trust-job.ts --name <contractor> --state XX [--city Y] [--tier free|standard|plus|deep_dive|forensic]');
    process.exit(2);
  }

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const INNGEST_KEY = process.env.INNGEST_EVENT_KEY;
  if (!SUPA_URL || !SUPA_SR || !INNGEST_KEY) {
    console.error('Missing env: need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + INNGEST_EVENT_KEY (in .env.local or process env)');
    process.exit(3);
  }

  // 1. enqueue_trust_job RPC
  const idempotencyKey = `fire-trust-job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const rpcResp = await fetch(`${SUPA_URL}/rest/v1/rpc/enqueue_trust_job`, {
    method: 'POST',
    headers: {
      apikey: SUPA_SR,
      Authorization: `Bearer ${SUPA_SR}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_contractor_name: name,
      p_state_code: state,
      p_city: city,
      p_tier: tier,
      p_user_id: null,
      p_credit_id: null,
      p_idempotency_key: idempotencyKey,
    }),
  });
  if (!rpcResp.ok) {
    const body = await rpcResp.text().catch(() => '');
    console.error(`enqueue_trust_job failed: HTTP ${rpcResp.status} :: ${body}`);
    process.exit(4);
  }
  const rpcJson = await rpcResp.json();
  // RPC returns a row record as a JSON string of the composite type; first
  // field is the uuid. Robust parse: try .id, then regex on the string form.
  let jobId: string | null = null;
  if (typeof rpcJson === 'object' && rpcJson !== null) {
    if ('id' in rpcJson && typeof (rpcJson as any).id === 'string') {
      jobId = (rpcJson as any).id;
    }
  }
  if (!jobId) {
    const m = /\(([0-9a-f-]{36})/i.exec(JSON.stringify(rpcJson));
    if (m) jobId = m[1];
  }
  if (!jobId) {
    console.error('enqueue_trust_job returned unexpected shape:', JSON.stringify(rpcJson).slice(0, 400));
    process.exit(5);
  }

  // 2. Fire Inngest event
  const evtResp = await fetch(`https://inn.gs/e/${INNGEST_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'trust/job.requested.v2',
      data: { job_id: jobId },
    }),
  });
  if (!evtResp.ok) {
    const body = await evtResp.text().catch(() => '');
    console.error(`inngest event failed: HTTP ${evtResp.status} :: ${body}`);
    process.exit(6);
  }
  const evtJson = await evtResp.json();

  console.log(JSON.stringify({
    status: 'dispatched',
    job_id: jobId,
    contractor: name,
    state,
    city,
    tier,
    idempotency_key: idempotencyKey,
    inngest_event_id: (evtJson as any)?.ids?.[0] ?? null,
  }, null, 2));
  console.log('');
  console.log(`Watch: SELECT * FROM trust_evidence WHERE job_id='${jobId}' ORDER BY source_key;`);
  console.log(`Job:   SELECT status, completed_at FROM trust_jobs WHERE id='${jobId}';`);
}

main().catch((e) => {
  console.error('THREW:', (e as Error).constructor.name, (e as Error).message);
  process.exit(1);
});
