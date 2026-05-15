import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  type TrustFindingType,
  type EntityCandidate,
  ScraperRateLimitError,
  ScraperUpstreamError,
  ScraperTimeoutError,
} from './types';
import { normalizeForExternalQuery } from './_helpers/normalize-for-query';
import { rankCandidates } from '../name-similarity';

const SOURCE_KEY = 'tx_sos_biz';
const ENDPOINT = 'https://data.texas.gov/resource/9cir-efmm.json';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ROWS = 10;

export interface TxSosBizInput {
  legalName: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface TxRawRow {
  taxpayer_number?: string;
  taxpayer_name?: string;
  taxpayer_address?: string;
  taxpayer_city?: string;
  taxpayer_state?: string;
  taxpayer_zip?: string;
  taxpayer_organizational_type?: string;
  responsibility_beginning_date?: string;
  secretary_of_state_sos_or_coa_file_number?: string;
  sos_charter_date?: string;
  sos_status_date?: string;
  sos_status_code?: string;
  right_to_transact_business_code?: string;
  naics_code?: string;
  [k: string]: unknown;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function parseTxDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

function mapOrgType(code: string | undefined | null): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  const map: Record<string, string> = {
    CL: 'Domestic LLC',
    CI: 'Domestic Corporation',
    CN: 'Nonprofit Corporation',
    CF: 'Foreign Corporation',
    CT: 'Texas Limited Partnership',
    PB: 'Sole Proprietor / Individual',
  };
  return map[c] ?? c;
}

function pickBestMatch(rows: TxRawRow[], legalName: string): TxRawRow {
  const target = legalName.trim().toLowerCase();
  const exact = rows.find(r => (r.taxpayer_name ?? '').trim().toLowerCase() === target);
  return exact ?? rows[0];
}

export async function scrapeTxSosBiz(input: TxSosBizInput): Promise<ScraperEvidence> {
  const legalName = input.legalName?.trim();
  if (!legalName) {
    throw new Error('scrapeTxSosBiz: legalName required');
  }

  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Strip entity-form suffixes from the search term before LIKE construction
  // (FOLLOWUP-CROSS-SOURCE-NAME-NORM, Chunk 2.5).
  const searchTerm = normalizeForExternalQuery(legalName);
  const escaped = searchTerm.replace(/'/g, "''");
  const where = `upper(taxpayer_name) like upper('%${escaped}%')`;
  const url = `${ENDPOINT}?$where=${encodeURIComponent(where)}&$limit=${MAX_ROWS}`;

  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (input.signal) {
    input.signal.addEventListener('abort', () => controller.abort());
  }

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
    if (e?.name === 'AbortError') {
      throw new ScraperTimeoutError(`TX SOS timeout after ${timeoutMs}ms`, SOURCE_KEY);
    }
    throw new ScraperUpstreamError(
      `TX SOS network error: ${e?.message ?? String(err)}`,
      SOURCE_KEY,
      0,
    );
  }
  clearTimeout(timer);

  if (resp.status === 429) {
    const ra = resp.headers.get('retry-after');
    throw new ScraperRateLimitError('TX SOS rate limited', SOURCE_KEY, ra ? Number(ra) : null);
  }
  if (resp.status >= 500 || !resp.ok) {
    throw new ScraperUpstreamError(`TX SOS HTTP ${resp.status}`, SOURCE_KEY, resp.status);
  }

  const rawText = await resp.text();
  let rows: TxRawRow[];
  try {
    const parsed = JSON.parse(rawText);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new ScraperUpstreamError('TX SOS non-JSON response', SOURCE_KEY, resp.status);
  }

  const duration_ms = Date.now() - start;
  const sha = sha256Hex(rawText);
  const snippet = rawText.slice(0, 1500);

  if (rows.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'business_not_found',
      confidence: 'unverified',
      finding_summary: `TX Comptroller: no active franchise tax record for "${legalName}" (could be forfeited, never registered, or below threshold)`,
      extracted_facts: {
        jurisdiction: 'TX',
        query_name: legalName,
        match_count: 0,
        disclaimer: 'Dataset filtered to active franchise tax permit holders only. Absence does not confirm non-registration; entity may be forfeited, withdrawn, merged, or below the franchise tax threshold.',
        officers: [],
      },
      query_sent: url,
      response_sha256: sha,
      response_snippet: snippet,
      duration_ms,
      cost_cents: 0,
    };
  }

  const row = pickBestMatch(rows, legalName);
  const sosStatus = (row.sos_status_code ?? '').trim().toUpperCase();
  const rtbCode = (row.right_to_transact_business_code ?? '').trim().toUpperCase();
  // RTB (Right To transact Business) is the authoritative signal per TX Comptroller
  // schema. Real-world SOS codes include R, ?, C, Y, F — only F means forfeited.
  // RTB=A overrides any SOS letter; RTB=N or SOS=F means inactive; everything
  // else means the codes don't authoritatively classify and we report not_found
  // rather than falsely emitting business_inactive on a registered entity.
  const findingType: TrustFindingType =
    rtbCode === 'A'
      ? 'business_active'
      : rtbCode === 'N' || sosStatus === 'F'
        ? 'business_inactive'
        : 'business_not_found';

