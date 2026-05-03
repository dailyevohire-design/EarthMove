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
 * CO DORA Professional & Occupational Licenses scraper.
 *
 * Source: data.colorado.gov dataset 7s5z-vewr — Socrata SODA endpoint with
 * BOTH licensure status AND disciplinary action fields per row. Updated
 * daily by DORA. This is the structured surface that bypasses the
 * apps2.colorado.gov ASPX VIEWSTATE form entirely.
 *
 * Coverage: ALL CO professional + occupational licenses — electricians,
 * plumbers, CPAs, nurses, real estate, etc. For contractors specifically,
 * the relevant licensetype values are: ELE / PLU / MEC subcategories.
 *
 * Lookup strategy: search entityname first (for company-licensed trades);
 * fall back to lastname/firstname match (for individual licensees).
 *
 * Disciplinary detection: row's `programaction` field is non-null when
 * disciplinary action has been taken; combined with `licensestatusdescription`
 * we map to license_active / _suspended / _revoked / _disciplinary_action.
 */

const SOURCE_KEY = 'co_dora';
const ENDPOINT = 'https://data.colorado.gov/resource/7s5z-vewr.json';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ROWS = 10;

export interface CoDoraInput {
  legalName: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface CoDoraRawRow {
  entityname?: string;
  lastname?: string;
  firstname?: string;
  middlename?: string;
  suffix?: string;
  city?: string;
  state?: string;
  mailzipcode?: string;
  licensetype?: string;
  subcategory?: string;
  licensenumber?: string;
  licensefirstissuedate?: string;
  licenselastreneweddate?: string;
  licenseexpirationdate?: string;
  licensestatusdescription?: string;
  specialty?: string;
  title?: string;
  casenumber?: string;
  programaction?: string;
  disciplineeffectivedate?: string;
  disciplinecompletedate?: string;
  linktoverifylicense?: { url?: string };
  [k: string]: unknown;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function mapStatusToFinding(row: CoDoraRawRow): TrustFindingType {
  const status = (row.licensestatusdescription ?? '').trim().toLowerCase();
  const hasAction = !!(row.programaction ?? '').trim();
  if (status === 'revoked') return 'license_revoked';
  if (status === 'suspended') return 'license_suspended';
  if (status === 'expired') return 'license_expired';
  if (status === 'inactive') return 'license_inactive';
  if (status === 'active') {
    return hasAction ? 'license_disciplinary_action' : 'license_active';
  }
  if (hasAction) return 'license_disciplinary_action';
  return 'license_inactive';
}

function pickBestMatch(rows: CoDoraRawRow[], normalizedTerm: string): CoDoraRawRow {
  const target = normalizedTerm.toLowerCase();
  const exact = rows.find(r =>
    normalizeForExternalQuery(r.entityname ?? '').toLowerCase() === target,
  );
  if (exact) return exact;
  // Prefer Active > others when no exact name match.
  const active = rows.find(r =>
    (r.licensestatusdescription ?? '').toLowerCase() === 'active'
    && !(r.programaction ?? '').trim(),
  );
  return active ?? rows[0];
}

export async function scrapeCoDoraDiscipline(input: CoDoraInput): Promise<ScraperEvidence> {
  const legalName = input.legalName?.trim();
  if (!legalName) throw new Error('scrapeCoDoraDiscipline: legalName required');

  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const searchTerm = normalizeForExternalQuery(legalName);
  const escaped = searchTerm.replace(/'/g, "''");
  // Search BOTH entityname and lastname — covers company licenses + individual licenses.
  const where =
    `upper(entityname) like upper('%${escaped}%') OR upper(lastname) like upper('%${escaped}%')`;
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
    if (e?.name === 'AbortError') throw new ScraperTimeoutError(`CO DORA timeout after ${timeoutMs}ms`, SOURCE_KEY);
    throw new ScraperUpstreamError(`CO DORA network: ${e?.message ?? err}`, SOURCE_KEY, 0);
  }
  clearTimeout(timer);

  if (resp.status === 429) {
    const ra = resp.headers.get('retry-after');
    throw new ScraperRateLimitError('CO DORA rate limited', SOURCE_KEY, ra ? Number(ra) : null);
  }
  if (resp.status >= 500 || !resp.ok) {
    throw new ScraperUpstreamError(`CO DORA HTTP ${resp.status}`, SOURCE_KEY, resp.status);
  }

  const rawText = await resp.text();
  let rows: CoDoraRawRow[];
  try {
    const parsed = JSON.parse(rawText);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new ScraperUpstreamError('CO DORA non-JSON response', SOURCE_KEY, resp.status);
  }

  const duration_ms = Date.now() - start;
  const sha = sha256Hex(rawText);
  const snippet = rawText.slice(0, 1500);

  if (rows.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'license_no_record',
      confidence: 'verified_structured',
      finding_summary: `CO DORA: no professional/occupational license record matching "${legalName}". CO has no statewide GC license; this source covers electricians, plumbers, CPAs, etc. Absence does not indicate a problem for unlicensed-trade contractors.`,
      extracted_facts: {
        jurisdiction: 'CO',
        agency: 'Colorado DORA',
        query_name: legalName,
        match_count: 0,
        source_dataset: '7s5z-vewr',
      },
      query_sent: url,
      response_sha256: sha,
      response_snippet: snippet,
      duration_ms,
      cost_cents: 0,
    };
  }

  const row = pickBestMatch(rows, searchTerm);
  const findingType = mapStatusToFinding(row);
  const facts: Record<string, unknown> = {
    jurisdiction: 'CO',
    agency: 'Colorado DORA',
    query_name: legalName,
    match_count: rows.length,
    license_number: row.licensenumber ?? null,
    license_type: row.licensetype ?? null,
    subcategory: row.subcategory ?? null,
    license_status: row.licensestatusdescription ?? null,
    licensee_entityname: row.entityname ?? null,
    licensee_individual_name:
      [row.firstname, row.middlename, row.lastname, row.suffix].filter(Boolean).join(' ') || null,
    license_first_issued: (row.licensefirstissuedate ?? '').slice(0, 10) || null,
    license_last_renewed: (row.licenselastreneweddate ?? '').slice(0, 10) || null,
    license_expiration: (row.licenseexpirationdate ?? '').slice(0, 10) || null,
    case_number: (row.casenumber ?? '').trim() || null,
    program_action: (row.programaction ?? '').trim() || null,
    discipline_effective_date: (row.disciplineeffectivedate ?? '').slice(0, 10) || null,
    discipline_complete_date: (row.disciplinecompletedate ?? '').slice(0, 10) || null,
    verify_url: row.linktoverifylicense?.url ?? null,
    source_dataset: '7s5z-vewr',
  };

  const summary = (() => {
    switch (findingType) {
      case 'license_active': return `CO DORA: "${legalName}" license #${row.licensenumber ?? '?'} is Active (${row.licensetype ?? 'license'}), no disciplinary action on record`;
      case 'license_suspended': return `CO DORA: "${legalName}" license #${row.licensenumber ?? '?'} is SUSPENDED${row.programaction ? ' — ' + row.programaction : ''}`;
      case 'license_revoked': return `CO DORA: "${legalName}" license #${row.licensenumber ?? '?'} is REVOKED${row.programaction ? ' — ' + row.programaction : ''}`;
      case 'license_disciplinary_action': return `CO DORA: "${legalName}" license #${row.licensenumber ?? '?'} has disciplinary action on record${row.programaction ? ': ' + row.programaction : ''}`;
      case 'license_expired': return `CO DORA: "${legalName}" license #${row.licensenumber ?? '?'} EXPIRED on ${(row.licenseexpirationdate ?? '').slice(0, 10) || 'unknown date'}`;
      case 'license_inactive': return `CO DORA: "${legalName}" license #${row.licensenumber ?? '?'} status is ${row.licensestatusdescription ?? 'inactive'}`;
      default: return `CO DORA: "${legalName}" license status ${row.licensestatusdescription ?? 'unknown'}`;
    }
  })();

  return {
    source_key: SOURCE_KEY,
    finding_type: findingType,
    confidence: 'verified_structured',
    finding_summary: summary,
    extracted_facts: facts,
    query_sent: url,
    response_sha256: sha,
    response_snippet: snippet,
    duration_ms,
    cost_cents: 0,
  };
}
