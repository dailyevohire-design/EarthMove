import {
  type ScraperEvidence,
  type ScraperResult,
  ScraperUpstreamError,
  ScraperTimeoutError,
} from './types';

/**
 * fmcsa_safer — FMCSA SAFER carrier safety lookup via the QCMobile public API.
 *
 * Canonical endpoints (per FMCSA QCMobile docs at
 * mobile.fmcsa.dot.gov/QCDevsite/docs/qcApi):
 *   GET https://mobile.fmcsa.dot.gov/qc/services/carriers/{dotNumber}?webKey={key}
 *   GET https://mobile.fmcsa.dot.gov/qc/services/carriers/name/{name}?webKey={key}
 *
 * The HAL _links block in responses (e.g. _links.searchByName → /qc/name/{name})
 * describes FMCSA-internal routing; those paths return
 * `{ content: "There is no resource for path ..." }` on the public API and must
 * not be used. Live verification with a valid webKey against USDOT 3686940
 * confirmed only the /qc/services/carriers/... paths work.
 *
 * Requires FMCSA_WEB_KEY env var (register at
 * https://mobile.fmcsa.dot.gov/QCDevsite/). When the env var is missing the
 * scraper returns source_not_applicable; when the env var is invalid the API
 * answers HTTP 200 with body `{ content: "Webkey not found" }` — we detect
 * this and emit source_error with reason='auth_failed' instead of silent
 * usdot_not_found misclassification. Any other string in `content` (such as
 * the "There is no resource for path ..." sentinel returned by bad routes)
 * maps to reason='api_string_response'.
 *
 * Vocabulary (mig 241 extends trust_evidence finding_type CHECK + TS union):
 *   usdot_active                 — operating active per any of statusCode/allowedToOperate/operatingStatus
 *   usdot_out_of_service         — N/I or operatingStatus indicates OOS or oosDate present
 *   usdot_revoked                — statusCode R or operatingStatus REVOKED
 *   usdot_safety_satisfactory    — safetyRating "Satisfactory*"
 *   usdot_safety_conditional     — safetyRating "Conditional*"
 *   usdot_safety_unsatisfactory  — safetyRating "Unsatisfactory*"
 *   usdot_not_found              — empty result set OR unclassifiable hit
 */

const SOURCE_KEY = 'fmcsa_safer';
const API_BASE = 'https://mobile.fmcsa.dot.gov/qc';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_NAME_LENGTH = 100;

/** Thrown when the API returns a top-level string in `content` — almost
 *  always an auth failure ("Webkey not found"). Lets the main fn translate
 *  to source_error with structured reason. */
class FmcsaAuthError extends Error {
  constructor(
    public readonly reason: 'auth_failed' | 'api_string_response',
    public readonly raw_message: string,
  ) {
    super(raw_message);
    this.name = 'FmcsaAuthError';
  }
}

export interface FmcsaSaferInput {
  legalName: string;
  /** DI seam for tests — defaults to global fetch in production. */
  fetchFn?: typeof fetch;
}

interface FmcsaCarrier {
  dotNumber?: number | string;
  legalName?: string;
  dbaName?: string;
  phyStreet?: string;
  phyCity?: string;
  phyState?: string;
  phone?: string;
  mcNumber?: string;
  /** Single-letter code from the legacy carrier snapshot (A=Active, I=Inactive, R=Revoked). */
  statusCode?: string;
  /** Y/N — present in QCMobile responses. */
  allowedToOperate?: string;
  /** Word-form alternative ("ACTIVE", "INACTIVE", "REVOKED", "OUT_OF_SERVICE"). */
  operatingStatus?: string;
  safetyRating?: string;
  totalDrivers?: number;
  totalPowerUnits?: number;
  oosDate?: string | null;
}

function sanitizeName(raw: string): string | null {
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return cleaned.length === 0 ? null : cleaned;
}

/** Extracts carrier rows from a QCMobile response. Throws FmcsaAuthError
 *  when `content` is a string (the API's error-channel for invalid webKey
 *  and similar auth/quota issues). */
