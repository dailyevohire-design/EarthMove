import { fetchWithCapture, strictNameMatch, type AttemptRecord } from '../lib/html-scraper-helpers';
import * as cheerio from 'cheerio';

const SOURCE_KEY = 'ny_sos_biz' as const;

export interface NySosBizResult {
  source_key: typeof SOURCE_KEY;
  finding_type:
    | 'business_active'
    | 'business_inactive'
    | 'business_dissolved'
    | 'business_not_found'
    | 'source_error';
  finding_summary: string;
  extracted_facts: Record<string, unknown>;
  response_snippet: string;
}

export async function scrapeNySosBiz(contractorName: string): Promise<NySosBizResult> {
  const attempts: AttemptRecord[] = [];

  const url1 = `https://apps.dos.ny.gov/publicInquiry/EntityDisplay?searchValue=${encodeURIComponent(contractorName)}&searchType=BeginsWith`;
  const r1 = await fetchWithCapture(url1, { strategy: 'publicinquiry_get' });
  attempts.push(r1.attempt);

  let body = r1.ok ? r1.body : '';
  if (!r1.ok) {
    const url2 = 'https://apps.dos.ny.gov/publicInquiry/SearchEntityName';
    const r2 = await fetchWithCapture(url2, {
      strategy: 'publicinquiry_post',
      method: 'POST',
      body: new URLSearchParams({ searchValue: contractorName, searchType: 'BeginsWith' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    attempts.push(r2.attempt);
    if (r2.ok) body = r2.body;
  }

  if (body) {
    const $ = cheerio.load(body);
    const matches: Array<{ name: string; dos_id: string; status: string }> = [];
    $('table tbody tr, table tr').each((_, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 2) {
        const name = $(cells[0]).text().trim();
        const dos_id = cells.length > 1 ? $(cells[1]).text().trim() : '';
        const status = cells.length > 2 ? $(cells[2]).text().trim() : '';
        if (name && strictNameMatch({ query: contractorName, candidate: name, mode: 'contains' })) {
          matches.push({ name, dos_id, status });
        }
      }
    });

    if (matches.length > 0) {
      const top = matches[0];
      const statusLower = top.status.toLowerCase();
      const isActive = statusLower.includes('active');
      const isDissolved =
        statusLower.includes('dissolved') ||
        statusLower.includes('inactive') ||
        statusLower.includes('cancelled');
      return {
        source_key: SOURCE_KEY,
        finding_type: isActive ? 'business_active' : isDissolved ? 'business_dissolved' : 'business_inactive',
        finding_summary: `NY DOS: "${top.name}" status=${top.status || 'unknown'} (DOS ID ${top.dos_id})`,
        extracted_facts: { matches, attempts },
        response_snippet: body.slice(0, 500),
      };
    }
    return {
      source_key: SOURCE_KEY,
      finding_type: 'business_not_found',
      finding_summary: `NY DOS: no strict-name match for "${contractorName}"`,
      extracted_facts: { attempts },
      response_snippet: body.slice(0, 500),
    };
  }

  return {
    source_key: SOURCE_KEY,
    finding_type: 'source_error',
    finding_summary: `NY DOS: ${attempts.map((a) => `${a.strategy}=${a.http_status ?? a.error}`).join('; ')}`,
    extracted_facts: { attempts },
    response_snippet: '',
  };
}
