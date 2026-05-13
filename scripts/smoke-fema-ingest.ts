import {
  ingestFemaDisasters,
  mapIncidentType,
  mapDeclarationSeverity,
  type IngestSupabaseClient,
} from '../src/lib/disasters/fema-ingest';

let failures = 0;
function assertEq<T>(a: T, b: T, label: string) {
  if (a !== b) { console.error('X ' + label + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); failures++; }
}
function assertTrue(c: boolean, label: string) { if (!c) { console.error('X ' + label); failures++; } }

async function main() {
  console.log('-- mapIncidentType --');
  assertEq(mapIncidentType('Hurricane'), 'hurricane', 'Hurricane');
  assertEq(mapIncidentType('Severe Storm(s)'), 'severe_storm', 'Severe Storm');
  assertEq(mapIncidentType('Wildfire'), 'wildfire', 'Wildfire');
  assertEq(mapIncidentType('Fire'), 'wildfire', 'Fire -> wildfire');
  assertEq(mapIncidentType('Flood'), 'flood', 'Flood');
  assertEq(mapIncidentType('Biological'), null, 'Biological filtered');

  console.log('-- mapDeclarationSeverity --');
  assertEq(mapDeclarationSeverity('DR'), 'severe', 'DR');
  assertEq(mapDeclarationSeverity('EM'), 'moderate', 'EM');
  assertEq(mapDeclarationSeverity('FM'), 'moderate', 'FM');
  assertEq(mapDeclarationSeverity('X'),  'minor',    'unknown');

  console.log('-- end-to-end --');
  const payload = {
    DisasterDeclarationsSummaries: [
      { disasterNumber: 4900, state: 'CO', declarationType: 'DR', declarationDate: '2026-05-01T00:00:00.000Z', incidentType: 'Severe Storm(s)', declarationTitle: 'CO Severe Storm', incidentBeginDate: '2026-04-28T00:00:00.000Z', incidentEndDate: '2026-04-30T00:00:00.000Z', designatedArea: 'Boulder County' },
      { disasterNumber: 4900, state: 'CO', declarationType: 'DR', declarationDate: '2026-05-01T00:00:00.000Z', incidentType: 'Severe Storm(s)', declarationTitle: 'CO Severe Storm', incidentBeginDate: '2026-04-28T00:00:00.000Z', incidentEndDate: '2026-04-30T00:00:00.000Z', designatedArea: 'Larimer County' },
      { disasterNumber: 4901, state: 'TX', declarationType: 'DR', declarationDate: '2026-04-20T00:00:00.000Z', incidentType: 'Hurricane', declarationTitle: 'TX Hurricane', incidentBeginDate: '2026-04-15T00:00:00.000Z', incidentEndDate: '2026-04-18T00:00:00.000Z', designatedArea: 'Galveston County' },
      { disasterNumber: 4902, state: 'CA', declarationType: 'FM', declarationDate: '2026-05-10T00:00:00.000Z', incidentType: 'Wildfire', declarationTitle: 'CA Wildfire', incidentBeginDate: '2026-05-09T00:00:00.000Z', incidentEndDate: '2026-05-10T00:00:00.000Z', designatedArea: 'LA County' },
      { disasterNumber: 4903, state: 'CO', declarationType: 'EM', declarationDate: '2026-04-01T00:00:00.000Z', incidentType: 'Biological', declarationTitle: 'CO Biological', incidentBeginDate: '2026-04-01T00:00:00.000Z', incidentEndDate: '2026-04-15T00:00:00.000Z', designatedArea: 'Denver County' },
    ],
  };
  const mockFetch: typeof fetch = async () => new Response(JSON.stringify(payload), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const stub: IngestSupabaseClient = {
    rpc: async (fn, args) => { rpcCalls.push({ fn, args }); return { data: 'stub', error: null }; },
  };

  const summary = await ingestFemaDisasters(stub, { fetchImpl: mockFetch });

  assertEq(summary.fetched_total, 5, 'fetched 5');
  assertEq(summary.filtered_by_event_type, 1, 'Biological filtered');
  assertEq(summary.filtered_by_market, 1, 'CA market-filtered');
  assertEq(summary.upserted, 2, 'CO dedup + TX upserted = 2');
  assertEq(summary.errors.length, 0, '0 errors');
  assertEq(rpcCalls.length, 2, '2 RPC calls (deduped)');

  const co = rpcCalls.find(c => c.args.p_source_external_id === 'fema:4900:CO');
  assertTrue(!!co, 'CO call present');
  if (co) {
    assertEq(co.args.p_event_type, 'severe_storm', 'CO event_type');
    assertEq(co.args.p_severity, 'severe', 'CO severity DR -> severe');
    assertEq(co.args.p_source, 'fema', 'CO source');
  }

  if (failures > 0) { console.error('\nFAILED: ' + failures + ' assertion(s)'); process.exit(1); }
  console.log('OK FEMA ingest smoke: ALL TESTS PASSED');
  console.log('  fetched=' + summary.fetched_total + ' upserted=' + summary.upserted);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
