import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  type TrustFindingType,
  type EntityCandidate,
  ScraperRateLimitError,
  ScraperUpstreamError,
  ScraperTimeoutError,
} from './types';
import { rankCandidates } from '../name-similarity';

const SOURCE_KEY = 'co_sos_biz';
const ENDPOINT = 'https://data.colorado.gov/resource/4ykn-tg5h.json';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ROWS = 10;

import { normalizeForExternalQuery } from './_helpers/normalize-for-query';

// Re-exported under the historical name for back-compat with existing imports.
// The shared helper additionally strips entity-form suffixes (Inc., LLC, etc.)
// — see FOLLOWUP-CROSS-SOURCE-NAME-NORM resolution in Chunk 2.5.
export const normalizeForSocrataQuery = normalizeForExternalQuery;

export interface CoSosBizInput {
  legalName: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface CoSosRawRow {
  entityid?: string;
  entityname?: string;
  entitystatus?: string;
  entitytype?: string;
  entityformdate?: string;
  jurisdictonofformation?: string;
  agentfirstname?: string;
  agentmiddlename?: string;
  agentlastname?: string;
  agentsuffix?: string;
  agentorganizationname?: string;
  principaladdress1?: string;
  principalcity?: string;
  principalstate?: string;
  principalzipcode?: string;
  [k: string]: unknown;
}

interface OfficerEntry {
  name: string;
  role_hint?: string;
  is_natural_person?: boolean;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function parseCoDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const trimmed = s.trim().split(/\s+/)[0];
  // ISO 8601 (Socrata default: "2003-06-02T00:00:00.000" or "2003-06-02")
  const iso = /^(\d{4})-(\d{2})-(\d{2})(T|$)/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // MM/DD/YYYY (legacy CO SOS export format, retained for backward compatibility)
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!us) return null;
  return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
}

function mapStatus(status: string | undefined | null): TrustFindingType {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'good standing') return 'business_active';
  if (s === 'delinquent' || s === 'noncompliant') return 'business_inactive';
  if (
    s === 'voluntarily dissolved' ||
    s === 'dissolved' ||
    s === 'forfeited' ||
    s === 'withdrawn' ||
    s === 'merged' ||
    s === 'converted'
  ) return 'business_dissolved';
  return 'business_inactive';
}

function mapEntityType(code: string | undefined | null): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (!c) return null;
  const isForeign = c.startsWith('F');
  const isDomestic = c.startsWith('D');
  const suffix = c.slice(1);
  const baseMap: Record<string, string> = {
    LLC: 'LLC',
    CORP: 'Corporation',
    NP: 'Nonprofit',
    LP: 'Limited Partnership',
    LLP: 'Limited Liability Partnership',
    LLLP: 'Limited Liability Limited Partnership',
  };
  const base = baseMap[suffix] ?? c;
  if (isForeign) return `Foreign ${base}`;
  if (isDomestic) return `Domestic ${base}`;
  return base;
}

function buildAgentOfficer(row: CoSosRawRow): OfficerEntry | null {
  const org = (row.agentorganizationname ?? '').trim();
  if (org) return null;
  const first = (row.agentfirstname ?? '').trim();
  const last = (row.agentlastname ?? '').trim();
  if (!first || !last) return null;
  const middle = (row.agentmiddlename ?? '').trim();
  const suffix = (row.agentsuffix ?? '').trim();
  const parts = [first, middle, last, suffix].filter(p => p.length > 0);
  return {
    name: parts.join(' '),
    role_hint: 'registered_agent',
    is_natural_person: true,
  };
}

function pickBestMatch(rows: CoSosRawRow[], legalName: string): CoSosRawRow {
  const target = normalizeForSocrataQuery(legalName).toLowerCase();
  const exact = rows.find(
    r => normalizeForSocrataQuery(r.entityname ?? '').toLowerCase() === target,
  );
  return exact ?? rows[0];
}