function extractCarriersFromResponse(data: unknown): FmcsaCarrier[] {
  if (!data || typeof data !== 'object') return [];
  const root = data as Record<string, unknown>;
  const content = root.content;

  if (typeof content === 'string') {
    const reason: 'auth_failed' | 'api_string_response' =
      content === 'Webkey not found' ? 'auth_failed' : 'api_string_response';
    throw new FmcsaAuthError(reason, content);
  }

  const carriers: FmcsaCarrier[] = [];
  // Two shapes seen in the wild:
  //   { content: [{ carrier: {...} }, ...] }  — name-search list
  //   { content: { carrier: {...} } }         — single-DOT detail
  if (Array.isArray(content)) {
    for (const entry of content) {
      if (entry && typeof entry === 'object' && 'carrier' in entry) {
        const c = (entry as { carrier: unknown }).carrier;
        if (c && typeof c === 'object') carriers.push(c as FmcsaCarrier);
      }
    }
  } else if (content && typeof content === 'object' && 'carrier' in content) {
    const c = (content as { carrier: unknown }).carrier;
    if (c && typeof c === 'object') carriers.push(c as FmcsaCarrier);
  }
  return carriers;
}

function buildExtractedFacts(carrier: FmcsaCarrier): Record<string, unknown> {
  const dot = carrier.dotNumber != null ? String(carrier.dotNumber) : null;
  return {
    dot_number: dot,
    mc_number: carrier.mcNumber ?? null,
    legal_name: carrier.legalName ?? null,
    dba_name: carrier.dbaName ?? null,
    operating_status: carrier.operatingStatus ?? carrier.statusCode ?? null,
    allowed_to_operate: carrier.allowedToOperate ?? null,
    safety_rating: carrier.safetyRating ?? null,
    out_of_service_date: carrier.oosDate ?? null,
    total_drivers: carrier.totalDrivers ?? null,
    total_power_units: carrier.totalPowerUnits ?? null,
    phone: carrier.phone ?? null,
    physical_address:
      [carrier.phyStreet, carrier.phyCity, carrier.phyState].filter(Boolean).join(', ') || null,
    citation_url: dot
      ? `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${encodeURIComponent(dot)}`
      : null,
  };
}

function classifyOperatingStatus(
  carrier: FmcsaCarrier,
): 'usdot_active' | 'usdot_out_of_service' | 'usdot_revoked' | null {
  const allowed = (carrier.allowedToOperate ?? '').toUpperCase();
  const code = (carrier.statusCode ?? '').toUpperCase();
  const status = (carrier.operatingStatus ?? '').toUpperCase();

  if (code === 'R' || status === 'REVOKED') return 'usdot_revoked';
  if (
    allowed === 'N' ||
    carrier.oosDate ||
    code === 'I' ||
    status === 'INACTIVE' ||
    status === 'OUT_OF_SERVICE' ||
    status === 'OUT-OF-SERVICE'
  ) {
    return 'usdot_out_of_service';
  }
  if (allowed === 'Y' || code === 'A' || status === 'ACTIVE') return 'usdot_active';
  return null;
}

function classifySafetyRating(
  carrier: FmcsaCarrier,
): 'usdot_safety_satisfactory' | 'usdot_safety_conditional' | 'usdot_safety_unsatisfactory' | null {
  const rating = (carrier.safetyRating ?? '').toLowerCase().trim();
  if (rating.startsWith('satisfactory')) return 'usdot_safety_satisfactory';
  if (rating.startsWith('conditional')) return 'usdot_safety_conditional';
  if (rating.startsWith('unsatisfactory')) return 'usdot_safety_unsatisfactory';
  return null;
}

