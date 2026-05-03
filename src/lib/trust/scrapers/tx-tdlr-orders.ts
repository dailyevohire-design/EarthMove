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
 * TX TDLR active license verification.
 *
 * Source: data.texas.gov dataset 7358-krk7 ("TDLR - All Licenses").
 * Socrata SODA endpoint with current active TDLR licenses across all
 * regulated programs (A/C contractors, electricians, etc.). Updated
 * regularly by TDLR.
 *
 * **Pivoted in migration 212** away from the original
 * tdlr.texas.gov/cimsfo/fosearch_results.asp POST-form scrape, which is
 * server-side-unscriptable: that endpoint returns a 302 + ASP session
 * cookie, follow-up GET 411s, and the response_snippet shows the form
 * homepage rather than results. Production smoke on PCL/Bemas/Pinnacle
 * confirmed false-positive `license_disciplinary_action` (~18 rows on
 * three unrelated names) caused by parsing TDLR's program-list nav
 * table on the form-homepage. See FOLLOWUP-TX-TDLR-FINAL-ORDERS-SESSION-STATE.
 *
 * Coverage: this scraper now verifies active TDLR licensure, NOT
 * disciplinary history. Disciplinary detection requires a separate
 * scrape with proper session-state replay (deferred).
 *
 * finding_types emitted:
 *   - license_active     when at least one row has expiration date in the future
 *   - license_expired    when all matching rows have past expiration dates
 *   - license_no_record  on zero matches
 */

const SOURCE_KEY = 'tx_tdlr';
const ENDPOINT = 'https://data.texas.gov/resource/7358-krk7.json';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ROWS = 10;

export interface TxTdlrInput {
  legalName: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
  asOf?: Date;
}

interface TdlrRawRow {
  license_type?: string;
  license_number?: string;
  license_subtype?: string;
  business_name?: string;
  owner_name?: string;
  business_county?: string;
  business_city_state_zip?: string;
  business_address_line1?: string;
  business_telephone?: string;
  license_expiration_date_mmddccyy?: string;
  continuing_education_flag?: string;
  [k: string]: unknown;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/**
 * Parse TDLR's "MM/DD/CCYY" expiration date string into a JS Date.
 * Returns null if unparseable. CCYY is just YYYY in TDLR's format.
 */
function parseTdlrExpiration(s: string | undefined | null): Date | null {
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const month = parseInt(m[1], 10) - 1; // JS months are 0-indexed
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const d = new Date(Date.UTC(year, month, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

interface RowAnalysis {
  isActive: boolean;
  isExpired: boolean;
  expirationISO: string | null;
}

function analyzeRow(row: TdlrRawRow, asOf: Date): RowAnalysis {
  const exp = parseTdlrExpiration(row.license_expiration_date_mmddccyy);
  if (!exp) return { isActive: false, isExpired: false, expirationISO: null };
  const expirationISO = exp.toISOString().slice(0, 10);
  const future = exp.getTime() >= asOf.getTime();
  return { isActive: future, isExpired: !future, expirationISO };
}

function pickBestMatch(rows: TdlrRawRow[], normalizedTerm: string, asOf: Date): TdlrRawRow {
  const target = normalizedTerm.toLowerCase();
  // Prefer exact normalized-name match.
  const exactByBusiness = rows.find(r =>
    normalizeForExternalQuery(r.business_name ?? '').toLowerCase() === target,
  );
  if (exactByBusiness) return exactByBusiness;
  // Then prefer any active row.
  const active = rows.find(r => analyzeRow(r, asOf).isActive);
  return active ?? rows[0];
}

export async function scrapeTxTdlrOrders(input: TxTdlrInput): Promise<ScraperEvidence> {
  const legalName = input.legalName?.trim();
  if (!legalName) throw new Error('scrapeTxTdlrOrders: legalName required');

  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const asOf = input.asOf ?? new Date();
  const searchTerm = normalizeForExternalQuery(legalName);
  const escaped = searchTerm.replace(/'/g, "''");
  // Search BOTH business_name and owner_name — the latter catches
  // sole-proprietor licenses where the entity is registered under the
  // owner's personal name.
  const where =
    `upper(business_name) like upper('%${escaped}%') OR upper(owner_name) like upper('%${escaped}%')`;
  const url = `${ENDPOINT}?$where=${encodeURIComponent(where)}&$limit=${MAX_ROWS}`;

  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (input.signal) input.signal.addEventListener('abort', () => controller.abort());

  let resp: Response;
  try {
    resp = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
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

  const rawText = await resp.text();
  let rows: TdlrRawRow[];
  try {
    const parsed = JSON.parse(rawText);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new ScraperUpstreamError('TX TDLR non-JSON response', SOURCE_KEY, resp.status);
  }

  const duration_ms = Date.now() - start;
  const sha = sha256Hex(rawText);
  const snippet = rawText.slice(0, 1500);

  if (rows.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'license_no_record',
      confidence: 'verified_structured',
      finding_summary: `TX TDLR: no active license record matching "${legalName}". TDLR licenses A/C, refrigeration, electricians, multiple specialty trades — does not cover GCs or plumbers (TX has no statewide GC license; plumbers fall under TSBPE). Absence is neutral for non-TDLR-licensed trades.`,
      extracted_facts: {
        jurisdiction: 'TX',
        agency: 'Texas TDLR',
        query_name: legalName,
        match_count: 0,
        source_dataset: '7358-krk7',
        coverage_note: 'TDLR active licensure only; disciplinary/Final Orders detection deferred (FOLLOWUP-TX-TDLR-FINAL-ORDERS-SESSION-STATE)',
      },
      query_sent: url,
      response_sha256: sha,
      response_snippet: snippet,
      duration_ms,
      cost_cents: 0,
    };
  }

  const row = pickBestMatch(rows, searchTerm, asOf);
  const analysis = analyzeRow(row, asOf);

  let findingType: TrustFindingType;
  let summary: string;
  if (analysis.isActive) {
    findingType = 'license_active';
    summary = `TX TDLR: "${legalName}" holds active ${row.license_type ?? 'TDLR'} license #${row.license_number ?? '?'}, expires ${analysis.expirationISO ?? 'unknown'}`;
  } else if (analysis.isExpired) {
    findingType = 'license_expired';
    summary = `TX TDLR: "${legalName}" license #${row.license_number ?? '?'} (${row.license_type ?? 'TDLR'}) EXPIRED ${analysis.expirationISO ?? 'unknown date'}`;
  } else {
    // No parseable expiration — treat as no-record rather than fabricating active status.
    findingType = 'license_no_record';
    summary = `TX TDLR: matching row for "${legalName}" has no parseable expiration date; cannot verify active status.`;
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
      match_count: rows.length,
      license_number: row.license_number ?? null,
      license_type: row.license_type ?? null,
      license_subtype: row.license_subtype ?? null,
      business_name: row.business_name ?? null,
      owner_name: row.owner_name ?? null,
      business_county: row.business_county ?? null,
      license_expiration_date: analysis.expirationISO,
      continuing_education_flag: row.continuing_education_flag ?? null,
      source_dataset: '7358-krk7',
      coverage_note: 'TDLR active licensure only; disciplinary detection deferred',
    },
    query_sent: url,
    response_sha256: sha,
    response_snippet: snippet,
    duration_ms,
    cost_cents: 0,
  };
}
