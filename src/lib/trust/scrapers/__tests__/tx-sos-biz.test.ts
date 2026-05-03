import { describe, it, expect, vi } from 'vitest';
import { scrapeTxSosBiz } from '../tx-sos-biz';
import { ScraperRateLimitError, ScraperUpstreamError, ScraperTimeoutError } from '../types';

function mockResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers ?? { 'Content-Type': 'application/json' },
  });
}

describe('scrapeTxSosBiz', () => {
  it('emits business_active when sos_status_code=A and right_to_transact=A', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse([{
      taxpayer_number: '32063342011',
      taxpayer_name: "BULL'S LAWN CARE LLC",
      taxpayer_organizational_type: 'CL',
      responsibility_beginning_date: '03/31/2017',
      secretary_of_state_sos_or_coa_file_number: '0802687829',
      sos_charter_date: '03/31/2017',
      sos_status_date: '03/31/2017',
      sos_status_code: 'A',
      right_to_transact_business_code: 'A',
      taxpayer_address: '458 FM 9 S',
      taxpayer_city: 'WASKOM',
      taxpayer_state: 'TX',
      taxpayer_zip: '75692',
    }]));
    const ev = await scrapeTxSosBiz({ legalName: "Bull's Lawn Care LLC", fetchFn });
    expect(ev.finding_type).toBe('business_active');
    expect(ev.confidence).toBe('verified_structured');
    expect(ev.extracted_facts.entity_type).toBe('Domestic LLC');
    expect(ev.extracted_facts.formation_date).toBe('2017-03-31');
    expect(ev.extracted_facts.officers).toEqual([]);
  });

  it('emits business_inactive when right_to_transact != A', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse([{
      taxpayer_number: '32095586189',
      taxpayer_name: 'ALBERTROSE TRANSPORTATION LLC',
      taxpayer_organizational_type: 'CI',
      responsibility_beginning_date: '02/09/2023',
      sos_status_code: '',
      right_to_transact_business_code: 'N',
    }]));
    const ev = await scrapeTxSosBiz({ legalName: 'Albertrose Transportation LLC', fetchFn });
    expect(ev.finding_type).toBe('business_inactive');
    expect(ev.extracted_facts.officers).toEqual([]);
  });

  it('emits business_not_found with unverified confidence and disclaimer on zero rows', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse([]));
    const ev = await scrapeTxSosBiz({ legalName: 'Nonexistent Texas Entity LLC', fetchFn });
    expect(ev.finding_type).toBe('business_not_found');
    expect(ev.confidence).toBe('unverified');
    expect(ev.extracted_facts.match_count).toBe(0);
    expect(ev.extracted_facts.officers).toEqual([]);
    expect(typeof ev.extracted_facts.disclaimer).toBe('string');
  });

  it('officers always empty (TX dataset has no officer data)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse([{
      taxpayer_number: '1', taxpayer_name: 'TEST LLC',
      taxpayer_organizational_type: 'CL', sos_status_code: 'A',
      right_to_transact_business_code: 'A',
    }]));
    const ev = await scrapeTxSosBiz({ legalName: 'Test LLC', fetchFn });
    expect(ev.extracted_facts.officers).toEqual([]);
  });

  it('throws ScraperRateLimitError on 429', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('rate limited', {
      status: 429, headers: { 'retry-after': '120' },
    }));
    await expect(scrapeTxSosBiz({ legalName: 'Test', fetchFn })).rejects.toBeInstanceOf(ScraperRateLimitError);
  });

  it('throws ScraperUpstreamError on 5xx', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('boom', { status: 503 }));
    await expect(scrapeTxSosBiz({ legalName: 'Test', fetchFn })).rejects.toBeInstanceOf(ScraperUpstreamError);
  });

  it('throws ScraperTimeoutError on abort', async () => {
    const fetchFn = vi.fn().mockImplementation((_url: string, opts: RequestInit) => new Promise((_, reject) => {
      opts.signal?.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }));
    await expect(scrapeTxSosBiz({ legalName: 'Test', fetchFn, timeoutMs: 10 })).rejects.toBeInstanceOf(ScraperTimeoutError);
  });

  it('throws on empty legalName', async () => {
    await expect(scrapeTxSosBiz({ legalName: '   ' })).rejects.toThrow('legalName required');
  });
});
