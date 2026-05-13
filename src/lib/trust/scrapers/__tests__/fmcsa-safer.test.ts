import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeFmcsaSafer } from '../fmcsa-safer';

function mockJson(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('scrapeFmcsaSafer', () => {
  beforeEach(() => {
    process.env.FMCSA_WEB_KEY = 'test-webkey';
  });
  afterEach(() => {
    delete process.env.FMCSA_WEB_KEY;
  });

  it('webkey-invalid response → source_error with reason=auth_failed', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      mockJson({ content: 'Webkey not found', _links: {} }),
    );
    const result = await scrapeFmcsaSafer({ legalName: 'TEST CO', fetchFn });
    const ev = Array.isArray(result) ? result[0] : result;
    expect(ev.finding_type).toBe('source_error');
    expect(ev.extracted_facts.reason).toBe('auth_failed');
    expect(ev.extracted_facts.raw_message).toBe('Webkey not found');
  });

  it('other string content → source_error with reason=api_string_response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      mockJson({ content: 'Some other API string', _links: {} }),
    );
    const result = await scrapeFmcsaSafer({ legalName: 'TEST CO', fetchFn });
    const ev = Array.isArray(result) ? result[0] : result;
    expect(ev.finding_type).toBe('source_error');
    expect(ev.extracted_facts.reason).toBe('api_string_response');
    expect(ev.extracted_facts.raw_message).toBe('Some other API string');
  });

  it('valid single-carrier response → usdot_active + usdot_safety_satisfactory', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson({
      content: {
        carrier: {
          dotNumber: '123',
          legalName: 'TEST CO',
          operatingStatus: 'ACTIVE',
          safetyRating: 'Satisfactory',
        },
      },
    }));
    const result = await scrapeFmcsaSafer({ legalName: 'TEST CO', fetchFn });
    expect(Array.isArray(result)).toBe(true);
    const arr = result as Array<{ finding_type: string; extracted_facts: Record<string, unknown> }>;
    const findings = arr.map((e) => e.finding_type);
    expect(findings).toContain('usdot_active');
    expect(findings).toContain('usdot_safety_satisfactory');
    expect(arr[0].extracted_facts.dot_number).toBe('123');
    expect(arr[0].extracted_facts.legal_name).toBe('TEST CO');
  });

  it('hits canonical /qc/name/ path (not legacy /qc/services/carriers)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson({ content: [] }));
    await scrapeFmcsaSafer({ legalName: 'TEST CO', fetchFn });
    expect(fetchFn).toHaveBeenCalledOnce();
    const calledUrl = String(fetchFn.mock.calls[0][0]);
    expect(calledUrl).toContain('/qc/name/');
    expect(calledUrl).not.toContain('/qc/services/carriers');
  });

  it('webkey-missing env returns source_not_applicable without fetching', async () => {
    delete process.env.FMCSA_WEB_KEY;
    const fetchFn = vi.fn();
    const result = await scrapeFmcsaSafer({ legalName: 'TEST CO', fetchFn });
    const ev = Array.isArray(result) ? result[0] : result;
    expect(ev.finding_type).toBe('source_not_applicable');
    expect(ev.extracted_facts.reason).toBe('fmcsa_webkey_missing');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
