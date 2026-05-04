import { describe, it, expect, beforeAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/setup';
import { runScraper, NotImplementedScraperError } from '../registry';

beforeAll(() => {
  // runScraper does not pass apiKey through; SAM scraper reads env at runtime.
  if (!process.env.SAM_GOV_API_KEY) process.env.SAM_GOV_API_KEY = 'test-key';
});

describe('runScraper', () => {
  it('mock_source returns inert evidence (auto-wrapped to array)', async () => {
    const r = await runScraper('mock_source', { legalName: 'TEST CO', stateCode: 'TX' });
    expect(Array.isArray(r)).toBe(true);
    expect(r).toHaveLength(1);
    expect(r[0].source_key).toBe('mock_source');
    expect(r[0].finding_type).toBe('source_not_applicable');
  });

  it('sam_gov_exclusions delegates to SAM.gov scraper (auto-wrapped to array)', async () => {
    server.use(http.get('https://api.sam.gov/entity-information/v4/exclusions',
      () => HttpResponse.json({ totalRecords: 0, exclusionDetails: [] })));
    const r = await runScraper('sam_gov_exclusions', { legalName: 'CLEAN INC', stateCode: 'TX' });
    expect(Array.isArray(r)).toBe(true);
    expect(r).toHaveLength(1);
    expect(r[0].source_key).toBe('sam_gov_exclusions');
    expect(r[0].finding_type).toBe('sanction_clear');
  });

  it('throws NotImplementedScraperError for known-but-unbuilt source', async () => {
    await expect(runScraper('osha_est_search', { legalName: 'X', stateCode: 'TX' }))
      .rejects.toBeInstanceOf(NotImplementedScraperError);
  });

  it('throws NotImplementedScraperError for unknown source_key', async () => {
    await expect(runScraper('not_a_real_source', { legalName: 'X', stateCode: 'TX' }))
      .rejects.toBeInstanceOf(NotImplementedScraperError);
  });
});

