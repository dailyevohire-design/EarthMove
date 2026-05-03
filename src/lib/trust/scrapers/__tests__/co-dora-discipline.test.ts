import { describe, it, expect, vi } from 'vitest';
import { scrapeCoDoraDiscipline } from '../co-dora-discipline';
import { ScraperRateLimitError, ScraperUpstreamError, ScraperTimeoutError } from '../types';

function mockJson(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers ?? { 'Content-Type': 'application/json' },
  });
}

describe('scrapeCoDoraDiscipline', () => {
  it('emits license_active for matched licensee with no disciplinary action', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([{
      entityname: null, lastname: 'Smith', firstname: 'John',
      licensetype: 'ELE', subcategory: 'Master Electrician',
      licensenumber: '12345', licensestatusdescription: 'Active',
      licenselastreneweddate: '2025-01-15T00:00:00.000',
      licenseexpirationdate: '2027-01-14T00:00:00.000',
      programaction: '', linktoverifylicense: { url: 'https://example.test/verify' },
    }]));
    const ev = await scrapeCoDoraDiscipline({ legalName: 'John Smith', fetchFn });
    expect(ev.finding_type).toBe('license_active');
    expect(ev.confidence).toBe('verified_structured');
    expect(ev.extracted_facts.license_number).toBe('12345');
    expect(ev.extracted_facts.license_type).toBe('ELE');
    expect(ev.extracted_facts.program_action).toBeNull();
    expect(ev.extracted_facts.verify_url).toBe('https://example.test/verify');
  });

  it('emits license_disciplinary_action for active licensee with non-empty programaction', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([{
      entityname: 'ACME ELECTRIC LLC', lastname: '', firstname: '',
      licensetype: 'ELE', licensenumber: '99999',
      licensestatusdescription: 'Active',
      casenumber: '2024-DORA-00321',
      programaction: 'Letter of Admonition',
      disciplineeffectivedate: '2024-08-10T00:00:00.000',
    }]));
    const ev = await scrapeCoDoraDiscipline({ legalName: 'ACME ELECTRIC LLC', fetchFn });
    expect(ev.finding_type).toBe('license_disciplinary_action');
    expect(ev.extracted_facts.case_number).toBe('2024-DORA-00321');
    expect(ev.extracted_facts.program_action).toBe('Letter of Admonition');
  });

  it('emits license_suspended', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([{
      entityname: 'BAD ELECTRIC LLC', licensenumber: '11111',
      licensetype: 'ELE',
      licensestatusdescription: 'Suspended',
      programaction: 'Suspension — failure to comply',
    }]));
    const ev = await scrapeCoDoraDiscipline({ legalName: 'BAD ELECTRIC LLC', fetchFn });
    expect(ev.finding_type).toBe('license_suspended');
  });

  it('emits license_revoked', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([{
      entityname: 'GONE LLC', licensenumber: '22222',
      licensestatusdescription: 'Revoked',
      programaction: 'Revocation',
    }]));
    const ev = await scrapeCoDoraDiscipline({ legalName: 'GONE LLC', fetchFn });
    expect(ev.finding_type).toBe('license_revoked');
  });

  it('emits license_expired for expired status', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([{
      entityname: 'OLD CO LLC', licensenumber: '33333',
      licensestatusdescription: 'Expired',
    }]));
    const ev = await scrapeCoDoraDiscipline({ legalName: 'OLD CO LLC', fetchFn });
    expect(ev.finding_type).toBe('license_expired');
  });

  it('emits license_no_record on zero rows', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([]));
    const ev = await scrapeCoDoraDiscipline({ legalName: 'Nonexistent Contractor LLC', fetchFn });
    expect(ev.finding_type).toBe('license_no_record');
    expect(ev.extracted_facts.match_count).toBe(0);
  });

  it('prefers exact-name match over first row when multiple rows return', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([
      { entityname: 'ACME ELECTRIC HOLDINGS LLC', licensenumber: '1', licensestatusdescription: 'Active' },
      { entityname: 'ACME ELECTRIC LLC', licensenumber: '2', licensestatusdescription: 'Active' },
      { entityname: 'ACME ELECTRIC SUBSIDIARY', licensenumber: '3', licensestatusdescription: 'Suspended' },
    ]));
    const ev = await scrapeCoDoraDiscipline({ legalName: 'ACME ELECTRIC LLC', fetchFn });
    expect(ev.extracted_facts.license_number).toBe('2');
  });

  it('SoQL URL strips entity-form suffix from search term', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockJson([]));
    await scrapeCoDoraDiscipline({ legalName: 'ACME ELECTRIC, LLC', fetchFn });
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain('ACME%20ELECTRIC');
    expect(url).not.toContain('LLC');
  });

  it('throws ScraperRateLimitError on 429', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('rate limited', {
      status: 429, headers: { 'retry-after': '60' },
    }));
    await expect(scrapeCoDoraDiscipline({ legalName: 'X', fetchFn })).rejects.toBeInstanceOf(ScraperRateLimitError);
  });

  it('throws ScraperUpstreamError on 5xx', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('boom', { status: 503 }));
    await expect(scrapeCoDoraDiscipline({ legalName: 'X', fetchFn })).rejects.toBeInstanceOf(ScraperUpstreamError);
  });

  it('throws ScraperTimeoutError on AbortController fire', async () => {
    const fetchFn = vi.fn().mockImplementation((_url: string, opts: RequestInit) =>
      new Promise((_, reject) => {
        opts.signal?.addEventListener('abort', () => {
          const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
        });
      }),
    );
    await expect(scrapeCoDoraDiscipline({ legalName: 'X', fetchFn, timeoutMs: 10 }))
      .rejects.toBeInstanceOf(ScraperTimeoutError);
  });

  it('throws on empty legalName', async () => {
    await expect(scrapeCoDoraDiscipline({ legalName: '   ' })).rejects.toThrow('legalName required');
  });
});
