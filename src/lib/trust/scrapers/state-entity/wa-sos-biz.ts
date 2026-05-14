import { fetchWithCapture, strictNameMatch, type AttemptRecord } from '../lib/html-scraper-helpers';

const SOURCE_KEY = 'wa_sos_biz' as const;

export interface WaSosBizResult {
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

export async function scrapeWaSosBiz(contractorName: string): Promise<WaSosBizResult> {
  const attempts: AttemptRecord[] = [];

  const url1 = 'https://ccfs.sos.wa.gov/api/Search/Search';
  const r1 = await fetchWithCapture(url1, {
    strategy: 'ccfs_api_search',
    method: 'POST',
    body: JSON.stringify({ BusinessName: contractorName, SearchType: 'Contains' }),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  attempts.push(r1.attempt);

  if (r1.ok && r1.body) {
    try {
      const parsed = JSON.parse(r1.body) as {
        Items?: Array<{ BusinessName: string; UBINumber: string; BusinessStatus: string }>;
      };
      const items = parsed.Items ?? [];
      const matches = items.filter((i) =>
        strictNameMatch({ query: contractorName, candidate: i.BusinessName, mode: 'contains' }),
      );
      if (matches.length > 0) {
        const top = matches[0];
        const statusLower = top.BusinessStatus.toLowerCase();
        const isActive = statusLower.includes('active');
        const isDissolved =
          statusLower.includes('dissolved') ||
          statusLower.includes('terminated') ||
          statusLower.includes('inactive');
        return {
          source_key: SOURCE_KEY,
          finding_type: isActive ? 'business_active' : isDissolved ? 'business_dissolved' : 'business_inactive',
          finding_summary: `WA CCFS: "${top.BusinessName}" status=${top.BusinessStatus} (UBI ${top.UBINumber})`,
          extracted_facts: { matches, attempts },
          response_snippet: r1.body.slice(0, 500),
        };
      }
      return {
        source_key: SOURCE_KEY,
        finding_type: 'business_not_found',
        finding_summary: `WA CCFS: no strict-name match in ${items.length} JSON hits for "${contractorName}"`,
        extracted_facts: { attempts, raw_hits: items.length },
        response_snippet: r1.body.slice(0, 500),
      };
    } catch (e) {
      attempts.push({
        strategy: 'json_parse_failure',
        url: url1,
        method: 'POST',
        http_status: null,
        duration_ms: 0,
        error: e instanceof Error ? e.message : String(e),
        body_excerpt: r1.body.slice(0, 300),
      });
    }
  }

  return {
    source_key: SOURCE_KEY,
    finding_type: 'source_error',
    finding_summary: `WA CCFS: ${attempts.map((a) => `${a.strategy}=${a.http_status ?? a.error}`).join('; ')}`,
    extracted_facts: { attempts },
    response_snippet: r1.body.slice(0, 300),
  };
}
