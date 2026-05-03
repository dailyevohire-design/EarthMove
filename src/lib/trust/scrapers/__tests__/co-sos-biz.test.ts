import { describe, it, expect, vi } from 'vitest';
import { scrapeCoSosBiz } from '../co-sos-biz';
import { ScraperRateLimitError, ScraperUpstreamError, ScraperTimeoutError } from '../types';

function mockResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers ?? { 'Content-Type': 'application/json' },
  });
}

describe('scrapeCoSosBiz', () => {
  it('emits business_active for Good Standing entity with natural-person agent', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse([{
      entityid: '20251665680',
      entityname: 'KYLDERON MIST VALLEY LLC',
      entitystatus: 'Good Standing',
      entitytype: 'DLLC',
      entityformdate: '06/16/2025',
      jurisdictonofformation: 'CO',
      agentfirstname: 'KEQIANG',
      agentlastname: 'DENG',
      principaladdress1: '660 Willow Wood Ln',
      principalcity: 'Delta',
      principalstate: 'CO',
      principalzipcode: '81416',
    }]));
    const ev = await scrapeCoSosBiz({ legalName: 'Kylderon Mist Valley LLC', fetchFn });
    expect(ev.finding_type).toBe('business_active');
    expect(ev.confidence).toBe('verified_structured');
    expect(ev.extracted_facts.entity_type).toBe('Domestic LLC');
    expect(ev.extracted_facts.formation_date).toBe('2025-06-16');
    expect(ev.extracted_facts.officers).toEqual([{
      name: 'KEQIANG DENG',
      role_hint: 'registered_agent',
      is_natural_person: true,
    }]);
    expect(ev.extracted_facts.registered_agent_organization).toBeNull();
  });

  it('emits business_dissolved for Voluntarily Dissolved entity', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse([{
      entityid: '19871342214',
      entityname: 'SOUTHWEST CONTRACTING, LLC',
      entitystatus: 'Voluntarily Dissolved',
      entitytype: 'DLLC',
      entityformdate: '03/15/2010',
      agentfirstname: 'Steven',
      agentmiddlename: 'G',
      agentlastname: 'Franchini',
    }]));
    const ev = await scrapeCoSosBiz({ legalName: 'Southwest Contracting, LLC', fetchFn });
    expect(ev.finding_type).toBe('business_dissolved');
    expect(ev.extracted_facts.officers).toEqual([{
      name: 'Steven G Franchini',
      role_hint: 'registered_agent',
      is_natural_person: true,
    }]);
  });

  it('emits business_inactive for Delinquent', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse([{
      entityid: '1',
      entityname: 'TEST CO',
      entitystatus: 'Delinquent',
      entitytype: 'DCORP',
      entityformdate: '01/15/2020',
      agentfirstname: 'Jane',
      agentlastname: 'Doe',
    }]));
    const ev = await scrapeCoSosBiz({ legalName: 'Test Co', fetchFn });
    expect(ev.finding_type).toBe('business_inactive');
  });

  it('excludes service-company agent from officers but stores org name', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse([{
      entityid: '1',
      entityname: 'ACME LLC',
      entitystatus: 'Good Standing',
      entitytype: 'DLLC',
      entityformdate: '01/01/2020',
      agentorganizationname: 'Registered Agents Inc.',
      agentfirstname: '',
      agentlastname: '',
    }]));
    const ev = await scrapeCoSosBiz({ legalName: 'ACME LLC', fetchFn });
    expect(ev.extracted_facts.officers).toEqual([]);
    expect(ev.extracted_facts.registered_agent_organization).toBe('Registered Agents Inc.');
  });

  it('emits business_not_found with verified_structured confidence on zero rows', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse([]));
    const ev = await scrapeCoSosBiz({ legalName: 'Nonexistent Entity LLC', fetchFn });
    expect(ev.finding_type).toBe('business_not_found');
    expect(ev.confidence).toBe('verified_structured');
    expect(ev.extracted_facts.match_count).toBe(0);
  });

  it('prefers exact-match row when Socrata returns multiple substring hits', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse([
      { entityid: '1', entityname: 'ACME HOLDINGS LLC', entitystatus: 'Good Standing', entitytype: 'DLLC',
        agentfirstname: 'Wrong', agentlastname: 'Person' },
      { entityid: '2', entityname: 'ACME LLC', entitystatus: 'Good Standing', entitytype: 'DLLC',
        agentfirstname: 'Right', agentlastname: 'Person' },
      { entityid: '3', entityname: 'ACME WEST LLC', entitystatus: 'Good Standing', entitytype: 'DLLC',
        agentfirstname: 'Wrong2', agentlastname: 'Person2' },
    ]));
    const ev = await scrapeCoSosBiz({ legalName: 'ACME LLC', fetchFn });
    expect(ev.extracted_facts.entity_id).toBe('2');
    expect((ev.extracted_facts.officers as Array<{ name: string }>)[0].name).toBe('Right Person');
  });

  it('throws ScraperRateLimitError on 429', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('rate limited', {
      status: 429, headers: { 'retry-after': '60' },
    }));
    await expect(scrapeCoSosBiz({ legalName: 'Test', fetchFn })).rejects.toBeInstanceOf(ScraperRateLimitError);
  });

  it('throws ScraperUpstreamError on 5xx', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('boom', { status: 503 }));
    await expect(scrapeCoSosBiz({ legalName: 'Test', fetchFn })).rejects.toBeInstanceOf(ScraperUpstreamError);
  });

  it('throws ScraperTimeoutError when AbortController fires', async () => {
    const fetchFn = vi.fn().mockImplementation((_url: string, opts: RequestInit) => new Promise((_, reject) => {
      opts.signal?.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }));
    await expect(scrapeCoSosBiz({ legalName: 'Test', fetchFn, timeoutMs: 10 })).rejects.toBeInstanceOf(ScraperTimeoutError);
  });

  it('throws on empty legalName', async () => {
    await expect(scrapeCoSosBiz({ legalName: '   ' })).rejects.toThrow('legalName required');
  });
});
