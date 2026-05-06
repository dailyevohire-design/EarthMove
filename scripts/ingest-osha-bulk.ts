#!/usr/bin/env tsx
/**
 * scripts/ingest-osha-bulk.ts
 *
 * Mirrors OSHA inspection + violation records from apiprod.dol.gov/v4 into
 * osha_establishments / osha_inspections / osha_violations.
 *
 * Architecture: two-pass ingest with single-condition server-side filter only.
 *   Pass 1 — inspections, filter case_mod_date > since, JS post-filter NAICS 23%.
 *   Pass 2 — violations,  filter issuance_date > since, JS-filter to activity_nrs
 *            we just ingested in pass 1.
 *
 * No `in`/`like`/`op:'and'` operators used — only the single-condition
 * {field,operator:'gt',value} shape verified working via curl probes.
 *
 * Run modes:
 *   pnpm tsx scripts/ingest-osha-bulk.ts                         # incremental from last hwm
 *   pnpm tsx scripts/ingest-osha-bulk.ts --backfill --years=5    # initial 5yr backfill
 *   pnpm tsx scripts/ingest-osha-bulk.ts --since=2026-04-01      # custom since
 *
 * Env required: DOL_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const DOL_BASE = 'https://apiprod.dol.gov/v4/get/OSHA';
// DOL caps response body at 6 MB; inspections measured at ~915 bytes/row in
// 2026-05-06 probes, so 10000 limit returns ~9.15 MB and 413s. 5000 leaves
// headroom even if some rows run larger.
const PAGE_LIMIT = 5000;
const NAICS_PREFIX = '23';

type Inspection = {
  activity_nr: string; reporting_id?: string; state_flag?: string;
  estab_name: string; site_address?: string; site_city?: string;
  site_state?: string; site_zip?: string;
  mail_street?: string; mail_city?: string; mail_state?: string; mail_zip?: string;
  open_date?: string; close_case_date?: string; case_mod_date?: string;
  insp_scope?: string; insp_type?: string; adv_notice?: string;
  open_conf?: string; close_conf_date?: string; union_status?: string;
  safety_hlth?: string; migrant?: string;
  naics_code?: string; sic_code?: string; owner_type?: string;
};

type Violation = {
  activity_nr: string; citation_id: string; delete_flag?: string;
  std_alpha?: string; std_lookup?: string;
  issuance_date?: string; abate_date?: string;
  current_penalty?: string|number; initial_penalty?: string|number;
  contest_date?: string; final_order_date?: string;
  nr_instances?: string|number; nr_exposed?: string|number;
  rec?: string; gravity?: string|number;
  emphasis?: string; hazcat?: string; fta_insp_nr?: string; viol_type?: string;
};

type DolEnvelope<T> = { data: T[]; meta?: Record<string, unknown> };

const { values: argv } = parseArgs({
  options: {
    backfill: { type: 'boolean', default: false },
    years:    { type: 'string',  default: '5' },
    since:    { type: 'string' },
  },
});

const DOL_API_KEY = process.env.DOL_API_KEY;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DOL_API_KEY) throw new Error('DOL_API_KEY missing — register at dataportal.dol.gov/registration');
if (!SB_URL || !SB_KEY) throw new Error('Supabase env missing');

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const LEGAL_SUFFIX_RE = /\b(l\.?l\.?c\.?|inc\.?|incorporated|corp\.?|corporation|co\.?|company|ltd\.?|limited|lp|llp|pllc|pc)\b/g;
function normalizeName(raw: string): string {
  return (raw ?? '').toLowerCase()
    .replace(/[.,'"`]/g, '')
    .replace(LEGAL_SUFFIX_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function estabId(name: string, state?: string, zip?: string): string {
  const n = normalizeName(name);
  const s = (state ?? '').toUpperCase();
  const z = (zip ?? '').slice(0, 5);
  return `${n}|${s}|${z}`;
}

async function fetchPage<T>(
  endpoint: 'inspection' | 'violation',
  filterField: string,
  filterValue: string,
  offset: number,
): Promise<T[]> {
  const url = new URL(`${DOL_BASE}/${endpoint}/json`);
  url.searchParams.set('X-API-KEY', DOL_API_KEY!);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('filter_object', JSON.stringify({
    field: filterField, operator: 'gt', value: filterValue,
  }));
  if (endpoint === 'inspection') {
    url.searchParams.set('sort_by', 'open_date');
    url.searchParams.set('sort', 'desc');
  }

  // DOL apiprod.dol.gov rate-limits aggressively past ~15 req/min.
  // Per-call floor of 4s paces sustained throughput at ~15/min.
  await sleep(4000);

  for (let attempt = 0; attempt < 8; attempt++) {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (resp.ok) {
      const env = await resp.json() as DolEnvelope<T>;
      return env.data ?? [];
    }
    if (resp.status === 429 || resp.status >= 500) {
      // 2s, 4s, 8s, 16s, 32s, 60s, 60s, 60s (cumulative ~242s before giving up)
      const backoff = Math.min(60000, 2000 * Math.pow(2, attempt));
      console.warn(`[osha] ${endpoint} ${resp.status} at offset=${offset}, sleeping ${backoff}ms (attempt ${attempt + 1}/8)`);
      await sleep(backoff);
      continue;
    }
    const body = await resp.text().catch(() => '');
    throw new Error(`DOL ${endpoint} ${resp.status} at offset ${offset}: ${body.slice(0, 500)}`);
  }
  throw new Error(`DOL ${endpoint} retries exhausted at offset ${offset}`);
}

async function getHighWaterMark(): Promise<string|null> {
  const { data } = await sb.from('osha_ingestion_runs')
    .select('high_water_mark')
    .eq('status','success')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle();
  return data?.high_water_mark ?? null;
}

async function chunkUpsert<T extends Record<string, unknown>>(table: string, rows: T[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 1000) {
    const slice = rows.slice(i, i + 1000);
    const { error } = await sb.from(table).upsert(slice, { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

async function ingestInspections(since: string): Promise<{
  totalSeen: number; totalInserted: number; totalEstabs: number;
  maxModDate: string; activityNrs: Set<string>;
}> {
  console.log(`[osha] PASS 1 inspections — case_mod_date > ${since}`);
  let offset = 0, seen = 0, totalInsp = 0, totalEstabs = 0;
  let maxModDate = since;
  const activityNrs = new Set<string>();
  const seenEstabs = new Set<string>();

  while (true) {
    const page = await fetchPage<Inspection>('inspection', 'case_mod_date', since, offset);
    if (page.length === 0) break;
    seen += page.length;

    const constructionRows = page.filter(p => (p.naics_code ?? '').startsWith(NAICS_PREFIX));

    const estabRows: Record<string, unknown>[] = [];
    const inspRows: Record<string, unknown>[] = [];

    for (const ins of constructionRows) {
      if (!ins.activity_nr || !ins.estab_name) continue;
      const eid = estabId(ins.estab_name, ins.site_state, ins.site_zip);
      if (!seenEstabs.has(eid)) {
        seenEstabs.add(eid);
        estabRows.push({
          estab_id: eid,
          name_raw: ins.estab_name,
          name_norm: normalizeName(ins.estab_name),
          street: ins.site_address ?? null,
          city: ins.site_city ?? null,
          state: ins.site_state ?? null,
          zip: (ins.site_zip ?? '').slice(0, 10) || null,
          naics: ins.naics_code ?? null,
          sic: ins.sic_code ?? null,
          ownership: ins.owner_type ?? null,
        });
      }
      inspRows.push({
        activity_nr: ins.activity_nr,
        estab_id: eid,
        reporting_id: ins.reporting_id ?? null,
        state_flag: ins.state_flag ?? null,
        open_date: ins.open_date ?? null,
        close_case_date: ins.close_case_date ?? null,
        case_mod_date: ins.case_mod_date ?? null,
        insp_scope: ins.insp_scope ?? null,
        insp_type: ins.insp_type ?? null,
        adv_notice: ins.adv_notice ?? null,
        open_conf: ins.open_conf ?? null,
        close_conf: ins.close_conf_date ?? null,
        union_status: ins.union_status ?? null,
        safety_hlth: ins.safety_hlth ?? null,
        migrant: ins.migrant ?? null,
        mail_street: ins.mail_street ?? null,
        mail_city: ins.mail_city ?? null,
        mail_state: ins.mail_state ?? null,
        mail_zip: (ins.mail_zip ?? '').slice(0, 10) || null,
      });
      activityNrs.add(ins.activity_nr);
      if (ins.case_mod_date && ins.case_mod_date > maxModDate) maxModDate = ins.case_mod_date;
    }

    if (estabRows.length) await chunkUpsert('osha_establishments', estabRows, 'estab_id');
    if (inspRows.length)  await chunkUpsert('osha_inspections',    inspRows,  'activity_nr');
    totalEstabs += estabRows.length;
    totalInsp   += inspRows.length;

    console.log(`[osha] insp page offset=${offset} seen=${page.length} construction=${constructionRows.length} estabs+=${estabRows.length} hwm<=${maxModDate}`);
    if (page.length < PAGE_LIMIT) break;
    offset += page.length;
  }

  return { totalSeen: seen, totalInserted: totalInsp, totalEstabs, maxModDate, activityNrs };
}

async function ingestViolations(since: string, knownActivityNrs: Set<string>): Promise<number> {
  console.log(`[osha] PASS 2 violations — issuance_date > ${since}, filtering to ${knownActivityNrs.size} known activity_nrs`);
  let offset = 0, seen = 0, total = 0;

  while (true) {
    const page = await fetchPage<Violation>('violation', 'issuance_date', since, offset);
    if (page.length === 0) break;
    seen += page.length;

    const rows = page
      .filter(v => v.delete_flag !== 'X')
      .filter(v => knownActivityNrs.has(v.activity_nr))
      .map(v => ({
        activity_nr: v.activity_nr,
        citation_id: v.citation_id,
        std_alpha: v.std_alpha ?? null,
        std_lookup: v.std_lookup ?? null,
        issuance_date: v.issuance_date ?? null,
        abate_date: v.abate_date ?? null,
        current_penalty: v.current_penalty != null ? Number(v.current_penalty) : null,
        initial_penalty: v.initial_penalty != null ? Number(v.initial_penalty) : null,
        contest_date: v.contest_date ?? null,
        final_order_date: v.final_order_date ?? null,
        nr_instances: v.nr_instances != null ? Number(v.nr_instances) : null,
        nr_exposed: v.nr_exposed != null ? Number(v.nr_exposed) : null,
        rec: v.rec ?? null,
        gravity: v.gravity != null ? Number(v.gravity) : null,
        emphasis: v.emphasis ?? null,
        hazcat: v.hazcat ?? null,
        fta_insp_nr: v.fta_insp_nr ?? null,
        viol_type: v.viol_type ?? null,
      }));

    if (rows.length) {
      await chunkUpsert('osha_violations', rows, 'activity_nr,citation_id');
      total += rows.length;
    }

    console.log(`[osha] viol page offset=${offset} seen=${page.length} matched=${rows.length}`);
    if (page.length < PAGE_LIMIT) break;
    offset += page.length;
  }

  return total;
}

async function ingest() {
  const since = argv.since
    ?? (argv.backfill
        ? new Date(Date.now() - parseInt(argv.years as string, 10) * 365 * 86_400_000).toISOString().slice(0,10)
        : (await getHighWaterMark()) ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0,10));

  console.log(`[osha] start since=${since} naics=${NAICS_PREFIX}* mode=${argv.backfill ? 'backfill' : 'incremental'}`);

  const { data: run, error: runErr } = await sb.from('osha_ingestion_runs')
    .insert({
      status: 'running',
      source_url: `${DOL_BASE}/inspection/json`,
      notes: `since=${since}, naics=${NAICS_PREFIX}*, mode=${argv.backfill ? 'backfill' : 'incremental'}, host=apiprod.dol.gov`,
    })
    .select('id').single();
  if (runErr || !run) throw new Error(`failed to record ingestion run: ${runErr?.message}`);

  let inspResult = { totalSeen: 0, totalInserted: 0, totalEstabs: 0, maxModDate: since, activityNrs: new Set<string>() };
  let violTotal = 0;

  try {
    inspResult = await ingestInspections(since);
    violTotal = await ingestViolations(since, inspResult.activityNrs);

    const { error: updErr } = await sb.from('osha_ingestion_runs').update({
      status: 'success',
      completed_at: new Date().toISOString(),
      rows_inspections: inspResult.totalInserted,
      rows_violations: violTotal,
      rows_establishments: inspResult.totalEstabs,
      high_water_mark: inspResult.maxModDate,
      notes: `since=${since}, seen_total=${inspResult.totalSeen}, naics23=${inspResult.totalInserted}, run_id=${run.id}`,
    }).eq('id', run.id);
    if (updErr) throw updErr;

    console.log(`[osha] DONE inspections=${inspResult.totalInserted}/${inspResult.totalSeen} establishments=${inspResult.totalEstabs} violations=${violTotal} hwm=${inspResult.maxModDate} run_id=${run.id}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from('osha_ingestion_runs').update({
      status: 'error',
      completed_at: new Date().toISOString(),
      error_message: msg,
      rows_inspections: inspResult.totalInserted,
      rows_violations: violTotal,
      rows_establishments: inspResult.totalEstabs,
    }).eq('id', run.id);
    throw e;
  }
}

ingest().catch(e => { console.error('[osha] FATAL', e); process.exit(1); });