export async function scrapeCoSosBiz(input: CoSosBizInput): Promise<ScraperEvidence> {
  const legalName = input.legalName?.trim();
  if (!legalName) {
    throw new Error('scrapeCoSosBiz: legalName required');
  }

  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const searchTerm = normalizeForSocrataQuery(legalName);
  const escaped = searchTerm.replace(/'/g, "''");
  const where = `upper(entityname) like upper('%${escaped}%')`;
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
      throw new ScraperTimeoutError(`CO SOS timeout after ${timeoutMs}ms`, SOURCE_KEY);
    }
    throw new ScraperUpstreamError(
      `CO SOS network error: ${e?.message ?? String(err)}`,
      SOURCE_KEY,
      0,
    );
  }
  clearTimeout(timer);

  if (resp.status === 429) {
    const ra = resp.headers.get('retry-after');
    throw new ScraperRateLimitError('CO SOS rate limited', SOURCE_KEY, ra ? Number(ra) : null);
  }
  if (resp.status >= 500 || !resp.ok) {
    throw new ScraperUpstreamError(`CO SOS HTTP ${resp.status}`, SOURCE_KEY, resp.status);
  }

  const rawText = await resp.text();
  let rows: CoSosRawRow[];
  try {
    const parsed = JSON.parse(rawText);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new ScraperUpstreamError('CO SOS non-JSON response', SOURCE_KEY, resp.status);
  }

  const duration_ms = Date.now() - start;
  const sha = sha256Hex(rawText);
  const snippet = rawText.slice(0, 1500);

  if (rows.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'business_not_found',
      confidence: 'verified_structured',
      finding_summary: `CO SOS: no business entity registered as "${legalName}"`,
      extracted_facts: {
        jurisdiction: 'CO',
        query_name: legalName,
        match_count: 0,
      },
      query_sent: url,
      response_sha256: sha,
      response_snippet: snippet,
      duration_ms,
      cost_cents: 0,
    };
  }

  const row = pickBestMatch(rows, legalName);
  const status = (row.entitystatus ?? '').trim();
  const findingType = mapStatus(status);
  const officer = buildAgentOfficer(row);
  const officers: OfficerEntry[] = officer ? [officer] : [];

  const formationDate = parseCoDate(row.entityformdate);
  const entityType = mapEntityType(row.entitytype);
  const agentOrgName = (row.agentorganizationname ?? '').trim();

  const facts: Record<string, unknown> = {
    jurisdiction: 'CO',
    query_name: legalName,
    match_count: rows.length,
    entity_id: row.entityid ?? null,
    entity_name: row.entityname ?? null,
    status,
    entity_type: entityType,
    entity_type_code: row.entitytype ?? null,
    formation_date: formationDate,
    jurisdiction_of_formation: row.jurisdictonofformation ?? null,
    principal_address: [
      row.principaladdress1,
      row.principalcity,
      row.principalstate,
      row.principalzipcode,
    ].filter(Boolean).join(', ') || null,
    registered_agent_organization: agentOrgName || null,
    officers,
  };

  return {
    source_key: SOURCE_KEY,
    finding_type: findingType,
    confidence: 'verified_structured',
    finding_summary: buildSummary(findingType, legalName, status, formationDate),
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
  status: string,
  formationDate: string | null,
): string {
  const fd = formationDate ? `, formed ${formationDate}` : '';
  switch (findingType) {
    case 'business_active':
      return `CO SOS: "${legalName}" is in Good Standing${fd}`;
    case 'business_inactive':
      return `CO SOS: "${legalName}" status is ${status || 'inactive'}${fd}`;
    case 'business_dissolved':
      return `CO SOS: "${legalName}" status is ${status || 'dissolved'}${fd}`;
    default:
      return `CO SOS: "${legalName}" status ${status}${fd}`;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 227: entity disambiguation — candidate search.
//
// Hits the same Socrata dataset as scrapeCoSosBiz but with a higher row cap
// and returns all rows mapped to EntityCandidate, ranked by name-similarity.
// Opportunistic — never throws, returns [] on any error so the orchestrator's
// disambiguation fallback degrades gracefully into entity_not_found.
// ──────────────────────────────────────────────────────────────────────────

export interface CoSosBizCandidateInput {
  legalName: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const CANDIDATE_FETCH_LIMIT = 20;
const CANDIDATE_RETURN_LIMIT = 5;

function composePrincipalAddress(row: CoSosRawRow): string | null {
  const parts = [
    row.principaladdress1,
    row.principalcity,
    row.principalstate,
    row.principalzipcode,
  ].map((p) => (p ?? '').trim()).filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join(', ') : null;
}

function composeRegisteredAgent(row: CoSosRawRow): string | null {
  const org = (row.agentorganizationname ?? '').trim();
  if (org) return org;
  const first = (row.agentfirstname ?? '').trim();
  const last = (row.agentlastname ?? '').trim();
  if (!first || !last) return null;
  const middle = (row.agentmiddlename ?? '').trim();
  const suffix = (row.agentsuffix ?? '').trim();
  return [first, middle, last, suffix].filter((p) => p.length > 0).join(' ');
}

export async function searchCoSosCandidates(
  input: CoSosBizCandidateInput,
  limit: number = CANDIDATE_RETURN_LIMIT,
): Promise<EntityCandidate[]> {
  const legalName = input.legalName?.trim();
  if (!legalName) return [];

  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const searchTerm = normalizeForSocrataQuery(legalName);
  const escaped = searchTerm.replace(/'/g, "''");
  const where = `upper(entityname) like upper('%${escaped}%')`;
  const url = `${ENDPOINT}?$where=${encodeURIComponent(where)}&$limit=${CANDIDATE_FETCH_LIMIT}`;

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
    const rows = (await resp.json()) as CoSosRawRow[];
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const mapped: EntityCandidate[] = rows
      .filter((r) => typeof r.entityname === 'string' && r.entityname.length > 0)
      .map((r) => ({
        entity_id: (r.entityid ?? '').trim() || `co_sos:${r.entityname}`,
        entity_name: (r.entityname ?? '').trim(),
        entity_type: mapEntityType(r.entitytype as string | null),
        status: (r.entitystatus ?? null) as string | null,
        formation_date: parseCoDate(r.entityformdate),
        principal_address: composePrincipalAddress(r),
        registered_agent: composeRegisteredAgent(r),
        source_key: SOURCE_KEY,
        source_url: `${ENDPOINT}?$where=${encodeURIComponent(`upper(entityname) like upper('%${escaped}%')`)}`,
        similarity_score: 0, // overwritten by rankCandidates
      }));
    return rankCandidates(legalName, mapped, { limit });
  } catch {
    // Disambiguation is opportunistic — never block the request on a candidate
    // lookup failure. The caller (orchestrator) falls through to
    // entity_not_found when this returns [].
    return [];
  } finally {
    clearTimeout(timer);
  }
}
