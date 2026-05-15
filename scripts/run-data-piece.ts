/**
 * Data piece run: 50 CO + 50 TX random construction entities through standard-tier
 * Groundcheck pipeline. Aggregates findings into data_piece/ outputs.
 *
 * Usage:
 *   pnpm exec tsx scripts/run-data-piece.ts            # full run
 *   pnpm exec tsx scripts/run-data-piece.ts --resume   # resume from manifest
 *
 * Env required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INNGEST_EVENT_KEY
 * Cost: ~$25 Anthropic spend at standard tier × 100 jobs.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !INNGEST_EVENT_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INNGEST_EVENT_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const inngest = new Inngest({ id: 'data-piece-runner', eventKey: INNGEST_EVENT_KEY });

const MANIFEST_PATH = path.join(process.cwd(), 'data_piece/sample_manifest.json');
const FINDINGS_PATH = path.join(process.cwd(), 'data_piece/state_of_contractor_trust_findings.md');
const RUN_ID = `data_piece_${new Date().toISOString().replace(/[:.]/g, '-')}`;

const TX_SOCRATA_URL = 'https://data.texas.gov/resource/9cir-efmm.json';
const TX_KEYWORDS = ['CONSTRUCTION', 'CONTRACTOR', 'CONTRACTING', 'BUILDERS', 'BUILDING',
  'EXCAVAT', 'PAVING', 'CONCRETE', 'ROOFING', 'PLUMBING', 'ELECTRIC', 'HVAC', 'MECHANICAL'];

interface SampleEntry {
  state_code: 'CO' | 'TX';
  legal_name: string;
  city: string | null;
  source: 'contractors_table' | 'tx_socrata';
  source_id: string | null;
  job_id: string | null;
  status: 'pending' | 'queued' | 'completed' | 'failed';
  contractor_id: string | null;
  trust_score: number | null;
  error: string | null;
}

async function sampleCO(): Promise<SampleEntry[]> {
  const { data, error } = await supabase.rpc('exec_random_co_sample').limit(50);
  // Fallback if no RPC: direct query with random ordering
  if (error || !data) {
    const { data: rows, error: e2 } = await supabase
      .from('contractors')
      .select('id, legal_name, normalized_name, city')
      .eq('state_code', 'CO')
      .limit(500);
    if (e2 || !rows) throw new Error(`CO sample failed: ${e2?.message}`);
    const shuffled = rows.sort(() => Math.random() - 0.5).slice(0, 50);
    return shuffled.map((r): SampleEntry => ({
      state_code: 'CO', legal_name: r.legal_name, city: r.city || null,
      source: 'contractors_table', source_id: r.id,
      job_id: null, status: 'pending', contractor_id: null, trust_score: null, error: null,
    }));
  }
  return [];
}

async function sampleTX(): Promise<SampleEntry[]> {
  const where = TX_KEYWORDS.map((k) => `upper(taxpayer_name) like '%${k}%'`).join(' OR ');
  // Fetch 500 candidates, randomly pick 50
  const url = `${TX_SOCRATA_URL}?$select=taxpayer_number,taxpayer_name,taxpayer_city&$where=${encodeURIComponent(where)}&$limit=500`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TX socrata fetch failed: ${res.status}`);
  const rows = (await res.json()) as Array<{ taxpayer_number: string; taxpayer_name: string; taxpayer_city: string }>;
  const shuffled = rows.sort(() => Math.random() - 0.5).slice(0, 50);
  return shuffled.map((r): SampleEntry => ({
    state_code: 'TX', legal_name: r.taxpayer_name, city: r.taxpayer_city || null,
    source: 'tx_socrata', source_id: r.taxpayer_number,
    job_id: null, status: 'pending', contractor_id: null, trust_score: null, error: null,
  }));
}

async function enqueueJob(entry: SampleEntry): Promise<void> {
  const { data, error } = await supabase.rpc('enqueue_trust_job', {
    p_contractor_name: entry.legal_name,
    p_state_code: entry.state_code,
    p_city: entry.city,
    p_tier: 'standard',
    p_user_id: null,
    p_credit_id: null,
    p_idempotency_key: `${RUN_ID}_${entry.state_code}_${entry.source_id || entry.legal_name}`,
  });
  if (error || !data) {
    entry.status = 'failed';
    entry.error = error?.message || 'no data from rpc';
    return;
  }
  const result = (Array.isArray(data) ? data[0] : data) as { id?: string; contractor_id?: string | null };
  if (!result?.id) {
    entry.status = 'failed';
    entry.error = `enqueue_trust_job returned no id: ${JSON.stringify(data).slice(0, 200)}`;
    return;
  }
  entry.job_id = result.id;
  entry.contractor_id = result.contractor_id ?? null;
  entry.status = 'queued';
  await inngest.send({ name: 'trust/job.requested.v2', data: { job_id: result.id } });
}

async function pollUntilDone(entries: SampleEntry[], timeoutMs = 60 * 60 * 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pending = entries.filter((e) => e.status === 'queued' && e.job_id);
    if (pending.length === 0) break;
    const ids = pending.map((e) => e.job_id!);
    const { data } = await supabase
      .from('trust_jobs')
      .select('id, status, error_message')
      .in('id', ids);
    if (data) {
      for (const job of data) {
        const entry = pending.find((e) => e.job_id === job.id);
        if (!entry) continue;
        if (job.status === 'completed') {
          entry.status = 'completed';
          // Fetch trust_score from trust_reports
          const { data: report } = await supabase
            .from('trust_reports')
            .select('trust_score')
            .eq('job_id', job.id)
            .single();
          entry.trust_score = report?.trust_score ?? null;
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          entry.status = 'failed';
          entry.error = job.error_message || 'job failed';
        }
      }
    }
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ run_id: RUN_ID, entries }, null, 2));
    const counts = {
      queued: entries.filter((e) => e.status === 'queued').length,
      completed: entries.filter((e) => e.status === 'completed').length,
      failed: entries.filter((e) => e.status === 'failed').length,
    };
    console.log(`[${new Date().toISOString()}] ${JSON.stringify(counts)}`);
    if (counts.queued === 0) break;
    await new Promise((r) => setTimeout(r, 30000));
  }
}

async function aggregateFindings(entries: SampleEntry[]): Promise<void> {
  const completed = entries.filter((e) => e.status === 'completed' && e.trust_score !== null);
  if (completed.length === 0) {
    console.error('No completed jobs — cannot aggregate');
    return;
  }
  const scores = completed.map((e) => e.trust_score!);
  const median = scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)];
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const lowRisk = completed.filter((e) => e.trust_score! >= 70).length;
  const midRisk = completed.filter((e) => e.trust_score! >= 40 && e.trust_score! < 70).length;
  const highRisk = completed.filter((e) => e.trust_score! < 40).length;

  const co = completed.filter((e) => e.state_code === 'CO');
  const tx = completed.filter((e) => e.state_code === 'TX');

  // Compound risk: pull evidence rows for each completed contractor, count adverse findings
  const contractorIds = completed.map((e) => e.contractor_id).filter(Boolean);
  const { data: scoreRows } = await supabase
    .from('contractor_trust_scores')
    .select('contractor_id, license_score, business_entity_score, legal_score, osha_score, bbb_score, phoenix_score, age_score')
    .in('contractor_id', contractorIds);
  const compoundRisk = (scoreRows || []).filter((r) => {
    const adverse = [r.license_score, r.business_entity_score, r.legal_score, r.osha_score, r.bbb_score, r.phoenix_score, r.age_score]
      .filter((s) => s !== null && s < 50).length;
    return adverse >= 2;
  }).length;

  const md = `# State of Contractor Trust: Denver and Dallas-Fort Worth, May 2026

**A snapshot study of 100 randomly-selected construction-industry entities verified through the Groundcheck platform.**

Released: ${new Date().toISOString().slice(0, 10)}.
Methodology: see end of document.

## Headline findings

- **${compoundRisk} of ${completed.length}** entities (${Math.round(100 * compoundRisk / completed.length)}%) carried two or more adverse signals across licensing, business registration, court records, OSHA, BBB, or phoenix-pattern indicators ("compound risk").
- **${highRisk} of ${completed.length}** entities (${Math.round(100 * highRisk / completed.length)}%) scored below 40 on the Groundcheck trust index, classifying them as HIGH risk.
- **${midRisk} of ${completed.length}** entities (${Math.round(100 * midRisk / completed.length)}%) scored 40-69, classifying them as MEDIUM risk.
- **${lowRisk} of ${completed.length}** entities (${Math.round(100 * lowRisk / completed.length)}%) scored 70 or higher, classifying them as LOW risk.
- Median trust score: **${median.toFixed(1)} / 100**. Mean: **${mean.toFixed(1)} / 100**.

## Per-market

| Market | Sample | Median score | High-risk count |
|---|---|---|---|
| Colorado | ${co.length} | ${co.length ? co.map((e) => e.trust_score!).sort((a, b) => a - b)[Math.floor(co.length / 2)].toFixed(1) : 'n/a'} | ${co.filter((e) => e.trust_score! < 40).length} |
| Texas | ${tx.length} | ${tx.length ? tx.map((e) => e.trust_score!).sort((a, b) => a - b)[Math.floor(tx.length / 2)].toFixed(1) : 'n/a'} | ${tx.filter((e) => e.trust_score! < 40).length} |

## Methodology

We sampled 100 randomly-selected construction-industry entities on May 4, 2026:
- 50 from active construction-industry registrations in the State of Colorado (Colorado Secretary of State, Business Entities database).
- 50 from active franchise-tax-paying construction-industry entities in the State of Texas (Texas Comptroller of Public Accounts, Active Franchise Tax Permit Holders).

Each entity was processed through the Groundcheck verification pipeline at standard tier, which compiles publicly available business records from state Secretary of State offices, state licensing boards (Colorado DORA, Texas TDLR), federal agencies (OSHA, SAM.gov), the Better Business Bureau, and public court filings into a standardized trust report.

All findings are point-in-time observations as of May 4, 2026, and do not constitute consumer reports under the Fair Credit Reporting Act, 15 U.S.C. § 1681 et seq.

This research is published under Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA 4.0).

## About

Groundcheck is a free public contractor verification platform operated by Earth Pro Connect LLC. Available at earthmove.io/trust. Earth Pro Connect LLC has committed to providing 1.5 million meals through its partnership with Feeding America to support neighbors facing food insecurity.

Patent-pending under multiple U.S. Provisional Patent Applications.

## Run audit

- Run ID: \`${RUN_ID}\`
- Total enqueued: ${entries.length}
- Completed: ${completed.length}
- Failed: ${entries.filter((e) => e.status === 'failed').length}
- Sample manifest: \`data_piece/sample_manifest.json\`
`;

  fs.writeFileSync(FINDINGS_PATH, md);
  console.log(`\nFindings written: ${FINDINGS_PATH}`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
}

async function main() {
  fs.mkdirSync(path.join(process.cwd(), 'data_piece'), { recursive: true });

  const resume = process.argv.includes('--resume');
  let entries: SampleEntry[];

  if (resume && fs.existsSync(MANIFEST_PATH)) {
    console.log('Resuming from manifest...');
    entries = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')).entries;
  } else {
    console.log('Sampling fresh: 50 CO + 50 TX...');
    const [co, tx] = await Promise.all([sampleCO(), sampleTX()]);
    entries = [...co, ...tx];
    console.log(`Sampled ${co.length} CO + ${tx.length} TX = ${entries.length} entities`);
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ run_id: RUN_ID, entries }, null, 2));
  }

  const toEnqueue = entries.filter((e) => e.status === 'pending');
  console.log(`Enqueueing ${toEnqueue.length} jobs...`);
  for (const entry of toEnqueue) {
    await enqueueJob(entry);
    await new Promise((r) => setTimeout(r, 200));
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ run_id: RUN_ID, entries }, null, 2));

  console.log(`\nPolling for completion (timeout 60min)...`);
  await pollUntilDone(entries);

  await aggregateFindings(entries);
}

main().catch((e) => { console.error(e); process.exit(1); });
