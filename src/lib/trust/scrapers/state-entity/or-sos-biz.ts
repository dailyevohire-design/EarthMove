import { fetchWithCapture, strictNameMatch, type AttemptRecord } from '../lib/html-scraper-helpers';
import * as cheerio from 'cheerio';

const SOURCE_KEY = 'or_sos_biz' as const;

export interface OrSosBizResult {
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

export async function scrapeOrSosBiz(contractorName: string): Promise<OrSosBizResult> {
  const attempts: AttemptRecord[] = [];

  const formBody = new URLSearchParams({
    SearchValue: contractorName,
    SearchTypeBus: 'BusinessName',
    IsValidSearch: '1',
  });

  const url1 = 'https://secure.sos.state.or.us/cbrmanager/FindNewSearch.action';
  const r1 = await fetchWithCapture(url1, {
    strategy: 'businessname_post',
    method: 'POST',
    body: formBody,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  attempts.push(r1.attempt);

  const url2 = `https://secure.sos.state.or.us/cbrmanager/FindNewSearch.action?SearchValue=${encodeURIComponent(contractorName)}&SearchTypeBus=BusinessName`;
  let body = r1.ok ? r1.body : '';
  if (!r1.ok) {
    const r2 = await fetchWithCapture(url2, { strategy: 'businessname_get' });
    attempts.push(r2.attempt);
    if (r2.ok) body = r2.body;
  }

  if (body) {
    const $ = cheerio.load(body);
    const matches: Array<{ name: string; registry_num: string; status: string }> = [];
    $('table tr').each((_, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 3) {
        const registry_num = $(cells[0]).text().trim();
        const name = $(cells[2]).text().trim();
        const status = cells.length > 3 ? $(cells[3]).text().trim() : '';
        if (name && strictNameMatch({ query: contractorName, candidate: name, mode: 'contains' })) {
          matches.push({ name, registry_num, status });
        }
      }
    });

    if (matches.length > 0) {
      const top = matches[0];
      const isActive = top.status.toLowerCase().includes('active');
      const finding_type: OrSosBizResult['finding_type'] = isActive ? 'business_active' : 'business_inactive';
      return {
        source_key: SOURCE_KEY,
        finding_type,
        finding_summary: `OR CBR: "${top.name}" status=${top.status || 'unknown'} (registry #${top.registry_num})`,
        extracted_facts: { matches, attempts },
        response_snippet: body.slice(0, 500),
      };
    }
    return {
      source_key: SOURCE_KEY,
      finding_type: 'business_not_found',
      finding_summary: `OR CBR: no strict-name match for "${contractorName}"`,
      extracted_facts: { attempts },
      response_snippet: body.slice(0, 500),
    };
  }

  return {
    source_key: SOURCE_KEY,
    finding_type: 'source_error',
    finding_summary: `OR CBR: all attempts failed — ${attempts.map(a => `${a.strategy}=${a.http_status ?? a.error}`).join('; ')}`,
    extracted_facts: { attempts },
    response_snippet: '',
  };
}
