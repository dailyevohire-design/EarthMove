#!/usr/bin/env tsx
/**
 * scripts/ingest-osha-bulk.ts
 *
 * Mirrors OSHA inspection + violation records from data.dol.gov into
 * osha_establishments / osha_inspections / osha_violations. Filters NAICS 23%
 * (construction) server-side. Writes osha_ingestion_runs row per invocation.
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

const DOL_BASE = 'https://data.dol.gov/get';
const PAGE_LIMIT = 10000;
const NAICS_FILTER = '23%';

type Inspection = {
  activity_nr: string; reporting_id?: string; state_flag?: string;
  estab_name: string; site_address?: string; site_city?: string;
  site_state?: string; site_zip?: string;
  mail_street?: string; mail_city?: string; mail_state?: string; mail_zip?: string;
  open_date?: string; close_case_date?: string; case_mod_date?: string;
  insp_scope?: string; insp_type?: string; adv_notice?: string;
  open_conf?: string; close_conf?: string; union_status?: string;
  safety_hlth?: string; migrant?: string;
  naics_code?: string; sic_code?: string; ownership?: string;
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

const { values: argv } = parseArgs({
  options: {
    backfill: { type: 'boolean', default: false },
    years: { type: 'string', default: '5' },
    since: { type: 'string' },
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

async function fetchPage<T>(table: 'inspection'|'violation', filter: unknown, offset: number): Promise<T[]> {
  const url = new URL(`${DOL_BASE}/${table}`);
  url.searchParams.set('api_key', DOL_API_KEY!);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  url.searchParams.set('offset', String(offset));
  if (filter) url.searchParams.set('filter_object', JSON.stringify(filter));
  if (table === 'inspection') {
    url.searchParams.set('sort_by', 'case_mod_date');
    url.searchParams.set('sort', 'desc');
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (resp.ok) return await resp.json() as T[];
    if (resp.status === 429 || resp.status >= 500) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    const body = await resp.text().catch(() => '');
    throw new Error(`DOL ${table} ${resp.status} at offset ${offset}: ${body.slice(0, 500)}`);
  }
  throw new Error(`DOL ${table} retries exhausted at offset ${offset}`);
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

async function ingest() {
  const since = argv.since
    ?? (argv.backfill
        ? new Date(Date.now() - parseInt(argv.years as string, 10) * 365 * 86_400_000).toISOString().slice(0,10)
        : (await getHighWaterMark()) ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0,10));

  console.log(`[osha] start since=${since} naics=${NAICS_FILTER} mode=${argv.backfill ? 'backfill' : 'incremental'}`);

  const { data: run, error: runErr } = await sb.from('osha_ingestion_runs')
    .insert({
      status: 'running',
      source_url: `${DOL_BASE}/inspection`,
      notes: `since=${since}, naics=${NAICS_FILTER}, mode=${argv.backfill ? 'backfill' : 'incremental'}`,
    })
    .select('id').single();
  if (runErr || !run) throw new Error(`failed to record ingestion run: ${runErr?.message}`);

  const filter = {
    op: 'and',
    conditions: [
      { field: 'naics_code', operator: 'like', value: NAICS_FILTER },
      { field: 'case_mod_date', operator: 'gt', value: since },
    ],
  };

  let offset = 0;
  let totalInsp = 0, totalEstabs = 0, totalViol = 0;
  let maxModDate = since;
  const seenEstabs = new Set<string>();

  try {
    while (true) {
      const page = await fetchPage<Inspection>('inspection', filter, offset);
      if (page.length === 0) break;

      const estabRows: Record<string, unknown>[] = [];
      const inspRows: Record<string, unknown>[] = [];
      const inspIds: string[] = [];

      for (const ins of page) {
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
            ownership: ins.ownership ?? null,
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
          close_conf: ins.close_conf ?? null,
          union_status: ins.union_status ?? null,
          safety_hlth: ins.safety_hlth ?? null,
          migrant: ins.migrant ?? null,
          mail_street: ins.mail_street ?? null,
          mail_city: ins.mail_city ?? null,
          mail_state: ins.mail_state ?? null,
          mail_zip: (ins.mail_zip ?? '').slice(0, 10) || null,
        });
        inspIds.push(ins.activity_nr);
        if (ins.case_mod_date && ins.case_mod_date > maxModDate) maxModDate = ins.case_mod_date;
      }

      if (estabRows.length) await chunkUpsert('osha_establishments', estabRows, 'estab_id');
      if (inspRows.length)  await chunkUpsert('osha_inspections',    inspRows,  'activity_nr');
      totalEstabs += estabRows.length;
      totalInsp   += inspRows.length;

      let pageViol = 0;
      for (let i = 0; i < inspIds.length; i += 50) {
        const idChunk = inspIds.slice(i, i + 50);
        const violFilter = { field: 'activity_nr', operator: 'in', value: idChunk };
        let vOffset = 0;
        while (true) {
          const vPage = await fetchPage<Violation>('violation', violFilter, vOffset);
          if (vPage.length === 0) break;
          const vRows = vPage.filter(v => v.delete_flag !== 'X').map(v => ({
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
          if (vRows.length) {
            await chunkUpsert('osha_violations', vRows, 'activity_nr,citation_id');
            pageViol += vRows.length;
          }
          if (vPage.length < PAGE_LIMIT) break;
          vOffset += PAGE_LIMIT;
        }
      }
      totalViol += pageViol;
      console.log(`[osha] offset=${offset} insp=${inspRows.length} estabs+=${estabRows.length} viol=${pageViol} hwm<=${maxModDate}`);

      if (page.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
    }

    const { error: updErr } = await sb.from('osha_ingestion_runs').update({
      status: 'success',
      completed_at: new Date().toISOString(),
      rows_inspections: totalInsp,
      rows_violations: totalViol,
      rows_establishments: totalEstabs,
      high_water_mark: maxModDate,
    }).eq('id', run.id);
    if (updErr) throw updErr;

    console.log(`[osha] DONE inspections=${totalInsp} establishments=${totalEstabs} violations=${totalViol} hwm=${maxModDate} run_id=${run.id}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from('osha_ingestion_runs').update({
      status: 'error',
      completed_at: new Date().toISOString(),
      error_message: msg,
      rows_inspections: totalInsp,
      rows_violations: totalViol,
      rows_establishments: totalEstabs,
    }).eq('id', run.id);
    throw e;
  }
}

ingest().catch(e => { console.error('[osha] FATAL', e); process.exit(1); });
