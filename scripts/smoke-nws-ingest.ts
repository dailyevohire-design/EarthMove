/**
 * NWS ingest smoke test.
 *
 * Self-contained: no env vars, no real network or DB. Stubs the supabase
 * client + injects a synthetic NWS payload via the fetchImpl option.
 * Validates parsing, filtering, and RPC-call shape end-to-end.
 *
 * Usage: pnpm exec tsx scripts/smoke-nws-ingest.ts
 */

import {
  ingestNwsActiveAlerts,
  mapEventType,
  mapSeverity,
  extractStateCodes,
  type IngestSupabaseClient,
} from '../src/lib/disasters/nws-ingest';

let failures = 0;
function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    console.error(`  X ${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  }
}
function assertTrue(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`  X ${msg}`);
    failures++;
  }
}

console.log('-- mapEventType --');
assertEq(mapEventType('Hurricane Warning'), 'hurricane', 'Hurricane');
assertEq(mapEventType('Tropical Storm Watch'), 'tropical_storm', 'Tropical Storm');
assertEq(mapEventType('Tornado Warning'), 'tornado', 'Tornado');
assertEq(mapEventType('Red Flag Warning'), 'wildfire', 'Red Flag');
assertEq(mapEventType('Flash Flood Warning'), 'flood', 'Flash Flood');
assertEq(mapEventType('Severe Thunderstorm Warning'), 'severe_storm', 'Severe Tstorm');
assertEq(mapEventType('Winter Storm Warning'), 'winter_storm', 'Winter Storm');
assertEq(mapEventType('Air Quality Alert'), null, 'Air Quality excluded');
assertEq(mapEventType('Beach Hazards Statement'), null, 'Beach excluded');

console.log('-- mapSeverity --');
assertEq(mapSeverity('Extreme'), 'extreme', 'Extreme');
assertEq(mapSeverity('Severe'), 'severe', 'Severe');
assertEq(mapSeverity('Moderate'), 'moderate', 'Moderate');
assertEq(mapSeverity('Minor'), 'minor', 'Minor');
assertEq(mapSeverity('Unknown'), 'minor', 'Unknown -> minor');

console.log('-- extractStateCodes --');
assertEq(JSON.stringify(extractStateCodes(['COZ001','COZ002','TXZ123'])), JSON.stringify(['CO','TX']), 'CO+TX');
assertEq(JSON.stringify(extractStateCodes([])), '[]', 'empty array');
assertEq(JSON.stringify(extractStateCodes(undefined)), '[]', 'undefined input');
assertEq(JSON.stringify(extractStateCodes(['x','12','CA','CAC037'])), JSON.stringify(['CA']), 'invalid entries skipped');

console.log('-- end-to-end with mock fetch + stub supabase --');

const mockPayload = {
  type: 'FeatureCollection' as const,
  features: [
    { id: 'urn:t:co-tornado',
      properties: { id: 'urn:t:co-tornado', event: 'Tornado Warning',
        headline: 'Tornado Warning Boulder County', severity: 'Extreme' as const,
        sent: '2026-05-13T20:00:00Z', effective: '2026-05-13T20:00:00Z',
        expires: '2026-05-13T22:00:00Z', areaDesc: 'Boulder County, CO',
        geocode: { SAME: ['008013'], UGC: ['COZ013'] } } },
    { id: 'urn:t:ca-fire',
      properties: { id: 'urn:t:ca-fire', event: 'Red Flag Warning',
        headline: 'Red Flag LA', severity: 'Severe' as const,
        sent: '2026-05-13T20:00:00Z', effective: '2026-05-13T20:00:00Z',
        expires: '2026-05-13T23:00:00Z', areaDesc: 'LA County, CA',
        geocode: { SAME: ['006037'], UGC: ['CAZ087'] } } },
    { id: 'urn:t:tx-hurricane',
      properties: { id: 'urn:t:tx-hurricane', event: 'Hurricane Warning',
        headline: 'Hurricane Warning Galveston', severity: 'Extreme' as const,
        sent: '2026-05-13T18:00:00Z', effective: '2026-05-13T19:00:00Z',
        expires: '2026-05-14T18:00:00Z', areaDesc: 'Galveston County, TX',
        geocode: { SAME: ['048167'], UGC: ['TXZ214'] } } },
    { id: 'urn:t:nm-aqi',
      properties: { id: 'urn:t:nm-aqi', event: 'Air Quality Alert',
        headline: 'AQI NM', severity: 'Moderate' as const,
        sent: '2026-05-13T18:00:00Z', effective: '2026-05-13T18:00:00Z',
        expires: '2026-05-13T23:59:00Z', areaDesc: 'Bernalillo County, NM',
        geocode: { SAME: ['035001'], UGC: ['NMZ208'] } } },
  ],
};

const mockFetch: typeof fetch = async () =>
  new Response(JSON.stringify(mockPayload), {
    status: 200,
    headers: { 'Content-Type': 'application/geo+json' },
  });

const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
const stubSupabase: IngestSupabaseClient = {
  rpc: async (fn, args) => {
    rpcCalls.push({ fn, args });
    return { data: 'stub-uuid', error: null };
  },
};

async function main() {
  const summary = await ingestNwsActiveAlerts(stubSupabase, { fetchImpl: mockFetch });

  assertEq(summary.fetched_total, 4, 'fetched_total = 4');
  assertEq(summary.filtered_by_event_type, 1, 'filtered_by_event_type = 1 (AQI)');
  assertEq(summary.filtered_by_market, 1, 'filtered_by_market = 1 (CA fire)');
  assertEq(summary.upserted, 2, 'upserted = 2 (CO tornado + TX hurricane)');
  assertEq(summary.errors.length, 0, '0 errors');
  assertEq(rpcCalls.length, 2, '2 RPC calls');

  const coCall = rpcCalls.find((c) => c.args.p_source_external_id === 'urn:t:co-tornado');
  assertTrue(!!coCall, 'CO call present');
  if (coCall) {
    assertEq(coCall.fn, 'upsert_disaster_window', 'CO call -> upsert_disaster_window');
    assertEq(coCall.args.p_event_type, 'tornado', 'CO event_type');
    assertEq(coCall.args.p_severity, 'extreme', 'CO severity');
    assertEq(coCall.args.p_source, 'nws', 'CO source');
    assertEq(JSON.stringify(coCall.args.p_affected_state_codes), '["CO"]', 'CO state codes');
  }

  const txCall = rpcCalls.find((c) => c.args.p_source_external_id === 'urn:t:tx-hurricane');
  assertTrue(!!txCall, 'TX call present');
  if (txCall) {
    assertEq(txCall.args.p_event_type, 'hurricane', 'TX event_type');
    assertEq(JSON.stringify(txCall.args.p_affected_state_codes), '["TX"]', 'TX state codes');
  }

  if (failures > 0) {
    console.error(`\nFAILED: ${failures} assertion(s) failed`);
    process.exit(1);
  }

  console.log('');
  console.log('OK NWS ingest smoke: ALL TESTS PASSED');
  console.log(`  fetched=${summary.fetched_total}`);
  console.log(`  filtered_by_event_type=${summary.filtered_by_event_type}`);
  console.log(`  filtered_by_state=${summary.filtered_by_state}`);
  console.log(`  filtered_by_market=${summary.filtered_by_market}`);
  console.log(`  upserted=${summary.upserted}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