export async function scrapeFmcsaSafer(input: FmcsaSaferInput): Promise<ScraperResult> {
  const start = Date.now();
  const fetchImpl = input.fetchFn ?? fetch;
  const name = sanitizeName(input.legalName);

  if (!name) {
    throw new ScraperUpstreamError('FMCSA SAFER: empty/invalid legalName', SOURCE_KEY, 0);
  }

  const webKey = process.env.FMCSA_WEB_KEY?.trim();
  if (!webKey) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'source_not_applicable',
      confidence: 'verified_structured',
      finding_summary: 'FMCSA SAFER: FMCSA_WEB_KEY not configured — skipped',
      extracted_facts: { reason: 'fmcsa_webkey_missing' },
      query_sent: null,
      response_sha256: null,
      response_snippet: null,
      duration_ms: Date.now() - start,
      cost_cents: 0,
    };
  }

  // Canonical name-search path per QCMobile docs. The /qc/name/{name} variant
  // surfaced in the HAL _links block is not a public route — it returns
  // `{ content: "There is no resource for path ..." }`.
  const url = `${API_BASE}/services/carriers/name/${encodeURIComponent(name)}?webKey=${encodeURIComponent(webKey)}`;
  const redactedUrl = url.replace(encodeURIComponent(webKey), 'REDACTED');

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Groundcheck/1.0 (+https://earthmove.io/trust)',
      },
    });
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new ScraperTimeoutError(
        `FMCSA SAFER: request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        SOURCE_KEY,
      );
    }
    throw new ScraperUpstreamError(
      `FMCSA SAFER: fetch failed (${err instanceof Error ? err.message : 'unknown'})`,
      SOURCE_KEY,
      0,
    );
  }

  if (!res.ok) {
    throw new ScraperUpstreamError(`FMCSA SAFER: HTTP ${res.status}`, SOURCE_KEY, res.status);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ScraperUpstreamError(
      'FMCSA SAFER: invalid JSON response',
      SOURCE_KEY,
      res.status,
    );
  }

  let carriers: FmcsaCarrier[];
  try {
    carriers = extractCarriersFromResponse(data);
  } catch (err) {
    if (err instanceof FmcsaAuthError) {
      return {
        source_key: SOURCE_KEY,
        finding_type: 'source_error',
        confidence: 'verified_structured',
        finding_summary: `FMCSA SAFER: ${err.reason === 'auth_failed' ? 'webKey rejected' : 'unexpected API string response'} — "${err.raw_message}"`,
        extracted_facts: { reason: err.reason, raw_message: err.raw_message },
        query_sent: redactedUrl,
        response_sha256: null,
        response_snippet: null,
        duration_ms: Date.now() - start,
        cost_cents: 0,
      };
    }
    throw err;
  }

  if (carriers.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'usdot_not_found',
      confidence: 'verified_structured',
      finding_summary: `FMCSA SAFER: no carrier found for "${name}"`,
      extracted_facts: { searched_name: name, results_total: 0 },
      query_sent: redactedUrl,
      response_sha256: null,
      response_snippet: null,
      duration_ms: Date.now() - start,
      cost_cents: 0,
    };
  }

  const top = carriers[0];
  const facts = buildExtractedFacts(top);
  const opType = classifyOperatingStatus(top);
  const safetyType = classifySafetyRating(top);

  const evidence: ScraperEvidence[] = [];
  if (opType) {
    evidence.push({
      source_key: SOURCE_KEY,
      finding_type: opType,
      confidence: 'verified_structured',
      finding_summary: `FMCSA SAFER: ${top.legalName ?? name} — ${opType} (USDOT ${facts.dot_number ?? '?'})`,
      extracted_facts: { ...facts, results_total: carriers.length },
      query_sent: redactedUrl,
      response_sha256: null,
      response_snippet: null,
      duration_ms: Date.now() - start,
      cost_cents: 0,
    });
  }
  if (safetyType) {
    evidence.push({
      source_key: SOURCE_KEY,
      finding_type: safetyType,
      confidence: 'verified_structured',
      finding_summary: `FMCSA SAFER: safety rating ${top.safetyRating} (USDOT ${facts.dot_number ?? '?'})`,
      extracted_facts: { ...facts, results_total: carriers.length },
      query_sent: redactedUrl,
      response_sha256: null,
      response_snippet: null,
      duration_ms: Date.now() - start,
      cost_cents: 0,
    });
  }

  if (evidence.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'usdot_not_found',
      confidence: 'medium_llm',
      finding_summary: `FMCSA SAFER: carrier matched but unclassifiable status/rating for "${name}"`,
      extracted_facts: { ...facts, results_total: carriers.length },
      query_sent: redactedUrl,
      response_sha256: null,
      response_snippet: null,
      duration_ms: Date.now() - start,
      cost_cents: 0,
    };
  }

  return evidence;
}
