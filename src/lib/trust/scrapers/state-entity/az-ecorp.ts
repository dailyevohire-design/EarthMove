import { fetchWithCapture, strictNameMatch, type AttemptRecord } from '../lib/html-scraper-helpers';

const SOURCE_KEY = 'az_ecorp' as const;

export interface AzEcorpResult {
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

export async function scrapeAzEcorp(contractorName: string): Promise<AzEcorpResult> {
  const attempts: AttemptRecord[] = [];

  const url1 = 'https://ecorp.azcc.gov/api/EntitySearch/EntitySearchByName';
  const r1 = await fetchWithCapture(url1, {
    strategy: 'json_api_entitysearchbyname',
    method: 'POST',
    body: JSON.stringify({ entityName: contractorName, exactMatch: false }),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  attempts.push(r1.attempt);

  if (r1.ok && r1.body) {
    try {
      const parsed = JSON.parse(r1.body) as {
        Entities?: Array<{ EntityName: string; Status: string; EntityNumber: string }>;
      };
      const entities = parsed.Entities ?? [];
      const matches = entities.filter((e) =>
        strictNameMatch({ query: contractorName, candidate: e.EntityName, mode: 'contains' }),
      );
      if (matches.length > 0) {
        const top = matches[0];
        const statusLower = top.Status.toLowerCase();
        const isActive = statusLower.includes('active') || statusLower.includes('good standing');
        const isDissolved = statusLower.includes('dissolved') || statusLower.includes('revoked');
        return {
          source_key: SOURCE_KEY,
          finding_type: isActive
            ? 'business_active'
            : isDissolved
              ? 'business_dissolved'
              : 'business_inactive',
          finding_summary: `AZ ACC: "${top.EntityName}" status=${top.Status} (entity #${top.EntityNumber})`,
          extracted_facts: { matches, attempts },
          response_snippet: r1.body.slice(0, 500),
        };
      }
      return {
        source_key: SOURCE_KEY,
        finding_type: 'business_not_found',
        finding_summary: `AZ ACC: no strict-name match in ${entities.length} JSON hits for "${contractorName}"`,
        extracted_facts: { attempts, raw_hits: entities.length },
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
    finding_summary: `AZ ACC: ${attempts.map((a) => `${a.strategy}=${a.http_status ?? a.error}`).join('; ')}`,
    extracted_facts: { attempts },
    response_snippet: r1.body.slice(0, 300),
  };
}
