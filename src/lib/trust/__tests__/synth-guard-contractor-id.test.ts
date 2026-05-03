import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { InngestTestEngine } from '@inngest/test';
import { server } from '../../../test/setup';
import { runTrustSynthesizeV2 } from '../inngest-functions';

beforeAll(() => {
  // InngestTestEngine emits telemetry to api.inngest.com; intercept and 200 it.
  server.use(http.post('https://api.inngest.com/*', () => HttpResponse.json({ ok: true })));
});

const updateCalls: Array<Record<string, unknown>> = [];
const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => {
    const builder: any = {
      select() { return builder; },
      eq() { return Promise.resolve({ data: null, error: null }); },
      single() { return Promise.resolve({ data: null, error: null }); },
      update(payload: Record<string, unknown>) {
        updateCalls.push(payload);
        return {
          eq: () => Promise.resolve({ data: null, error: null }),
        };
      },
    };
    return {
      from: () => builder,
      rpc: rpcMock,
    };
  },
}));

describe('runTrustSynthesizeV2 — Tier 1 #2 contractor_id guard', () => {
  beforeEach(() => {
    updateCalls.length = 0;
    rpcMock.mockClear();
  });

  it('skips and marks job failed when contractor_id is null', async () => {
    const t = new InngestTestEngine({ function: runTrustSynthesizeV2 });
    const { result } = await t.execute({
      events: [{ name: 'trust/job.synthesize.requested', data: { job_id: 'job-null-contractor' } }],
      steps: [
        {
          id: 'synth-load-job',
          handler: () => ({
            id: 'job-null-contractor',
            tier: 'free',
            contractor_name_input: 'Acme LLC',
            city: 'Denver',
            state_code: 'CO',
            contractor_id: null,
            status: 'synthesizing',
          }),
        },
        // Deliberately NO handler for synth-guard-fail-no-contractor — the real
        // function body executes and hits the mocked supabase admin so we can
        // assert the UPDATE payload directly.
      ],
    });

    expect(result).toEqual({ skipped: true, reason: 'missing_contractor_id_pre_synth' });

    // Assert: trust_jobs UPDATE called with status='failed' + correct reason
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toMatchObject({
      status: 'failed',
      error_message: 'missing_contractor_id_pre_synth',
    });
    expect(typeof updateCalls[0].completed_at).toBe('string');

    // Assert: synthesis tools (score RPC, finalize RPC, project RPC) never invoked
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('does NOT trip when contractor_id is present', async () => {
    const t = new InngestTestEngine({ function: runTrustSynthesizeV2 });
    const { result } = await t.execute({
      events: [{ name: 'trust/job.synthesize.requested', data: { job_id: 'job-with-contractor' } }],
      steps: [
        {
          id: 'synth-load-job',
          handler: () => ({
            id: 'job-with-contractor',
            tier: 'free',
            contractor_name_input: 'Acme LLC',
            city: 'Denver',
            state_code: 'CO',
            contractor_id: 'contractor-uuid',
            status: 'synthesizing',
          }),
        },
        {
          id: 'synth-compute-score',
          handler: () => ({
            composite_score: 85, grade: 'A', risk_level: 'low',
            phoenix_score: 100, evidence_count: 5, structured_hit_rate: 0.6,
            sanction_hit: false, license_suspended: false,
            legal_score: 80, business_entity_score: 80, license_score: 80,
            bbb_score: 80, osha_score: 80,
          }),
        },
        { id: 'synth-load-evidence', handler: () => [] },
        {
          id: 'synth-generate',
          handler: () => ({
            summary: 'test',
            red_flags: [],
            positives: [],
            confidence: 'MEDIUM',
            phoenix_pattern_assessment: 'No phoenix-company indicators detected.',
          }),
        },
        { id: 'synth-finalize-report', handler: () => ({ id: 'report-uuid' }) },
        { id: 'synth-mark-completed', handler: () => null },
        {
          id: 'load-report-for-event',
          handler: () => ({
            report_id: 'report-uuid',
            job_id: 'job-with-contractor',
            contractor_id: 'contractor-uuid',
            trust_score: 85,
          }),
        },
        { id: 'trust-report-created-emit', handler: () => null },
      ],
    });

    expect(result).toMatchObject({
      job_id: 'job-with-contractor',
      reportId: 'report-uuid',
    });
    // Guard not tripped → no failure-marking UPDATE
    expect(updateCalls).toHaveLength(0);
  });
});
