import { describe, it, expect, vi } from 'vitest';
import { scrapeTxTdlrOrders } from '../tx-tdlr-orders';
import { ScraperRateLimitError, ScraperUpstreamError, ScraperTimeoutError } from '../types';

function mockHtml(body: string, init?: { status?: number }): Response {
  return new Response(body, {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

describe('scrapeTxTdlrOrders', () => {
  it('POST is sent to fosearch_results.asp with the contractor name in pht_oth_name', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockHtml('<html><body>No records were found</body></html>'));
    await scrapeTxTdlrOrders({ legalName: 'ACME HVAC LLC', fetchFn });
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('https://www.tdlr.texas.gov/cimsfo/fosearch_results.asp');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>)['Content-Type']).toContain('application/x-www-form-urlencoded');
    expect(opts.body as string).toContain('pht_oth_name=ACME+HVAC'); // entity suffix stripped
    expect(opts.body as string).not.toContain('LLC');
  });

  it('emits license_no_record when response says "No records were found"', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockHtml('<html><body><h2>No records were found</h2></body></html>'));
    const ev = await scrapeTxTdlrOrders({ legalName: 'CLEAN HVAC LLC', fetchFn });
    expect(ev.finding_type).toBe('license_no_record');
    expect(ev.confidence).toBe('verified_structured');
    expect(ev.extracted_facts.no_results_detected).toBe(true);
  });

  it('emits license_no_record when no results table is present', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockHtml('<html><body><p>Search form goes here</p></body></html>'));
    const ev = await scrapeTxTdlrOrders({ legalName: 'NONE LLC', fetchFn });
    expect(ev.finding_type).toBe('license_no_record');
    expect(ev.extracted_facts.results_table_present).toBe(false);
  });

  it('emits license_disciplinary_action when results table contains order rows', async () => {
    const html = `<html><body>
      <table><tr><th>License Number</th><th>Order Date</th><th>Action</th><th>Penalty</th></tr>
      <tr><td>123</td><td>2024-05-01</td><td>Suspension</td><td>$5,000</td></tr>
      <tr><td>123</td><td>2024-08-15</td><td>Reprimand</td><td>—</td></tr>
      </table></body></html>`;
    const fetchFn = vi.fn().mockResolvedValue(mockHtml(html));
    const ev = await scrapeTxTdlrOrders({ legalName: 'BAD HVAC LLC', fetchFn });
    expect(ev.finding_type).toBe('license_disciplinary_action');
    expect(ev.extracted_facts.result_row_count).toBe(2);
    expect(ev.extracted_facts.results_table_present).toBe(true);
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
