import 'server-only';
import {
  type ScraperEvidence,
  type ScraperResult,
  ScraperUpstreamError,
  ScraperTimeoutError,
} from './types';

/**
 * fmcsa_safer — FMCSA SAFER carrier safety lookup via the QCMobile public API.
 *
 * Endpoint shape:
 *   GET https://mobile.fmcsa.dot.gov/qc/services/carriers/name/{name}?webKey={key}
 *
 * Requires FMCSA_WEB_KEY env var (register at
 * https://mobile.fmcsa.dot.gov/QCDevsite/). When the env var is missing, the
 * scraper returns a single source_not_applicable evidence row so it ships
 * safely before the key lands in Vercel prod env. Aligned with the existing
 * scraper contract: pure function returning ScraperEvidence (or array), typed
 * ScraperError subclasses on infra failure, persist-evidence.ts is the single
 * DB chokepoint.
 *
 * Vocabulary (mig 241 extends trust_evidence finding_type CHECK + TS union):
 *   usdot_active                 — statusCode A + allowedToOperate Y
 *   usdot_out_of_service         — allowedToOperate N OR statusCode I OR oosDate present
 *   usdot_revoked                — statusCode R
 *   usdot_safety_satisfactory    — safetyRating "Satisfactory*"
 *   usdot_safety_conditional     — safetyRating "Conditional*"
 *   usdot_safety_unsatisfactory  — safetyRating "Unsatisfactory*"
 *   usdot_not_found              — empty result set OR unclassifiable hit
 */

const SOURCE_KEY = 'fmcsa_safer';
const API_BASE = 'https://mobile.fmcsa.dot.gov/qc/services/carriers';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_NAME_LENGTH = 100;

export interface FmcsaSaferInput {
  legalName: string;
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
  statusCode?: string;
  allowedToOperate?: string;
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

function extractCarriersFromResponse(data: unknown): FmcsaCarrier[] {
  if (!data || typeof data !== 'object') return [];
  const root = data as Record<string, unknown>;
  const content = root.content;
  if (!Array.isArray(content)) return [];
  const carriers: FmcsaCarrier[] = [];
  for (const entry of content) {
    if (entry && typeof entry === 'object' && 'carrier' in entry) {
      const c = (entry as { carrier: unknown }).carrier;
      if (c && typeof c === 'object') carriers.push(c as FmcsaCarrier);
    }
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
    operating_status: carrier.statusCode ?? null,
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
  if (code === 'R') return 'usdot_revoked';
  if (allowed === 'N' || carrier.oosDate || code === 'I') return 'usdot_out_of_service';
  if (allowed === 'Y' && (code === 'A' || code === '')) return 'usdot_active';
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
  const name = sanitizeName(input.legalName);

  if (!name) {
    throw new ScraperUpstreamError('FMCSA SAFER: empty/invalid legalName', SOURCE_KEY, 0);
  }

  // Env-var graceful degrade — scraper ships before the key lands in Vercel.
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

  const url = `${API_BASE}/name/${encodeURIComponent(name)}?webKey=${encodeURIComponent(webKey)}`;
  const redactedUrl = url.replace(encodeURIComponent(webKey), 'REDACTED');

  let res: Response;
  try {
    res = await fetch(url, {
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

  const carriers = extractCarriersFromResponse(data);

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
    // Carrier match but unclassifiable status/rating — record as not_found with
    // facts so the row still flows for audit / future re-scraping.
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
