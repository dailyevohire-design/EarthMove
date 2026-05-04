import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  // 1. Pull last 20 sam_gov evidence rows — what error shape are we getting?
  console.log('===== Last 20 sam_gov evidence rows =====\n');
  const { data: ev } = await supabase
    .from('trust_evidence')
    .select('job_id, finding_type, finding_summary, raw_response, created_at, confidence')
    .eq('source_key', 'sam_gov_exclusions')
    .order('created_at', { ascending: false })
    .limit(20);
  ev?.forEach((r) => {
    const raw = typeof r.raw_response === 'object' ? JSON.stringify(r.raw_response).slice(0, 400) : String(r.raw_response).slice(0, 400);
    console.log(`[${r.created_at}] ${r.finding_type} (conf=${r.confidence})`);
    console.log(`  summary: ${r.finding_summary?.slice(0, 200)}`);
    console.log(`  raw: ${raw}\n`);
  });

  // 2. SAM_API_KEY presence check (don't print the key, just confirm length and prefix)
  console.log('===== SAM.gov source registry config =====\n');
  const { data: reg, error: regErr } = await supabase
    .from('trust_source_registry')
    .select('source_key, base_url, query_template, auth_type, rate_limit_per_minute, is_active, notes, metadata, updated_at')
    .eq('source_key', 'sam_gov_exclusions')
    .single();
  if (regErr) console.log(`registry lookup error: ${regErr.message}`);
  else console.log(JSON.stringify(reg, null, 2));

  // 3. Direct SAM.gov call right now with current key — does it work or not?
  console.log('\n===== Live SAM.gov probe with current key =====\n');
  const key = process.env.SAM_API_KEY;
  if (!key) {
    console.log('SAM_API_KEY not in process.env — script-side env missing');
  } else {
    console.log(`SAM_API_KEY present, length=${key.length}, prefix=${key.slice(0, 4)}...`);
    // Hit the exclusions endpoint with a known-clean test name
    const testUrl = `https://api.sam.gov/entity-information/v3/entities?api_key=${key}&samRegistered=Yes&legalBusinessName=PCL+Construction+Services`;
    try {
      const res = await fetch(testUrl);
      console.log(`status: ${res.status}`);
      const body = await res.text();
      console.log(`body (first 1500 chars):\n${body.slice(0, 1500)}`);
    } catch (e: any) {
      console.log(`fetch threw: ${e?.message}`);
    }
  }

  // 4. Cross-state scraper damage — count rows per source_key
  console.log('\n===== Cross-state scraper damage audit =====\n');
  for (const sk of ['co_dora', 'tx_tdlr', 'denver_pim', 'dallas_open_data', 'sam_gov_exclusions']) {
    const { count } = await supabase.from('trust_evidence').select('*', { count: 'exact', head: true }).eq('source_key', sk);
    console.log(`  ${sk}: ${count} total evidence rows`);
  }
})();
