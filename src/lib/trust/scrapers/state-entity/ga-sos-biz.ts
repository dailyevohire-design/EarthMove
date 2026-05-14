import { fetchWithCapture, strictNameMatch, type AttemptRecord } from '../lib/html-scraper-helpers';
import * as cheerio from 'cheerio';

const SOURCE_KEY = 'ga_sos_biz' as const;

export interface GaSosBizResult {
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

export async function scrapeGaSosBiz(contractorName: string): Promise<GaSosBizResult> {
  const attempts: AttemptRecord[] = [];

  const url1 = 'https://ecorp.sos.ga.gov/BusinessSearch';
  const formBody = new URLSearchParams({
    BusinessName: contractorName,
    BusinessType: '',
    SearchType: 'BusinessNameLike',
  });
  const r1 = await fetchWithCapture(url1, {
    strategy: 'mvc_search_post',
    method: 'POST',
    body: formBody,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  attempts.push(r1.attempt);

  let body = r1.ok ? r1.body : '';
  if (!r1.ok) {
    const url2 = `https://ecorp.sos.ga.gov/BusinessSearch?BusinessName=${encodeURIComponent(contractorName)}`;
    const r2 = await fetchWithCapture(url2, { strategy: 'mvc_search_get' });
    attempts.push(r2.attempt);
    if (r2.ok) body = r2.body;
  }

  if (body) {
    const $ = cheerio.load(body);
    const matches: Array<{ name: string; control_number: string; status: string }> = [];
    $('table tbody tr, table tr').each((_, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 3) {
        const name = $(cells[0]).text().trim();
        const control_number = $(cells[1]).text().trim();
        const status = $(cells[2]).text().trim();
        if (name && strictNameMatch({ query: contractorName, candidate: name, mode: 'contains' })) {
          matches.push({ name, control_number, status });
        }
      }
    });

    if (matches.length > 0) {
      const top = matches[0];
      const statusLower = top.status.toLowerCase();
      const isActive = statusLower.includes('active');
      const isDissolved =
        statusLower.includes('dissolved') ||
        statusLower.includes('admin') ||
        statusLower.includes('terminated');
      return {
        source_key: SOURCE_KEY,
        finding_type: isActive ? 'business_active' : isDissolved ? 'business_dissolved' : 'business_inactive',
        finding_summary: `GA SOS: "${top.name}" status=${top.status} (control #${top.control_number})`,
        extracted_facts: { matches, attempts },
        response_snippet: body.slice(0, 500),
      };
    }
    return {
      source_key: SOURCE_KEY,
      finding_type: 'business_not_found',
      finding_summary: `GA SOS: no strict-name match for "${contractorName}"`,
      extracted_facts: { attempts },
      response_snippet: body.slice(0, 500),
    };
  }

  return {
    source_key: SOURCE_KEY,
    finding_type: 'source_error',
    finding_summary: `GA SOS: ${attempts.map((a) => `${a.strategy}=${a.http_status ?? a.error}`).join('; ')}`,
    extracted_facts: { attempts },
    response_snippet: '',
  };
}
