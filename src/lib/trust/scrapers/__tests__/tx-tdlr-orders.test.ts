import { describe, it, expect, vi } from 'vitest';
import { scrapeTxTdlrOrders } from '../tx-tdlr-orders';
import { ScraperRateLimitError, ScraperUpstreamError, ScraperTimeoutError } from '../types';

function mockJson(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ASOF = new Date('2026-05-03T00:00:00Z');

describe('scrapeTxTdlrOrders (post-pivot to Socrata 7358-krk7)', () => {
  it('emits license_active for matching row with future expiration', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([{
      license_type: 'A/C Contractor', license_number: '27289',
      business_name: 'UNIFIED CONSTRUCTION SOLUTIONS INC',
      owner_name: 'SCHNEIDER, JAMES D', business_county: 'TARRANT',
      license_subtype: 'AC',
      license_expiration_date_mmddccyy: '08/15/2026',
    }]));
    const ev = await scrapeTxTdlrOrders({ legalName: 'UNIFIED CONSTRUCTION SOLUTIONS', fetchFn, asOf: ASOF });
    expect(ev.finding_type).toBe('license_active');
    expect(ev.extracted_facts.license_number).toBe('27289');
    expect(ev.extracted_facts.license_type).toBe('A/C Contractor');
    expect(ev.extracted_facts.license_expiration_date).toBe('2026-08-15');
  });

  it('emits license_expired when expiration is in past', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([{
      license_type: 'A/C Technician', license_number: '753',
      business_name: 'MURPHY, DAVID M',
      license_expiration_date_mmddccyy: '07/25/2025', // past relative to ASOF
    }]));
    const ev = await scrapeTxTdlrOrders({ legalName: 'MURPHY DAVID', fetchFn, asOf: ASOF });
    expect(ev.finding_type).toBe('license_expired');
    expect(ev.extracted_facts.license_expiration_date).toBe('2025-07-25');
  });

  it('emits license_no_record on zero rows', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([]));
    const ev = await scrapeTxTdlrOrders({ legalName: 'PCL Construction Services', fetchFn, asOf: ASOF });
    expect(ev.finding_type).toBe('license_no_record');
    expect(ev.extracted_facts.match_count).toBe(0);
  });

  // REGRESSION: pre-pivot scraper false-positive case. PCL Construction
  // Services is a GC; not in TDLR's licensed-trade list. Pre-pivot scraper
  // emitted license_disciplinary_action with ~18 rows by parsing TDLR's
  // form-homepage <table> nav. Post-pivot, no rows match in 7358-krk7 →
  // license_no_record cleanly.
  it('regression: false-positive case from PR #9 prod smoke now returns license_no_record', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([])); // 7358-krk7 has 0 rows for PCL
    const ev = await scrapeTxTdlrOrders({ legalName: 'PCL Construction Services', fetchFn, asOf: ASOF });
    expect(ev.finding_type).toBe('license_no_record');
    expect(ev.finding_summary).not.toMatch(/disciplinary|adverse/i);
  });

  it('SoQL URL strips entity-form suffix from search term + queries both business_name and owner_name', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([]));
    await scrapeTxTdlrOrders({ legalName: 'UNIFIED CONSTRUCTION, LLC', fetchFn, asOf: ASOF });
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain('UNIFIED%20CONSTRUCTION');
    expect(url).not.toContain('LLC');
    expect(url).toContain('business_name');
    expect(url).toContain('owner_name');
  });

  it('prefers exact-name match when multiple rows return', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([
      { business_name: 'ACME HVAC HOLDINGS', license_number: '1', license_expiration_date_mmddccyy: '01/01/2027' },
      { business_name: 'ACME HVAC', license_number: '2', license_expiration_date_mmddccyy: '01/01/2027' },
      { business_name: 'ACME HVAC SUBSIDIARY', license_number: '3', license_expiration_date_mmddccyy: '01/01/2027' },
    ]));
    const ev = await scrapeTxTdlrOrders({ legalName: 'ACME HVAC', fetchFn, asOf: ASOF });
    expect(ev.extracted_facts.license_number).toBe('2');
  });

  it('parses MM/DD/CCYY expiration into ISO YYYY-MM-DD', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([{
      business_name: 'TEST', license_number: 'X',
      license_expiration_date_mmddccyy: '12/31/2030',
    }]));
    const ev = await scrapeTxTdlrOrders({ legalName: 'TEST', fetchFn, asOf: ASOF });
    expect(ev.extracted_facts.license_expiration_date).toBe('2030-12-31');
  });

  it('emits license_no_record when matching row has unparseable expiration', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([{
      business_name: 'ODD CO', license_number: 'X',
      license_expiration_date_mmddccyy: 'NOT A DATE',
    }]));
    const ev = await scrapeTxTdlrOrders({ legalName: 'ODD CO', fetchFn, asOf: ASOF });
    expect(ev.finding_type).toBe('license_no_record');
  });

  it('throws ScraperRateLimitError on 429', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('rate limited', {
      status: 429, headers: { 'retry-after': '30' },
    }));
    await expect(scrapeTxTdlrOrders({ legalName: 'X', fetchFn })).rejects.toBeInstanceOf(ScraperRateLimitError);
  });

  it('throws ScraperUpstreamError on 503', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('down', { status: 503 }));
    await expect(scrapeTxTdlrOrders({ legalName: 'X', fetchFn })).rejects.toBeInstanceOf(ScraperUpstreamError);
  });

  it('throws ScraperTimeoutError on AbortController fire', async () => {
    const fetchFn = vi.fn().mockImplementation((_url: string, opts: RequestInit) =>
      new Promise((_, reject) => {
        opts.signal?.addEventListener('abort', () => {
          const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
        });
      }),
    );
    await expect(scrapeTxTdlrOrders({ legalName: 'X', fetchFn, timeoutMs: 10 }))
      .rejects.toBeInstanceOf(ScraperTimeoutError);
  });

  it('throws on empty legalName', async () => {
    await expect(scrapeTxTdlrOrders({ legalName: '   ' })).rejects.toThrow('legalName required');
  });
});
