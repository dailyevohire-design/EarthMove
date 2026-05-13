import {
  ingestAustinPermits,
  type IngestSupabaseClient,
} from '../src/lib/permits/austin-ingest';

let failures = 0;
function assertEq<T>(a: T, b: T, label: string) {
  if (a !== b) { console.error('X ' + label + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); failures++; }
}
function assertTrue(c: boolean, label: string) { if (!c) { console.error('X ' + label); failures++; } }

async function main() {
  console.log('-- end-to-end Austin permits --');
  const payload = [
    { project_id: '2026-001', permit_class: 'Residential', permit_type_desc: 'Building Permit', applied_date: '2026-04-01T00:00:00.000', issued_date: '2026-04-15T00:00:00.000', status_current: 'Active', original_address1: '123 Main St', original_city: 'Austin', original_state: 'TX', original_zip: '78704', contractor_company_name: 'ACME Construction LLC', contractor_full_name: 'John Smith', work_class: 'New', description: 'Single family residence', total_valuation_remodel: '350000', latitude: '30.25', longitude: '-97.75' },
    { project_id: '2026-002', permit_class: 'Commercial', permit_type_desc: 'Mechanical Permit', applied_date: '2026-04-05T00:00:00.000', issued_date: '2026-04-20T00:00:00.000', status_current: 'Issued', original_address1: '500 Congress Ave', original_city: 'Austin', original_state: 'TX', original_zip: '78701', contractor_company_name: 'Bedrock Mechanical', work_class: 'Remodel', total_valuation_remodel: '85000' },
    { project_id: '2026-003', original_address1: '456 Oak St', contractor_company_name: 'No Date Co' },
    { project_id: '2026-004', applied_date: '2026-04-10T00:00:00.000', original_address1: '789 Pine St' },
    { project_id: '2026-005', applied_date: '2026-04-12T00:00:00.000', contractor_company_name: 'No Address Co' },
  ];

  const mockFetch: typeof fetch = async () => new Response(JSON.stringify(payload), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const stub: IngestSupabaseClient = {
    rpc: async (fn, args) => { rpcCalls.push({ fn, args }); return { data: 'stub', error: null }; },
  };

  const summary = await ingestAustinPermits(stub, { fetchImpl: mockFetch });

  assertEq(summary.fetched_total, 5, 'fetched 5 raw');
  assertEq(summary.skipped_no_contractor, 1, '1 no-contractor');
  assertEq(summary.skipped_no_address, 1, '1 no-address');
  assertEq(summary.upserted, 3, '3 upserted');
  assertEq(summary.errors.length, 0, '0 errors');
  assertEq(rpcCalls.length, 3, '3 RPC calls');

  const acme = rpcCalls.find(c => c.args.p_contractor_raw === 'ACME Construction LLC');
  assertTrue(!!acme, 'ACME call present');
  if (acme) {
    assertEq(acme.fn, 'upsert_contractor_permit', 'ACME -> upsert_contractor_permit');
    assertEq(acme.args.p_source, 'austin_open_data', 'ACME source');
    assertEq(acme.args.p_state, 'TX', 'ACME state');
    assertEq(acme.args.p_city, 'Austin', 'ACME city');
    assertEq(acme.args.p_value, 350000, 'ACME value parsed');
    assertEq(acme.args.p_lat, 30.25, 'ACME lat parsed');
    assertEq(acme.args.p_issued, '2026-04-15', 'ACME issued date truncated');
    assertEq(acme.args.p_contractor_id, null, 'contractor_id NULL (resolution deferred)');
  }

  if (failures > 0) { console.error('\nFAILED: ' + failures + ' assertion(s)'); process.exit(1); }
  console.log('OK Austin permit smoke: ALL TESTS PASSED');
  console.log('  fetched=' + summary.fetched_total + ' upserted=' + summary.upserted);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
