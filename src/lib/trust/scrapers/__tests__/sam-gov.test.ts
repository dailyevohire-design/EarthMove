import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/setup';
import { scrapeSamGovExclusions, _resetSamGovThrottle } from '../sam-gov';
import {
  ScraperAuthError, ScraperRateLimitError,
  ScraperUpstreamError,
} from '../types';

const URL_PATTERN = 'https://api.sam.gov/entity-information/v4/exclusions';

describe('scrapeSamGovExclusions', () => {
  // Module-scope rate limiter + cache leak across tests; reset both so each
  // test starts with a fresh quota window and empty cache.
  beforeEach(() => {
    _resetSamGovThrottle();
  });

  it('returns sanction_clear when totalRecords=0', async () => {
    server.use(http.get(URL_PATTERN, () => HttpResponse.json({ totalRecords: 0, exclusionDetails: [] })));
    const r = await scrapeSamGovExclusions({ legalName: 'ACME PLUMBING LLC', apiKey: 'test' });
    expect(r.finding_type).toBe('sanction_clear');
    expect(r.confidence).toBe('verified_structured');
    expect(r.cost_cents).toBe(0);
    expect(r.response_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.query_sent).not.toContain('test'); // api key redacted
    expect(r.query_sent).toContain('REDACTED');
  });

  it('returns sanction_hit when matches present', async () => {
    server.use(http.get(URL_PATTERN, () => HttpResponse.json({
      totalRecords: 2,
      exclusionDetails: [
        { entityName: 'ACME PLUMBING LLC', classificationType: 'Firm',
          exclusionType: 'Reciprocal', activeDate: '2023-05-01',
          terminationDate: 'Indefinite', excludingAgency: 'GSA' },
        { entityName: 'ACME PLUMBING LLC', classificationType: 'Firm', exclusionType: 'Other' },
      ],
    })));
    const r = await scrapeSamGovExclusions({ legalName: 'ACME PLUMBING LLC', apiKey: 'test' });
    expect(r.finding_type).toBe('sanction_hit');
    expect((r.extracted_facts as any).matchCount).toBe(2);
    expect((r.extracted_facts as any).top.excludingAgency).toBe('GSA');
  });

  it('throws ScraperAuthError on 401', async () => {
    server.use(http.get(URL_PATTERN, () => new HttpResponse(null, { status: 401 })));
    await expect(scrapeSamGovExclusions({ legalName: 'X', apiKey: 'bad' })).rejects.toBeInstanceOf(ScraperAuthError);
  });

  it('throws ScraperAuthError on 403', async () => {
    server.use(http.get(URL_PATTERN, () => new HttpResponse(null, { status: 403 })));
    await expect(scrapeSamGovExclusions({ legalName: 'X', apiKey: 'bad' })).rejects.toBeInstanceOf(ScraperAuthError);
  });

  it('throws ScraperRateLimitError on 429 with retry-after', async () => {
    server.use(http.get(URL_PATTERN, () => new HttpResponse(null, { status: 429, headers: { 'retry-after': '60' } })));
    try {
      await scrapeSamGovExclusions({ legalName: 'X', apiKey: 'k' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ScraperRateLimitError);
      expect((e as ScraperRateLimitError).retryAfterSec).toBe(60);
    }
  });

  it('throws ScraperUpstreamError on 502', async () => {
    server.use(http.get(URL_PATTERN, () => new HttpResponse(null, { status: 502 })));
    await expect(scrapeSamGovExclusions({ legalName: 'X', apiKey: 'k' })).rejects.toBeInstanceOf(ScraperUpstreamError);
  });

  it('throws when api key missing', async () => {
    const orig = process.env.SAM_GOV_API_KEY;
    delete process.env.SAM_GOV_API_KEY;
    await expect(scrapeSamGovExclusions({ legalName: 'X' })).rejects.toBeInstanceOf(ScraperAuthError);
    if (orig) process.env.SAM_GOV_API_KEY = orig;
  });

  it('throws on non-JSON response', async () => {
    server.use(http.get(URL_PATTERN, () => new HttpResponse('<html>oops</html>', { status: 200 })));
    await expect(scrapeSamGovExclusions({ legalName: 'X', apiKey: 'k' })).rejects.toBeInstanceOf(ScraperUpstreamError);
  });

  it('sends v4 entity-name search via exclusionName= and recordStatus=Active (not q= / exclusionStatus=)', async () => {
    let captured: URL | undefined;
    server.use(http.get(URL_PATTERN, ({ request }) => {
      captured = new URL(request.url);
      return HttpResponse.json({ totalRecords: 0, exclusionDetails: [] });
    }));
    await scrapeSamGovExclusions({ legalName: 'PCL Construction Services, Inc.', apiKey: 'test' });
    expect(captured?.searchParams.get('exclusionName')).toBe('PCL Construction Services, Inc.');
    expect(captured?.searchParams.get('recordStatus')).toBe('Active');
    expect(captured?.searchParams.has('q')).toBe(false);
    expect(captured?.searchParams.has('exclusionStatus')).toBe(false);
  });
});
