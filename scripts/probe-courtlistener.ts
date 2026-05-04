import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const KEY = process.env.COURTLISTENER_API_TOKEN;
if (!KEY) { console.error('COURTLISTENER_API_TOKEN missing'); process.exit(1); }

const BASE = 'https://www.courtlistener.com/api/rest/v4';
const headers = { Authorization: `Token ${KEY}` };

async function probe(label: string, path: string) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers });
  console.log(`\n=== ${label} ===\n${url}\nstatus: ${res.status} ${res.statusText}`);
  if (!res.ok) { console.log('error:', (await res.text()).slice(0, 400)); return null; }
  const j = await res.json();
  return j;
}

async function main() {
  // 1. Root: lists all available endpoints; also validates auth
  const root = await probe('root (auth check + endpoint catalog)', '/');
  if (root) {
    console.log('available endpoints:');
    Object.entries(root).slice(0, 30).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  }

  // 2. Search: full-text across opinions
  const search = await probe(
    'search (q="acme corp", type=o)',
    '/search/?q=acme%20corp&type=o&page_size=2'
  );
  if (search) {
    console.log(`count: ${search.count}, results returned: ${search.results?.length}`);
    if (search.results?.[0]) {
      const r = search.results[0];
      console.log('result[0] keys:', Object.keys(r).slice(0, 25).join(', '));
      console.log('result[0] sample:', {
        caseName: r.caseName,
        court: r.court,
        dateFiled: r.dateFiled,
        docket_id: r.docket_id,
        absolute_url: r.absolute_url,
      });
    }
  }

  // 3. Dockets: filter by court (party-name filtering goes through /search/)
  const dockets = await probe(
    'dockets (court=cand, page_size=2)',
    '/dockets/?court=cand&page_size=2'
  );
  if (dockets) {
    console.log(`count: ${dockets.count}, results returned: ${dockets.results?.length}`);
    if (dockets.results?.[0]) {
      const d = dockets.results[0];
      console.log('docket[0] keys:', Object.keys(d).slice(0, 25).join(', '));
      console.log('docket[0] sample:', {
        case_name: d.case_name,
        court: d.court,
        docket_number: d.docket_number,
        date_filed: d.date_filed,
        nature_of_suit: d.nature_of_suit,
        date_terminated: d.date_terminated,
      });
    }
  }

  // 4. RECAP fast: PACER-pulled federal docket data, indexed
  const recap = await probe(
    'recap-fastsearch (party in description)',
    '/search/?type=r&q=earthmoving&page_size=2'
  );
  if (recap) {
    console.log(`count: ${recap.count}, results returned: ${recap.results?.length}`);
    if (recap.results?.[0]) {
      console.log('recap result[0] keys:', Object.keys(recap.results[0]).slice(0, 25).join(', '));
    }
  }

  // 5. Rate-limit headers
  const rateRes = await fetch(`${BASE}/`, { headers });
  console.log('\n=== rate limit headers ===');
  ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after'].forEach(h => {
    const v = rateRes.headers.get(h);
    if (v) console.log(`  ${h}: ${v}`);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
