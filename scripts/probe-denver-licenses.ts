const DATASET_BASE = 'https://data.colorado.gov/resource';
const CANDIDATE_IDS = ['s9wt-dsfz', 'c48n-6dwv'];

async function probeDataset(id: string) {
  console.log(`\n=== Probing ${id} ===`);
  const countUrl = `${DATASET_BASE}/${id}.json?$select=count(*)`;
  const countRes = await fetch(countUrl);
  console.log(`count status: ${countRes.status}`);
  if (countRes.ok) {
    console.log(`count:`, await countRes.json());
  } else {
    console.log(`count error:`, (await countRes.text()).slice(0, 300));
    return;
  }
  const sampleUrl = `${DATASET_BASE}/${id}.json?$limit=5`;
  const sampleRes = await fetch(sampleUrl);
  if (!sampleRes.ok) return;
  const rows = await sampleRes.json();
  console.log(`row count: ${rows.length}`);
  if (rows.length === 0) return;
  console.log(`field keys:`, Object.keys(rows[0]).sort());
  console.log(`row[0]:`, JSON.stringify(rows[0], null, 2));
  const typeField = Object.keys(rows[0]).find((k) => /license.?type|business.?type|category|^type$/i.test(k));
  if (typeField) {
    const distinctUrl = `${DATASET_BASE}/${id}.json?$select=${typeField},count(*)&$group=${typeField}&$order=count_${typeField}+desc&$limit=50`;
    const distinctRes = await fetch(distinctUrl);
    if (distinctRes.ok) {
      console.log(`\ndistinct '${typeField}' values:`);
      console.log(JSON.stringify(await distinctRes.json(), null, 2));
    }
  }
}
async function main() {
  for (const id of CANDIDATE_IDS) await probeDataset(id);
}

main().catch((e) => { console.error(e); process.exit(1); });

export {};
