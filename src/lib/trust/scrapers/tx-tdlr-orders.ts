import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  type TrustFindingType,
  ScraperRateLimitError,
  ScraperUpstreamError,
  ScraperTimeoutError,
} from './types';
import { normalizeForExternalQuery } from './_helpers/normalize-for-query';

/**
 * TX TDLR Final Orders scraper.
 *
 * Source: tdlr.texas.gov/cimsfo/fosearch_results.asp — POST form,
 * results render as HTML table. Coverage: TDLR-licensed trades — A/C and
 * refrigeration contractors, electricians, multiple programs. Plumbers
 * are NOT covered (TSBPE handles plumbers; Sub-Unit 3 deferred).
 *
 * IMPORTANT: TDLR Final Orders search returns ONLY entities WITH
 * disciplinary orders in the current + 2 prior fiscal years. Absence is
 * AMBIGUOUS — could mean clean OR not-licensed-by-TDLR OR older order.
 * We emit license_no_record for absence with summary text noting the
 * ambiguity; downstream synth treats this as neutral.
 *
 * POST form fields (recon'd 2026-05-03):
 *   pht_lic       — license number
 *   pht_lnm       — last name
 *   pht_fnm       — first name
 *   pht_oth_name  — other / company name
 *   phy_zip       — zip code
 */

const SOURCE_KEY = 'tx_tdlr';
const SEARCH_URL = 'https://www.tdlr.texas.gov/cimsfo/fosearch_results.asp';
const DEFAULT_TIMEOUT_MS = 15_000;

export interface TxTdlrInput {
  legalName: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/**
 * Strip HTML tags and collapse whitespace for plain-text matching against
 * the response body. Keeps things minimal — full HTML parsing isn't
 * needed because we're checking for the contractor name + a result-row
 * marker in the body.
 */
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Detect "no orders found" pattern in the response. TDLR's results page
 * typically includes "No records were found" or similar copy when the
 * query returns nothing.
 */
function isNoResults(bodyText: string): boolean {
  return /no\s+records?\s+(?:were\s+)?found|no\s+results|0\s+matches/i.test(bodyText);
}

/**
 * Detect a results table in the response. TDLR renders results inside a
 * <table> with column headers like "License Number", "Order Date", "Action".
 * We approximate "has results" as having both an <table> AND a hint of
 * order-related column text.
 */
function hasResultsTable(rawHtml: string): boolean {
  const lower = rawHtml.toLowerCase();
  return lower.includes('<table') &&
    /(order\s+date|license\s+number|action|penalty)/i.test(rawHtml);
}

/**
 * Extract a coarse count of result rows. Counts <tr> elements minus
 * header rows. Approximate — used only for finding_summary text.
 */
function countResultRows(rawHtml: string): number {
  const matches = rawHtml.match(/<tr[\s>]/gi);
  if (!matches) return 0;
  return Math.max(0, matches.length - 1); // subtract header row
}

export async function scrapeTxTdlrOrders(input: TxTdlrInput): Promise<ScraperEvidence> {
  const legalName = input.legalName?.trim();
  if (!legalName) throw new Error('scrapeTxTdlrOrders: legalName required');

  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const searchTerm = normalizeForExternalQuery(legalName);

  const formData = new URLSearchParams();
  formData.set('pht_oth_name', searchTerm);
  formData.set('pht_lic', '');
  formData.set('pht_lnm', '');
  formData.set('pht_fnm', '');
  formData.set('phy_zip', '');
  formData.set('B1', 'Search');

  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (input.signal) input.signal.addEventListener('abort', () => controller.abort());

  let resp: Response;
  try {
    resp = await fetchFn(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; Groundcheck/1.0; +https://earthmove.io)',
      },
      body: formData.toString(),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const e = err as { name?: string; message?: string };
    if (e?.name === 'AbortError') throw new ScraperTimeoutError(`TX TDLR timeout after ${timeoutMs}ms`, SOURCE_KEY);
    throw new ScraperUpstreamError(`TX TDLR network: ${e?.message ?? err}`, SOURCE_KEY, 0);
  }
  clearTimeout(timer);

  if (resp.status === 429) {
    const ra = resp.headers.get('retry-after');
    throw new ScraperRateLimitError('TX TDLR rate limited', SOURCE_KEY, ra ? Number(ra) : null);
  }
  if (resp.status >= 500 || !resp.ok) {
    throw new ScraperUpstreamError(`TX TDLR HTTP ${resp.status}`, SOURCE_KEY, resp.status);
  }

  const rawHtml = await resp.text();
  const duration_ms = Date.now() - start;
  const sha = sha256Hex(rawHtml);
  const snippet = stripHtml(rawHtml.slice(0, 4000)).slice(0, 1500);

  const noResults = isNoResults(stripHtml(rawHtml));
  const hasTable = hasResultsTable(rawHtml);

  let findingType: TrustFindingType;
  let summary: string;
  let resultCount = 0;

  if (noResults || !hasTable) {
    findingType = 'license_no_record';
    summary = `TX TDLR: no Final Orders match "${legalName}" in the searchable window (current + 2 prior fiscal years). Absence is ambiguous — could mean clean record, not-licensed-by-TDLR, or older order outside the window.`;
  } else {
    resultCount = countResultRows(rawHtml);
    findingType = 'license_disciplinary_action';
    summary = `TX TDLR: Final Order(s) on record for "${legalName}" (~${resultCount} row${resultCount === 1 ? '' : 's'} in TDLR Final Orders search). Adverse signal — see source for order details.`;
  }

  return {
    source_key: SOURCE_KEY,
    finding_type: findingType,
    confidence: 'verified_structured',
    finding_summary: summary,
    extracted_facts: {
      jurisdiction: 'TX',
      agency: 'Texas TDLR',
      query_name: legalName,
      result_row_count: resultCount,
      no_results_detected: noResults,
      results_table_present: hasTable,
      source_url: SEARCH_URL,
      coverage_note: 'TDLR Final Orders search covers current + 2 prior fiscal years only',
    },
    query_sent: SEARCH_URL,
    response_sha256: sha,
    response_snippet: snippet,
    duration_ms,
    cost_cents: 0,
  };
}
