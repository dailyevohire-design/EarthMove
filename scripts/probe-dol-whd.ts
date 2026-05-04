import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const KEY = process.env.DOL_API_KEY;
if (!KEY) { console.error('DOL_API_KEY missing'); process.exit(1); }

const BASE = 'https://apiprod.dol.gov/v4';

async function listDatasets() {
  const res = await fetch(`${BASE}/datasets?limit=500`);
  console.log(`\n=== /datasets?limit=500 (no auth) ===\nstatus: ${res.status}`);
  if (!res.ok) { console.log(await res.text()); return null; }
  const j = await res.json();
  const items = (j.datasets || []) as any[];
  const whd = items.filter((d: any) => (d.agency?.abbr || '').toUpperCase() === 'WHD');
  console.log(`total datasets: ${items.length}, WHD-agency datasets: ${whd.length}`);
  whd.forEach((d: any, i: number) => {
    console.log(`  [${i}] id=${d.id} api_url=${d.api_url} name="${d.name}" frequency=${d.frequency}`);
  });
  return whd[0];
}

async function probeWhd(dataset: any) {
  if (!dataset) { console.log('no WHD dataset found'); return; }
  const path = `${BASE}/get/WHD/${dataset.api_url}/json`;

  const metaRes = await fetch(`${path}/metadata?X-API-KEY=${KEY}`);
  console.log(`\n=== ${path}/metadata ===\nstatus: ${metaRes.status}`);
  if (metaRes.ok) {
    const meta = await metaRes.json();
    const fields = Array.isArray(meta) ? meta : meta.data || [];
    console.log(`fields: ${fields.length}`);
    console.log(`first 8 short_names:`, fields.slice(0, 8).map((f: any) => f.short_name).join(', '));
  }

  const dataRes = await fetch(`${path}?X-API-KEY=${KEY}&limit=3`);
  console.log(`\n=== ${path}?limit=3 ===\nstatus: ${dataRes.status}`);
  if (!dataRes.ok) { console.log(await dataRes.text()); return; }
  const data = await dataRes.json();
  const rows = data.data || [];
  console.log(`rows returned: ${rows.length}`);
  if (rows[0]) {
    console.log(`row[0] columns: ${Object.keys(rows[0]).length}`);
    console.log(`row[0] identity:`, {
      case_id: rows[0].case_id,
      trade_nm: rows[0].trade_nm,
      legal_name: rows[0].legal_name,
      address: `${rows[0].street_addr_1_txt}, ${rows[0].cty_nm}, ${rows[0].st_cd} ${rows[0].zip_cd}`,
      naics: `${rows[0].naic_cd} (${rows[0].naics_code_description})`,
      findings_window: `${rows[0].findings_start_date} → ${rows[0].findings_end_date}`,
      case_violtn_cnt: rows[0].case_violtn_cnt,
      bw_atp_amt: rows[0].bw_atp_amt,
      cmp_assd: rows[0].cmp_assd,
    });
  }
}

async function main() {
  const ds = await listDatasets();
  await probeWhd(ds);
}

main().catch(e => { console.error(e); process.exit(1); });
