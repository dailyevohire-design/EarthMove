import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/setup';
import { extractContractor } from '../extract-contractor';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function turn1Response(opts: { stop_reason?: string; citations?: Array<{ url: string }>; text?: string } = {}) {
  return {
    id: 'msg_t1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-7',
    stop_reason: opts.stop_reason ?? 'end_turn',
    stop_sequence: null,
    content: [
      { type: 'text', text: opts.text ?? 'ACME PLUMBING LLC is licensed in TX.' },
      ...(opts.citations
        ? [{
            type: 'web_search_tool_result',
            tool_use_id: 'srvtoolu_1',
            content: opts.citations.map((c) => ({
              type: 'web_search_result',
              url: c.url,
              title: 'src',
              encrypted_content: 'enc',
            })),
          }]
        : []),
    ],
    usage: { input_tokens: 100, output_tokens: 50, server_tool_use: { web_search_requests: 1 } },
  };
}

function turn2Response(record: any) {
  return {
    id: 'msg_t2',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-7',
    stop_reason: 'tool_use',
    stop_sequence: null,
    content: [
      { type: 'tool_use', id: 'tu_1', name: 'emit_contractor_record', input: record },
    ],
    usage: { input_tokens: 200, output_tokens: 80 },
  };
}

const VALID_RECORD = {
  legal_name: 'ACME PLUMBING LLC',
  dba: null,
  state: 'TX',
  license_number: 'TX-12345',
  license_status: 'ACTIVE',
  issue_date: '2020-01-01',
  expiration_date: '2027-01-01',
  addresses: [],
  phones: [],
  primary_source_url: 'https://www.sos.state.tx.us/corp/123',
  confidence: 0.95,
  notes: null,
};

describe('extractContractor — happy path (search + extract)', () => {
  it('returns record + allowed citations + usage', async () => {
    let callCount = 0;
    server.use(
      http.post(ANTHROPIC_URL, async () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json(turn1Response({
            citations: [
              { url: 'https://www.sos.state.tx.us/corp/123' },
              { url: 'https://www.bbb.org/us/tx/austin/profile/x' },
              { url: 'https://evil.com/scrape' },
            ],
          }));
        }
        return HttpResponse.json(turn2Response(VALID_RECORD));
      }),
    );

    const result = await extractContractor({
      legalName: 'ACME PLUMBING LLC',
      stateCode: 'TX',
    });

    expect(result.record.legal_name).toBe('ACME PLUMBING LLC');
    expect(result.record.state).toBe('TX');
    expect(result.citations).toHaveLength(2);
    expect(result.citations).toEqual(
      expect.arrayContaining([
        'https://www.sos.state.tx.us/corp/123',
        'https://www.bbb.org/us/tx/austin/profile/x',
      ]),
    );
    expect(result.rejectedCitations).toHaveLength(1);
    expect(result.rejectedCitations[0].url).toBe('https://evil.com/scrape');
    expect(result.usage.webSearchRequests).toBe(1);
    expect(result.usage.inputTokens).toBe(300);
    expect(result.usage.outputTokens).toBe(130);
  });
});

describe('extractContractor — extract-only mode (evidenceText provided)', () => {
  it('skips turn 1 and only calls Anthropic once', async () => {
    let callCount = 0;
    server.use(
      http.post(ANTHROPIC_URL, async () => {
        callCount += 1;
        return HttpResponse.json(turn2Response(VALID_RECORD));
      }),
    );

    const result = await extractContractor({
      legalName: 'ACME PLUMBING LLC',
      stateCode: 'TX',
      evidenceText: 'License TX-12345 ACTIVE per https://www.sos.state.tx.us/corp/123',
    });

    expect(callCount).toBe(1);
    expect(result.record.license_number).toBe('TX-12345');
    expect(result.citations).toEqual([]);
    expect(result.usage.webSearchRequests).toBe(0);
  });
});

describe('extractContractor — pause_turn handling', () => {
  it('resumes when stop_reason=pause_turn, capped at maxPauseResumes', async () => {
    let callCount = 0;
    server.use(
      http.post(ANTHROPIC_URL, async () => {
        callCount += 1;
        if (callCount === 1) return HttpResponse.json(turn1Response({ stop_reason: 'pause_turn' }));
        if (callCount === 2) return HttpResponse.json(turn1Response({ stop_reason: 'end_turn',
          citations: [{ url: 'https://www.sos.state.tx.us/corp/123' }] }));
        return HttpResponse.json(turn2Response(VALID_RECORD));
      }),
    );

    const result = await extractContractor({
      legalName: 'ACME PLUMBING LLC',
      stateCode: 'TX',
      maxPauseResumes: 2,
    });

    expect(callCount).toBe(3);
    expect(result.record.legal_name).toBe('ACME PLUMBING LLC');
  });
});

describe('extractContractor — rejection paths', () => {
  it('throws when primary_source_url fails allowlist', async () => {
    server.use(
      http.post(ANTHROPIC_URL, async () => {
        const bad = { ...VALID_RECORD, primary_source_url: 'https://evil.example.com/page' };
        return HttpResponse.json(turn2Response(bad));
      }),
    );

    await expect(
      extractContractor({
        legalName: 'ACME PLUMBING LLC',
        stateCode: 'TX',
        evidenceText: 'pre-fetched evidence',
      }),
    ).rejects.toThrow(/primary_source_url failed allowlist/);
  });

  it('throws when state mismatches input', async () => {
    server.use(
      http.post(ANTHROPIC_URL, async () => {
        const wrongState = { ...VALID_RECORD, state: 'CA' };
        return HttpResponse.json(turn2Response(wrongState));
      }),
    );

    await expect(
      extractContractor({
        legalName: 'ACME PLUMBING LLC',
        stateCode: 'TX',
        evidenceText: 'pre-fetched',
      }),
    ).rejects.toThrow(/state mismatch/);
  });

  it('throws when turn 2 returns no tool_use block', async () => {
    server.use(
      http.post(ANTHROPIC_URL, async () => {
        return HttpResponse.json({
          id: 'msg_x', type: 'message', role: 'assistant', model: 'claude-opus-4-7',
          stop_reason: 'end_turn', stop_sequence: null,
          content: [{ type: 'text', text: 'I refuse' }],
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      }),
    );

    await expect(
      extractContractor({
        legalName: 'ACME PLUMBING LLC',
        stateCode: 'TX',
        evidenceText: 'pre-fetched',
      }),
    ).rejects.toThrow(/did not return emit_contractor_record/);
  });
});

describe('extractContractor — input validation', () => {
  it('rejects empty legalName', async () => {
    await expect(
      extractContractor({ legalName: '   ', stateCode: 'TX' }),
    ).rejects.toThrow(/legalName is required/);
  });

  it('rejects bad stateCode', async () => {
    await expect(
      extractContractor({ legalName: 'X', stateCode: 'TXX' }),
    ).rejects.toThrow(/stateCode must be 2 letters/);
  });
});
