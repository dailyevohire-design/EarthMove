import { describe, it, expect, vi, beforeAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { InngestTestEngine } from '@inngest/test';
import { server } from '../../../test/setup';
import { runTrustJobV2 } from '../inngest-functions';

beforeAll(() => {
  // InngestTestEngine emits telemetry to api.inngest.com; intercept and 200 it.
  server.use(http.post('https://api.inngest.com/*', () => HttpResponse.json({ ok: true })));
});

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => makeFakeAdmin(),
}));

function makeFakeAdmin() {
  const builder: any = {
    select() { return builder; },
    eq() { return builder; },
    single() {
      return Promise.resolve({
        data: {
          id: 'job-test',
          tier: 'standard',
          contractor_name: 'TEST PLUMBING LLC',
          state_code: 'TX',
          city: 'Austin',
          contractor_id: null,
        },
        error: null,
      });
    },
    update() { return builder; },
    insert() { return builder; },
    head: true,
    count: 0,
    then(onF: any, onR: any) {
      return Promise.resolve({ data: null, error: null, count: 0 }).then(onF, onR);
    },
  };
  return {
    from: () => builder,
    rpc: vi.fn().mockResolvedValue({
      data: { id: 'contractor-uuid' },
      error: null,
    }),
  };
}

// TIER_SOURCES.standard now dispatches 5 sources per job — sam-gov + 2 SOS + 2 permits.
const PAID_SOURCES = ['sam_gov_exclusions', 'co_sos_biz', 'tx_sos_biz', 'denver_pim', 'dallas_open_data'];

describe('runTrustJobV2 — fan-out smoke', () => {
  it('runs the standard-tier flow with mocked steps', async () => {
    const t = new InngestTestEngine({ function: runTrustJobV2 });
    const { result } = await t.execute({
      events: [{ name: 'trust/job.requested.v2', data: { job_id: 'job-test' } }],
      steps: [
        { id: 'v2-load-job', handler: () => ({
          id: 'job-test', tier: 'standard',
          contractor_name: 'TEST PLUMBING LLC', state_code: 'TX', city: 'Austin',
          contractor_id: null,
        })},
        { id: 'v2-resolve-contractor', handler: () => ({ id: 'contractor-uuid' }) },
        { id: 'v2-mark-running', handler: () => null },
        ...PAID_SOURCES.map((sourceKey, i) => ({
          id: `v2-scrape-${sourceKey}`,
          handler: () => ({ ok: true, evidenceIds: [`ev${i}`], sourceKey, findingCount: 1 }),
        })),
        { id: 'v2-update-counters', handler: () => null },
        { id: 'trust-synthesize-emit', handler: () => null },
      ],
    });
    expect(result).toMatchObject({
      job_id: 'job-test',
      sources_attempted: PAID_SOURCES.length,
      completed: PAID_SOURCES.length,
      failed: 0,
    });
  });

  it('handles per-source failure as failed count, not function failure', async () => {
    const t = new InngestTestEngine({ function: runTrustJobV2 });
    const { result } = await t.execute({
      events: [{ name: 'trust/job.requested.v2', data: { job_id: 'job-test' } }],
      steps: [
        { id: 'v2-load-job', handler: () => ({
          id: 'job-test', tier: 'standard',
          contractor_name: 'TEST PLUMBING LLC', state_code: 'TX', city: 'Austin',
          contractor_id: null,
        })},
        { id: 'v2-resolve-contractor', handler: () => ({ id: 'contractor-uuid' }) },
        { id: 'v2-mark-running', handler: () => null },
        // sam-gov fails; the other 4 succeed
        { id: 'v2-scrape-sam_gov_exclusions', handler: () => ({
          ok: false, sourceKey: 'sam_gov_exclusions', error: 'simulated upstream 502',
        })},
        ...PAID_SOURCES.slice(1).map((sourceKey, i) => ({
          id: `v2-scrape-${sourceKey}`,
          handler: () => ({ ok: true, evidenceIds: [`ev${i}`], sourceKey, findingCount: 1 }),
        })),
        { id: 'v2-update-counters', handler: () => null },
        { id: 'trust-synthesize-emit', handler: () => null },
      ],
    });
    expect(result).toMatchObject({
      job_id: 'job-test',
      sources_attempted: PAID_SOURCES.length,
      completed: PAID_SOURCES.length - 1,
      failed: 1,
    });
  });
});
