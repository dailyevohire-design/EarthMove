/**
 * SEC EDGAR full-text filings search scraper.
 *
 * Free public REST. SEC requires a User-Agent identifying caller.
 * Rate limit: 10 req/sec per IP. No auth.
 *
 * Coverage: only ~5% of contractors are SEC filers (publicly listed or
 * have registered securities). For everyone else: business_not_found,
 * which is the correct semantic (absence is normal, not a red flag).
 *
 * Returns one ScraperEvidence:
 *   - business_active     if filings within last 2 years
 *   - business_inactive   if filings exist but >2 years old
 *   - business_not_found  if no filings match the query
 */

import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  ScraperRateLimitError,
  ScraperUpstreamError,
  ScraperTimeoutError,
} from './types';

const SOURCE_KEY = 'sec_edgar';
const EDGAR_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index';
const TIMEOUT_MS = 10_000;
const COST_CENTS = 0;
const USER_AGENT = 'Earth Pro Connect LLC trust@earthmove.io';

export interface ScrapeSecEdgarInput {
  query_name: string;
  jurisdiction: string;
  contractor_id?: string;
  job_id?: string;
}

interface EdgarHit {
  _id?: string;
  _source?: {
    display_names?: string[];
    file_date?: string;
    form?: string;
    ciks?: string[];
    sics?: string[];
  };
}

interface EdgarResponse {
  hits?: {
    total?: { value?: number };
    hits?: EdgarHit[];
  };
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export async function scrapeSecEdgar(
  input: ScrapeSecEdgarInput,
): Promise<ScraperEvidence> {
  const url = new URL(EDGAR_SEARCH_URL);
  url.searchParams.set('q', `"${input.query_name}"`);
  url.searchParams.set('forms', '10-K,10-Q,8-K,DEF 14A,S-1');

  const querySent = `GET ${url.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new ScraperTimeoutError(`SEC EDGAR timeout after ${TIMEOUT_MS}ms`, SOURCE_KEY);
    }
    throw new ScraperUpstreamError(
      `SEC EDGAR network error: ${err?.message ?? err}`,
      SOURCE_KEY,
      0,
    );
  }
  clearTimeout(timeoutId);

  if (response.status === 429) {
    throw new ScraperRateLimitError('SEC EDGAR rate limited', SOURCE_KEY, 60);
  }
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new ScraperUpstreamError(
      `SEC EDGAR HTTP ${response.status} :: ${errBody.slice(0, 400)}`,
      SOURCE_KEY,
      response.status,
    );
  }

  const rawText = await response.text();
  let data: EdgarResponse;
  try {
    data = JSON.parse(rawText) as EdgarResponse;
  } catch {
    throw new ScraperUpstreamError(
      'SEC EDGAR non-JSON response',
      SOURCE_KEY,
      response.status,
    );
  }

  const duration_ms = Date.now() - start;
  const response_sha256 = sha256Hex(rawText);
  const response_snippet = rawText.slice(0, 1500);
  const hits = data.hits?.hits ?? [];
  const totalCount = data.hits?.total?.value ?? 0;

  if (hits.length === 0 || totalCount === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'business_not_found',
      confidence: 'verified_structured',
      finding_summary: `SEC EDGAR: no filings found for "${input.query_name}" (residential GCs are typically not SEC filers; absence is normal)`,
      extracted_facts: {
        query_name: input.query_name,
        match_count: 0,
        total_hits: totalCount,
      },
      query_sent: querySent,
      response_sha256,
      response_snippet,
      duration_ms,
      cost_cents: COST_CENTS,
    };
  }

  let mostRecentDate = '';
  let firstCik = '';
  let firstDisplayName = '';
  const formsSeen = new Set<string>();
  for (const hit of hits.slice(0, 25)) {
    const src = hit._source;
    if (src?.file_date && src.file_date > mostRecentDate) mostRecentDate = src.file_date;
    if (!firstCik && src?.ciks?.[0]) firstCik = src.ciks[0];
    if (!firstDisplayName && src?.display_names?.[0]) firstDisplayName = src.display_names[0];
    if (src?.form) formsSeen.add(src.form);
  }

  const msSinceLast = mostRecentDate
    ? Date.now() - new Date(mostRecentDate).getTime()
    : Number.MAX_SAFE_INTEGER;
  const yearsSinceLast = msSinceLast / (1000 * 60 * 60 * 24 * 365);
  const isActive = yearsSinceLast < 2;

  return {
    source_key: SOURCE_KEY,
    finding_type: isActive ? 'business_active' : 'business_inactive',
    confidence: 'verified_structured',
    finding_summary: `SEC EDGAR: ${totalCount} filing${totalCount === 1 ? '' : 's'} for "${firstDisplayName || input.query_name}" (CIK ${firstCik}), most recent ${mostRecentDate || 'unknown'}`,
    extracted_facts: {
      query_name: input.query_name,
      display_name: firstDisplayName,
      cik: firstCik,
      total_hits: totalCount,
      forms_filed: Array.from(formsSeen),
      most_recent_filing_date: mostRecentDate,
      years_since_last_filing: Number(yearsSinceLast.toFixed(2)),
    },
    query_sent: querySent,
    response_sha256,
    response_snippet,
    duration_ms,
    cost_cents: COST_CENTS,
  };
}
