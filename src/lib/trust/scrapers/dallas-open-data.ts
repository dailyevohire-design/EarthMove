import type { ScraperEvidence } from './types';
import {
  type PermitRecord,
  normalizePermits,
  computeSignals,
  emitFindings,
  emitFetchErrorFinding,
} from './permit-normalize';

const SOURCE_KEY = 'dallas_open_data';
const JURISDICTION = 'dallas';
const ENDPOINT = 'https://www.dallasopendata.com/resource/e7gq-4sah.json';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ROWS = 200;

export interface DallasPermitsInput {
  legalName: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  asOf?: Date;
}

interface DallasRawRow {
  permit_number?: string;
  permit_type?: string;
  issued_date?: string;
  contractor?: string;
  street_address?: string;
  work_description?: string;
  [k: string]: unknown;
}

/**
 * Parse Dallas's MM/DD/YY date format → ISO YYYY-MM-DD. Pivots two-digit
 * years on 70: 70-99 → 1970-1999; 00-69 → 2000-2069. Permits in this dataset
 * are post-2000 reality, so the pivot is conservative.
 */
function parseDallasDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s.trim());
  if (!m) return null;
  const month = m[1].padStart(2, '0');
  const day = m[2].padStart(2, '0');
  let year = m[3];
  if (year.length === 2) {
    const yi = parseInt(year, 10);
    year = (yi >= 70 ? '19' : '20') + year;
  }
  return `${year}-${month}-${day}`;
}

/**
 * Dallas embeds the contractor's name and address in a single `contractor`
 * field separated by the first 4-digit number (a street address) or comma.
 * We extract the leading name portion and store the full blob in
 * extracted_facts.contractor_raw on each PermitRecord (caller drops it before
 * passing to emitFindings — we only need it for filtering matches).
 */
function extractContractorName(blob: string | undefined | null): string | null {
  if (!blob) return null;
  // Try to split before the first 4+ digit number that looks like a street #
  const m = /^(.*?)\s+\d{3,}\b/.exec(blob);
  const name = (m ? m[1] : blob.split(',')[0]).trim();
  return name || null;
}

function adapt(raw: DallasRawRow): PermitRecord | null {
  const issued = parseDallasDate(raw.issued_date);
  if (!issued) return null;
  if (!raw.permit_number) return null;
  const contractor = extractContractorName(raw.contractor ?? null);
  return {
    permit_number: String(raw.permit_number),
    issued_date: issued,
    work_class: String(raw.permit_type ?? raw.work_description ?? ''),
    address: String(raw.street_address ?? ''),
    status: '',
    contractor_name: contractor,
  };
}

/**
 * Scrape Dallas Open Data permits for a contractor. Returns ScraperEvidence[]
 * (1 informational + 0..N flag rows). On fetch error returns a single
 * unverified informational row instead of throwing — fan-out persists it via
 * append_trust_evidence with chain integrity preserved.
 */
export async function scrapeDallasPermits(input: DallasPermitsInput): Promise<ScraperEvidence[]> {
  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const asOf = input.asOf ?? new Date();
  const legalName = input.legalName.trim();

  if (!legalName) {
    return [emitFetchErrorFinding({
      source_key: SOURCE_KEY, jurisdiction: JURISDICTION, contractor_name: '',
      error: new Error('legalName required'),
    })];
  }

  // Socrata SODA: $where=upper(contractor) like upper('%NAME%')
  const escaped = legalName.replace(/'/g, "''");
  const where = `upper(contractor) like upper('%${escaped}%')`;
  const url = `${ENDPOINT}?$where=${encodeURIComponent(where)}&$limit=${MAX_ROWS}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let raw: DallasRawRow[];
  try {
    const resp = await fetchFn(url, { signal: controller.signal });
    if (!resp.ok) {
      return [emitFetchErrorFinding({
        source_key: SOURCE_KEY, jurisdiction: JURISDICTION, contractor_name: legalName,
        error: new Error(`HTTP ${resp.status}`),
      })];
    }
    raw = await resp.json();
  } catch (err) {
    return [emitFetchErrorFinding({
      source_key: SOURCE_KEY, jurisdiction: JURISDICTION, contractor_name: legalName, error: err,
    })];
  } finally {
    clearTimeout(timer);
  }

  const permits = normalizePermits(raw, adapt);
  const signals = computeSignals(permits, asOf);
  return emitFindings(permits, signals, {
    source_key: SOURCE_KEY,
    jurisdiction: JURISDICTION,
    contractor_name: legalName,
    asOf,
  });
}
