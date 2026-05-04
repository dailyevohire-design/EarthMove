const DATASET_URL = 'https://data.colorado.gov/resource/s9wt-dsfz.json';

async function main() {
  // Distinct license_type with proper count alias
  const distinctRes = await fetch(`${DATASET_URL}?$select=license_type,count(*)+AS+n&$group=license_type&$order=n+DESC&$limit=100`);
  console.log(`=== license_type distribution (status ${distinctRes.status}) ===`);
  if (distinctRes.ok) {
    const types = await distinctRes.json();
    types.forEach((t: any) => console.log(`  ${t.n.padStart(7)}  ${t.license_type || '(null)'}`));
  } else {
    console.log(await distinctRes.text());
  }

  // Distinct license_sub_type (sub-categories often hold "General Contractor")
  console.log(`\n=== license_sub_type distribution ===`);
  const subRes = await fetch(`${DATASET_URL}?$select=license_sub_type,count(*)+AS+n&$group=license_sub_type&$order=n+DESC&$limit=100`);
  if (subRes.ok) {
    const subs = await subRes.json();
    subs.forEach((s: any) => console.log(`  ${s.n.padStart(7)}  ${s.license_sub_type || '(null)'}`));
  }

  // Construction-keyword filter check
  console.log(`\n=== construction-keyword matches (license_type or sub_type) ===`);
  const where = `upper(license_type) LIKE '%CONTRACT%' OR upper(license_type) LIKE '%CONSTRUC%' OR upper(license_type) LIKE '%BUILD%' OR upper(license_sub_type) LIKE '%CONTRACT%' OR upper(license_sub_type) LIKE '%CONSTRUC%' OR upper(license_sub_type) LIKE '%BUILD%'`;
  const matchRes = await fetch(`${DATASET_URL}?$select=count(*)+AS+n&$where=${encodeURIComponent(where)}`);
  if (matchRes.ok) console.log(await matchRes.json());

  // Sample 3 construction-matched rows
  console.log(`\n=== 3 sample construction-matched rows ===`);
  const sampleRes = await fetch(`${DATASET_URL}?$where=${encodeURIComponent(where)}&$limit=3`);
  if (sampleRes.ok) console.log(JSON.stringify(await sampleRes.json(), null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });

export {};
