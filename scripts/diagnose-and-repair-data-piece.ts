import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  // ============ STAGE 1: Test pollution audit + cleanup ============
  console.log('===== STAGE 1: Test pollution audit =====\n');
  const { data: testRows } = await supabase
    .from('contractors')
    .select('id, legal_name, normalized_name, state_code, first_seen_at')
    .or('legal_name.ilike.test_%,legal_name.ilike.TEST_%,legal_name.ilike.%smoke_test%,normalized_name.ilike.test_%');
  console.log(`Found ${testRows?.length || 0} test-polluted contractor rows:`);
  testRows?.forEach((r) => console.log(`  ${r.id} | ${r.legal_name} | ${r.state_code}`));

  // Don't delete — just exclude from manifest. Deletion can ride a post-launch followup
  // since cascading deletes touch trust_jobs, trust_reports, trust_evidence, contractor_trust_scores.

  // ============ STAGE 2: Score distribution diagnostic ============
  console.log('\n===== STAGE 2: Score distribution diagnostic =====\n');
  const manifest = JSON.parse(fs.readFileSync('data_piece/sample_manifest.json', 'utf-8'));
  const allCompleted = manifest.entries.filter((e: any) => e.status === 'completed' && e.trust_score !== null);
  const testNames = new Set((testRows || []).map((r) => r.legal_name));
  const completed = allCompleted.filter((e: any) => !testNames.has(e.legal_name) && !/^test_|^TEST_|smoke_test/i.test(e.legal_name));
  console.log(`Pre-filter: ${allCompleted.length}, post-filter: ${completed.length}, removed: ${allCompleted.length - completed.length}`);

  // Score histogram
  const scoreBuckets: Record<string, number> = {};
  for (const e of completed) {
    const bucket = Math.floor(e.trust_score / 5) * 5;
    const key = `${bucket}-${bucket + 4}`;
    scoreBuckets[key] = (scoreBuckets[key] || 0) + 1;
  }
  console.log('Score histogram (5-pt buckets):');
  Object.keys(scoreBuckets).sort((a, b) => parseInt(a) - parseInt(b)).forEach((k) => {
    const n = scoreBuckets[k];
    console.log(`  ${k.padEnd(7)} | ${'█'.repeat(n).padEnd(50)} | ${n}`);
  });

  // Distinct exact scores — confirms terminal's "tied at 97" finding
  const distinctScores = Array.from(new Set(completed.map((e: any) => e.trust_score))).sort((a: any, b: any) => a - b);
  console.log(`\nDistinct exact scores: ${distinctScores.length} unique values across ${completed.length} entities`);
  console.log(`Top scores by frequency:`);
  const scoreFreq = completed.reduce((acc: any, e: any) => { acc[e.trust_score] = (acc[e.trust_score] || 0) + 1; return acc; }, {});
  Object.entries(scoreFreq).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10).forEach(([score, n]) => {
    console.log(`  ${score} → ${n} entities`);
  });

  // ============ STAGE 3: Source-coverage hypothesis test ============
  console.log('\n===== STAGE 3: Source-coverage hypothesis test =====\n');
  // Pick 5 random TX entities, dump their evidence rows by source_key + finding_type
  const txSample = completed.filter((e: any) => e.state_code === 'TX').slice(0, 5);
  for (const e of txSample) {
    const { data: ev } = await supabase
      .from('trust_evidence')
      .select('source_key, finding_type, confidence, finding_summary')
      .eq('job_id', e.job_id);
    console.log(`\n${e.legal_name} (${e.trust_score}/100, job ${e.job_id?.slice(0, 8)})`);
    console.log(`  Evidence rows: ${ev?.length || 0}`);
    const bySource: Record<string, string[]> = {};
    (ev || []).forEach((r) => {
      if (!bySource[r.source_key]) bySource[r.source_key] = [];
      bySource[r.source_key].push(r.finding_type);
    });
    Object.entries(bySource).forEach(([source, types]) => {
      console.log(`    ${source}: ${types.join(', ')}`);
    });
  }

  // ============ STAGE 4: Bimodal-distribution diagnostic ============
  console.log('\n===== STAGE 4: Bimodal score components diagnostic =====\n');
  // Pull contractor_trust_scores for the completed sample to see WHY scores cluster
  const contractorIds = completed.map((e: any) => e.contractor_id).filter(Boolean);
  const { data: scoreRows } = await supabase
    .from('contractor_trust_scores')
    .select('contractor_id, license_score, business_entity_score, legal_score, osha_score, bbb_score, phoenix_score, age_score, composite_score')
    .in('contractor_id', contractorIds);

  if (scoreRows && scoreRows.length > 0) {
    console.log('Component score distribution (mean/median across sample):');
    const components = ['license_score', 'business_entity_score', 'legal_score', 'osha_score', 'bbb_score', 'phoenix_score', 'age_score', 'composite_score'];
    for (const c of components) {
      const vals = scoreRows.map((r: any) => r[c]).filter((v: any) => v !== null) as number[];
      if (vals.length === 0) { console.log(`  ${c}: all null`); continue; }
      const sorted = [...vals].sort((a, b) => a - b);
      const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
      const distinct = new Set(vals).size;
      console.log(`  ${c.padEnd(22)} n=${vals.length} mean=${mean.toFixed(1)} median=${sorted[Math.floor(vals.length / 2)]} distinct=${distinct}`);
    }
  }

  console.log('\n===== STAGE 5: Awaiting decision before regenerating findings =====');
  console.log('If bimodal looks deterministic (every component is one of 2-3 fixed values), DO NOT publish histogram in findings.');
  console.log('If 7-of-7 source coverage is mostly *_not_found / *_no_record / source_not_applicable, source-coverage claim IS honest.');
})();
