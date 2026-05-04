/**
 * Phase 1 recon: figure out which TX data source carries registered agents.
 * Probes both Socrata 9cir-efmm and (if SOS_TX_API_KEY is set) the CPA
 * franchise-tax officer-detail API. No DB writes.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CONSTRUCTION_PATTERNS = [
  'CONSTRUCTION', 'CONTRACTOR', 'CONTRACTING', 'BUILDERS', 'BUILDING',
  'EXCAVAT', 'PAVING', 'CONCRETE', 'ROOFING', 'PLUMBING', 'ELECTRIC',
  'HVAC', 'MECHANICAL',
];

async function probeSocrata() {
  const where = CONSTRUCTION_PATTERNS
    .map((p) => `upper(taxpayer_name) like '%${p}%'`)
    .join(' OR ');

  // 1a. Get total count of construction-matching rows (server-side filter test)
  const countUrl = `https://data.texas.gov/resource/9cir-efmm.json?$select=count(*)&$where=${encodeURIComponent(where)}`;
  const countRes = await fetch(countUrl);
  console.log(`\n=== Socrata count probe ===`);
  console.log(`status: ${countRes.status}`);
  if (countRes.ok) {
    const j = await countRes.json();
    console.log(`construction-matching rows:`, j);
  } else {
    console.log(`error body:`, await countRes.text());
  }

  // 1b. Pull 5 full rows to inspect field shape
  const sampleUrl = `https://data.texas.gov/resource/9cir-efmm.json?$limit=5&$where=${encodeURIComponent(where)}`;
  const sampleRes = await fetch(sampleUrl);
  console.log(`\n=== Socrata sample (5 rows) ===`);
  console.log(`status: ${sampleRes.status}`);
  if (!sampleRes.ok) {
    console.log(`error body:`, await sampleRes.text());
    return null;
  }
  const rows = await sampleRes.json();
  console.log(`row count returned: ${rows.length}`);
  if (rows.length === 0) return null;

  console.log(`\nfield keys present in row[0]:`);
  console.log(Object.keys(rows[0]).sort());
  console.log(`\nfull row[0]:`);
  console.log(JSON.stringify(rows[0], null, 2));
  const agentLikeKeys = Object.keys(rows[0]).filter((k) =>
    /agent|officer|director|principal|owner|registered/i.test(k),
  );
  console.log(`\nagent-like field keys: ${JSON.stringify(agentLikeKeys)}`);

  // 1c. Return first row's taxpayer_number for the secondary API probe
  const idField = Object.keys(rows[0]).find((k) =>
    /^taxpayer.?(number|id)$/i.test(k),
  );
  if (idField) {
    console.log(`\nfound taxpayer ID field: '${idField}' = '${rows[0][idField]}'`);
    return rows[0][idField];
  }
  return null;
}

async function probeCpaApi(taxpayerId: string | null) {
  if (!taxpayerId) {
    console.log(`\n=== CPA franchise-tax API probe SKIPPED — no taxpayerId from Socrata ===`);
    return;
  }
  const apiKey = process.env.TX_CPA_API_KEY;
  console.log(`\n=== CPA franchise-tax API probe ===`);
  console.log(`taxpayer ID: ${taxpayerId}`);
  console.log(`TX_CPA_API_KEY set: ${apiKey ? 'yes' : 'NO'}`);

  // No-key probe first (might return public response or 401/403)
  const url = `https://api.comptroller.texas.gov/public-data/v1/public/franchise-tax/${taxpayerId}`;
  const headers: Record<string, string> = {};
  if (apiKey) headers['x-api-key'] = apiKey;

  const res = await fetch(url, { headers });
  console.log(`status: ${res.status}`);
  console.log(`response headers x-ratelimit-*:`, [...res.headers.entries()].filter(([k]) => k.startsWith('x-')));
  const body = await res.text();
  console.log(`body (first 2000 chars):\n${body.slice(0, 2000)}`);
}

async function main() {
  const taxpayerId = await probeSocrata();
  await probeCpaApi(taxpayerId);
}

main().catch((e) => {
  console.error('probe failed:', e);
  process.exit(1);
});