  const responsibilityDate = parseTxDate(row.responsibility_beginning_date);
  const charterDate = parseTxDate(row.sos_charter_date);
  const formationDate = charterDate ?? responsibilityDate;

  const facts: Record<string, unknown> = {
    jurisdiction: 'TX',
    query_name: legalName,
    match_count: rows.length,
    taxpayer_number: row.taxpayer_number ?? null,
    taxpayer_name: row.taxpayer_name ?? null,
    sos_file_number: row.secretary_of_state_sos_or_coa_file_number ?? null,
    entity_type: mapOrgType(row.taxpayer_organizational_type),
    entity_type_code: row.taxpayer_organizational_type ?? null,
    formation_date: formationDate,
    sos_charter_date: charterDate,
    responsibility_beginning_date: responsibilityDate,
    sos_status_code: sosStatus || null,
    right_to_transact_business_code: rtbCode || null,
    naics_code: row.naics_code ?? null,
    principal_address: [row.taxpayer_address, row.taxpayer_city, row.taxpayer_state, row.taxpayer_zip]
      .filter(Boolean).join(', ') || null,
    officers: [],
  };

  return {
    source_key: SOURCE_KEY,
    finding_type: findingType,
    confidence: 'verified_structured',
    finding_summary: buildSummary(findingType, legalName, sosStatus, rtbCode, formationDate),
    extracted_facts: facts,
    query_sent: url,
    response_sha256: sha,
    response_snippet: snippet,
    duration_ms,
    cost_cents: 0,
  };
}

function buildSummary(
  findingType: TrustFindingType,
  legalName: string,
  sosStatus: string,
  rtbCode: string,
  formationDate: string | null,
): string {
  const fd = formationDate ? `, formed ${formationDate}` : '';
  if (findingType === 'business_active') {
    return `TX Comptroller: "${legalName}" is active (right to transact business)${fd}`;
  }
  return `TX Comptroller: "${legalName}" status SOS=${sosStatus || '?'} RTB=${rtbCode || '?'}${fd}`;
}

// ──────────────────────────────────────────────────────────────────────────
// 227: entity disambiguation — candidate search.
//
// TX dataset 9cir-efmm is a Socrata endpoint with the same LIKE filter shape
// as CO. Mirror the CO candidate flow for consistency. Opportunistic — never
// throws; returns [] on any error.
// ──────────────────────────────────────────────────────────────────────────

const TX_CANDIDATE_FETCH_LIMIT = 20;
const TX_CANDIDATE_RETURN_LIMIT = 5;

function txComposeAddress(row: TxRawRow): string | null {
  const parts = [row.taxpayer_address, row.taxpayer_city, row.taxpayer_state, row.taxpayer_zip]
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join(', ') : null;
}

export interface TxSosBizCandidateInput {
  legalName: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function searchTxSosCandidates(
  input: TxSosBizCandidateInput,
  limit: number = TX_CANDIDATE_RETURN_LIMIT,
): Promise<EntityCandidate[]> {
  const legalName = input.legalName?.trim();
  if (!legalName) return [];

  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const searchTerm = normalizeForExternalQuery(legalName);
  const escaped = searchTerm.replace(/'/g, "''");
  const where = `upper(taxpayer_name) like upper('%${escaped}%')`;
  const url = `${ENDPOINT}?$where=${encodeURIComponent(where)}&$limit=${TX_CANDIDATE_FETCH_LIMIT}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (input.signal) input.signal.addEventListener('abort', () => controller.abort());

  try {
    const resp = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) return [];
    const rows = (await resp.json()) as TxRawRow[];
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const mapped: EntityCandidate[] = rows
      .filter((r) => typeof r.taxpayer_name === 'string' && r.taxpayer_name.length > 0)
      .map((r) => ({
        entity_id:
          (r.secretary_of_state_sos_or_coa_file_number ?? r.taxpayer_number ?? '').trim()
          || `tx_sos:${r.taxpayer_name}`,
        entity_name: (r.taxpayer_name ?? '').trim(),
        entity_type: mapOrgType(r.taxpayer_organizational_type),
        status: (r.sos_status_code ?? null) as string | null,
        formation_date: parseTxDate(r.sos_charter_date) ?? parseTxDate(r.responsibility_beginning_date),
        principal_address: txComposeAddress(r),
        // TX dataset doesn't surface a registered-agent column. The Comptroller
        // dataset captures taxpayer info, not RA. Leaving null is correct.
        registered_agent: null,
        source_key: SOURCE_KEY,
        source_url: `${ENDPOINT}?$where=${encodeURIComponent(`upper(taxpayer_name) like upper('%${escaped}%')`)}`,
        similarity_score: 0,
      }));
    return rankCandidates(legalName, mapped, { limit });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
