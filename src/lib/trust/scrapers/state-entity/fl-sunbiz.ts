import { fetchWithCapture, strictNameMatch, type AttemptRecord } from '../lib/html-scraper-helpers';
import * as cheerio from 'cheerio';

const SOURCE_KEY = 'fl_sunbiz' as const;

export interface FlSunbizResult {
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

export async function scrapeFlSunbiz(contractorName: string): Promise<FlSunbizResult> {
  const attempts: AttemptRecord[] = [];
  const encoded = encodeURIComponent(contractorName);

  const url1 = `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&inquiryDirectionType=ForwardList&searchNameOrder=${encoded}`;
  const r1 = await fetchWithCapture(url1, { strategy: 'entityname_forwardlist' });
  attempts.push(r1.attempt);

  if (r1.ok && r1.body) {
    const $ = cheerio.load(r1.body);
    const rows = $('#search-results table tr, table.search-results tbody tr, table tr');
    const matches: Array<{ name: string; status: string; docNumber: string }> = [];
    rows.each((_, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 3) {
        const name = $(cells[0]).text().trim();
        const docNumber = $(cells[1]).text().trim();
        const status = $(cells[2]).text().trim();
        if (name && strictNameMatch({ query: contractorName, candidate: name, mode: 'contains' })) {
          matches.push({ name, status, docNumber });
        }
      }
    });

    if (matches.length > 0) {
      const top = matches[0];
      const statusLower = top.status.toLowerCase();
      const isActive = statusLower.includes('active');
      const isDissolved =
        statusLower.includes('dissolved') ||
        statusLower.includes('withdrawn') ||
        statusLower.includes('revoked');
      const finding_type: FlSunbizResult['finding_type'] = isActive
        ? 'business_active'
        : isDissolved
          ? 'business_dissolved'
          : 'business_inactive';
      return {
        source_key: SOURCE_KEY,
        finding_type,
        finding_summary: `FL SunBiz: "${top.name}" status=${top.status}${matches.length > 1 ? ` (${matches.length} strict-name matches)` : ''}`,
        extracted_facts: { matches, attempts, top_match: top },
        response_snippet: r1.body.slice(0, 500),
      };
    }

    return {
      source_key: SOURCE_KEY,
      finding_type: 'business_not_found',
      finding_summary: `FL SunBiz: no strict-name match for "${contractorName}" in ${rows.length} raw rows`,
      extracted_facts: { attempts, raw_rows_scanned: rows.length },
      response_snippet: r1.body.slice(0, 500),
    };
  }

  return {
    source_key: SOURCE_KEY,
    finding_type: 'source_error',
    finding_summary: `FL SunBiz: ${attempts.map(a => `${a.strategy}=${a.http_status ?? a.error}`).join('; ')}`,
    extracted_facts: { attempts },
    response_snippet: '',
  };
}
