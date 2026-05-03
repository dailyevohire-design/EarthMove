import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  ScraperAuthError,
  ScraperRateLimitError,
  ScraperUpstreamError,
  ScraperTimeoutError,
} from './types';

const SOURCE_KEY = 'sam_gov_exclusions';
const ENDPOINT = 'https://api.sam.gov/entity-information/v4/exclusions';
const DEFAULT_TIMEOUT_MS = 10_000;

export interface SamGovInput {
  legalName: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export async function scrapeSamGovExclusions(input: SamGovInput): Promise<ScraperEvidence> {
  if (!input.legalName?.trim()) {
    throw new Error('scrapeSamGovExclusions: legalName required');
  }
  const apiKey = input.apiKey ?? process.env.SAM_GOV_API;
  if (!apiKey) {
    throw new ScraperAuthError('SAM_GOV_API_KEY not set', SOURCE_KEY);
  }

  const fetchFn = input.fetchFn ?? fetch;
  const url = new URL(ENDPOINT);
  url.searchParams.set('q', input.legalName);
  url.searchParams.set('exclusionStatus', 'Active');
  url.searchParams.set('api_key', apiKey);

  const queryRedacted = url.toString().replace(/api_key=[^&]+/, 'api_key=REDACTED');
  const start = Date.now();

  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (input.signal) input.signal.addEventListener('abort', () => controller.abort());

  let resp: Response;
  try {
    resp = await fetchFn(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new ScraperTimeoutError(`SAM.gov timeout after ${timeoutMs}ms`, SOURCE_KEY);
    }
    throw new ScraperUpstreamError(`SAM.gov network error: ${err?.message ?? err}`, SOURCE_KEY, 0);
  }
  clearTimeout(timeoutId);

  if (resp.status === 401 || resp.status === 403) {
    throw new ScraperAuthError(`SAM.gov ${resp.status}`, SOURCE_KEY);
  }
  if (resp.status === 429) {
    const ra = resp.headers.get('retry-after');
    throw new ScraperRateLimitError('SAM.gov rate limited', SOURCE_KEY, ra ? Number(ra) : null);
  }
  if (resp.status >= 500) {
    throw new ScraperUpstreamError(`SAM.gov ${resp.status}`, SOURCE_KEY, resp.status);
  }
  if (!resp.ok) {
    throw new ScraperUpstreamError(`SAM.gov ${resp.status}`, SOURCE_KEY, resp.status);
  }

  const rawText = await resp.text();
  let json: any;
  try { json = JSON.parse(rawText); }
  catch { throw new ScraperUpstreamError('SAM.gov non-JSON response', SOURCE_KEY, resp.status); }

  const total: number = typeof json?.totalRecords === 'number' ? json.totalRecords : 0;
  const matches: any[] = Array.isArray(json?.exclusionDetails) ? json.exclusionDetails : [];

  const duration_ms = Date.now() - start;
  const sha = sha256Hex(rawText);
  const snippet = rawText.slice(0, 1500);

  if (total === 0 || matches.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'sanction_clear',
      confidence: 'verified_structured',
      finding_summary: `No active SAM.gov exclusions found for \"${input.legalName}\"`,
      extracted_facts: { totalRecords: 0, query: input.legalName },
      query_sent: queryRedacted,
      response_sha256: sha,
      response_snippet: snippet,
      duration_ms,
      cost_cents: 0,
    };
  }

  const top = matches[0];
  const top_summary = {
    name: top?.entityName ?? top?.name ?? null,
    classificationType: top?.classificationType ?? null,
    exclusionType: top?.exclusionType ?? null,
    activeDate: top?.activeDate ?? null,
    terminationDate: top?.terminationDate ?? null,
    excludingAgency: top?.excludingAgency ?? null,
  };

  return {
    source_key: SOURCE_KEY,
    finding_type: 'sanction_hit',
    confidence: 'verified_structured',
    finding_summary: `SAM.gov exclusion match (${matches.length}) for \"${input.legalName}\"`,
    extracted_facts: { totalRecords: total, matchCount: matches.length, top: top_summary },
    query_sent: queryRedacted,
    response_sha256: sha,
    response_snippet: snippet,
    duration_ms,
    cost_cents: 0,
  };
}
