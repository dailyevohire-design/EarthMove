#!/usr/bin/env tsx
/**
 * Bulk seed the officer graph with population-scale CO contractor data.
 *
 * Distinct from scripts/seed-officer-graph.ts (which runs 45 contractors through
 * the full live trust pipeline at ~$11). This script bypasses the pipeline
 * entirely:
 *   - pulls construction-named CO entities from Socrata in pages
 *   - dedupes by entity_id
 *   - calls 3 existing RPCs per row: resolve_or_create_contractor,
 *     upsert_trust_officer (natural-person RAs only), link_contractor_officer
 *   - link_contractor_officer auto-emits trust_entity_edges (shared_officer)
 *     for phoenix detection
 *
 * Cost: ~$0 (no Anthropic, no scrapers fire).
 * Runtime: ~5-10 minutes for ~15K rows.
 * Idempotency: all 3 RPCs are upsert/no-op on conflict. Safe to re-run.
 *
 * Field mapping mirrors src/lib/trust/scrapers/co-sos-biz.ts exactly.
 * Corporate registered agents are intentionally dropped per production policy
 * (buildAgentOfficer in co-sos-biz.ts:97-108).
 *
 * Run:
 *   pnpm exec tsx --env-file=.env.local scripts/bulk-seed-co-officer-graph.ts --dry-run
 *   pnpm exec tsx --env-file=.env.local scripts/bulk-seed-co-officer-graph.ts
 *
 * Prereqs: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { createAdminClient } from '../src/lib/supabase/server';

const SOCRATA_ENDPOINT = 'https://data.colorado.gov/resource/4ykn-tg5h.json';
const PAGE_SIZE = 5000;
const MAX_PAGES_PER_PATTERN = 4; // 20K cap per pattern; 13 patterns × 20K = 260K worst-case before dedup
const PROGRESS_EVERY = 500;
const DRY_RUN = process.argv.includes('--dry-run');

const CONSTRUCTION_PATTERNS = [
  'CONSTRUCTION', 'CONTRACTOR', 'CONTRACTING', 'BUILDERS', 'BUILDING',
  'EXCAVATION', 'EARTHWORK', 'GRADING', 'CONCRETE', 'FOUNDATION',
  'REMODEL', 'ROOFING', 'PLUMBING', 'ELECTRIC', 'HVAC', 'PAINTING', 'LANDSCAPING',
];

// Domestic + foreign LLCs and Corps. Drop PB (sole proprietor) and other rare types.
const ENTITY_TYPES = ['DLLC', 'DCORP', 'FLLC', 'FCORP'];

interface CoSosRow {
  entityid: string;
  entityname: string;
  entitystatus: string;
  entitytype: string;
  entityformdate?: string;
  principaladdress1?: string;
  principalcity?: string;
  principalstate?: string;
  principalzipcode?: string;
  agentfirstname?: string;
  agentmiddlename?: string;
  agentlastname?: string;
  agentsuffix?: string;
  agentorganizationname?: string;
}

// Mirror buildAgentOfficer in src/lib/trust/scrapers/co-sos-biz.ts
function buildAgentName(row: CoSosRow): string | null {
  const org = (row.agentorganizationname ?? '').trim();
  if (org) return null; // corporate RA — production policy drops these
  const first = (row.agentfirstname ?? '').trim();
  const last = (row.agentlastname ?? '').trim();
  if (!first || !last) return null;
  const middle = (row.agentmiddlename ?? '').trim();
  const suffix = (row.agentsuffix ?? '').trim();
  return [first, middle, last, suffix].filter(p => p.length > 0).join(' ');
}

async function fetchPage(where: string, offset: number): Promise<CoSosRow[]> {
  const url = `${SOCRATA_ENDPOINT}?$where=${encodeURIComponent(where)}&$limit=${PAGE_SIZE}&$offset=${offset}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) {
    throw new Error(`Socrata ${resp.status} for offset=${offset}: ${await resp.text().catch(() => '')}`);
  }
  return resp.json();
}

async function pullAll(): Promise<Map<string, CoSosRow>> {
  const dedup = new Map<string, CoSosRow>();
  const entityTypeIn = ENTITY_TYPES.map(t => `'${t}'`).join(',');

  for (const pattern of CONSTRUCTION_PATTERNS) {
    const where = [
      `upper(entityname) like upper('%${pattern}%')`,
      `entitystatus = 'Good Standing'`,
      `entitytype in (${entityTypeIn})`,
      `upper(principalstate) = 'CO'`,
    ].join(' AND ');

    let pageRows = 0;
    for (let page = 0; page < MAX_PAGES_PER_PATTERN; page++) {
      const rows = await fetchPage(where, page * PAGE_SIZE);
      for (const r of rows) {
        if (r.entityid && !dedup.has(r.entityid)) dedup.set(r.entityid, r);
      }
      pageRows += rows.length;
      if (rows.length < PAGE_SIZE) break;
    }
    console.log(`  pattern '${pattern}': ${pageRows} fetched, ${dedup.size} deduped total`);
  }

  return dedup;
}

async function seed(rows: CoSosRow[]): Promise<{ contractors: number; officers: number; links: number; errors: number }> {
  const admin = createAdminClient();
  let contractors = 0, officers = 0, links = 0, errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const city = r.principalcity?.trim() || null;

    try {
      const { data: cdata, error: cerr } = await admin.rpc('resolve_or_create_contractor', {
        p_legal_name: r.entityname,
        p_state_code: 'CO',
        p_city: city,
      });
      if (cerr) { errors++; console.error(`  ${r.entityname}: contractor ${cerr.message}`); continue; }
      const contractorRow = (Array.isArray(cdata) ? cdata[0] : cdata) as { id?: string } | null;
      if (!contractorRow?.id) { errors++; continue; }
      contractors++;

      const agentName = buildAgentName(r);
      if (agentName) {
        const { data: odata, error: oerr } = await admin.rpc('upsert_trust_officer', {
          p_name: agentName,
          p_role_hint: 'registered_agent',
          p_jurisdiction: 'CO',
          p_source_evidence_id: null,
          p_is_likely_natural_person: true,
        });
        if (oerr) { errors++; console.error(`  ${r.entityname}: officer ${oerr.message}`); continue; }
        const officerRow = (Array.isArray(odata) ? odata[0] : odata) as { id?: string } | null;
        if (!officerRow?.id) { errors++; continue; }
        officers++;

        const { error: lerr } = await admin.rpc('link_contractor_officer', {
          p_contractor_id: contractorRow.id,
          p_officer_id: officerRow.id,
          p_role: 'registered_agent',
          p_source_evidence_id: null,
          p_start_date: null,
          p_end_date: null,
        });
        if (lerr) { errors++; console.error(`  ${r.entityname}: link ${lerr.message}`); continue; }
        links++;
      }
    } catch (err) {
      errors++;
      console.error(`  ${r.entityname}: unexpected ${err instanceof Error ? err.message : err}`);
    }

    if ((i + 1) % PROGRESS_EVERY === 0) {
      console.log(`  progress: ${i + 1}/${rows.length} rows | contractors=${contractors} officers=${officers} links=${links} errors=${errors}`);
    }
  }

  return { contractors, officers, links, errors };
}

async function main() {
  console.log(`[bulk-seed] Mode: ${DRY_RUN ? 'DRY-RUN' : 'REAL'}`);
  console.log(`[bulk-seed] Phase 1: pull from CO SOS Socrata`);
  const dedup = await pullAll();
  const rows = Array.from(dedup.values());
  console.log(`\n[bulk-seed] Total deduped: ${rows.length}`);

  let withAgent = 0, withCorpAgent = 0;
  for (const r of rows) {
    if (buildAgentName(r)) withAgent++;
    else if ((r.agentorganizationname ?? '').trim()) withCorpAgent++;
  }
  console.log(`[bulk-seed] Natural-person agents: ${withAgent}`);
  console.log(`[bulk-seed] Corporate agents (will skip): ${withCorpAgent}`);
  console.log(`[bulk-seed] Missing agent: ${rows.length - withAgent - withCorpAgent}`);

  console.log(`\n[bulk-seed] Sample (first 5):`);
  rows.slice(0, 5).forEach(r => {
    console.log(JSON.stringify({
      entity_name: r.entityname,
      entity_type: r.entitytype,
      city: r.principalcity,
      agent: buildAgentName(r),
      corp_agent: r.agentorganizationname,
      formed: r.entityformdate,
    }, null, 2));
  });

  if (DRY_RUN) {
    console.log(`\n[bulk-seed] Dry-run done. ${rows.length} rows would be seeded.`);
    return;
  }

  console.log(`\n[bulk-seed] Phase 2: seeding ${rows.length} rows via RPCs`);
  const result = await seed(rows);
  console.log(`\n[bulk-seed] Done.`);
  console.log(`  contractors created/updated: ${result.contractors}`);
  console.log(`  officers created/updated:    ${result.officers}`);
  console.log(`  officer links written:       ${result.links}`);
  console.log(`  errors:                      ${result.errors}`);
  if (result.errors > 0) process.exit(1);
}

main().catch(err => {
  console.error('[bulk-seed] fatal:', err instanceof Error ? err.message : err);
  process.exit(99);
});
