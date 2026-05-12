import 'server-only';
import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  type TrustFindingType,
  type TrustConfidence,
  ScraperAuthError,
  ScraperRateLimitError,
  ScraperTimeoutError,
  ScraperUpstreamError,
} from './types';

/**
 * tdlr_disciplinary — Texas TDLR Disciplinary Actions via Google Custom Search.
 *
 * Pivots around the cimsfo/fosearch.asp unscriptable problem (mig 212) by querying
 * Google's index of tdlr.texas.gov Final Order detail pages via the Custom Search
 * JSON API. Free tier: 100 queries/day. Roadmap: swap to Serper at production scale.
 *
 * Confidence weight 0.85 vs tx_tdlr 0.90 reflects index-coverage gap (~60-80% of FOs).
 * Coverage gap is documented in trust_source_registry.notes.
 *
 * Contract: mirrors state-ag-enforcement.ts — pure function that returns
 * ScraperEvidence (or array) and throws typed ScraperError subclasses on infra
 * failure. persist-evidence.ts is the single DB chokepoint.
 *
 * API-key safety: citation_url and query_sent both use google.com/search (no key),
 * never the GCSE endpoint URL. The fully-keyed requestUrl never leaves this module.
 */

const SOURCE_KEY = 'tdlr_disciplinary';
const GCSE_ENDPOINT = 'https://customsearch.googleapis.com/customsearch/v1';
const GCSE_TIMEOUT_MS = 8_000;
const ALLOWED_HOSTNAMES = new Set([
  'www.tdlr.texas.gov',
  'tdlr.texas.gov',
]);
const MAX_NAME_LENGTH = 200;
const MAX_GCSE_ITEMS_PROCESSED = 5;
const MAX_DESTINATION_FETCHES = 3;
const DESTINATION_FETCH_TIMEOUT_MS = 5_000;
const DESTINATION_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const SNIPPET_DB_CAP = 4_096;

// Sanction keyword priority — first match wins.
const SANCTION_KEYWORDS: ReadonlyArray<{
  pattern: RegExp;
  findingType: TrustFindingType;
}> = [
  { pattern: /\brevoke[ds]?\b|\brevocation\b/i, findingType: 'license_revoked' },
  { pattern: /\bsuspen(?:d|ded|sion)\b/i, findingType: 'license_suspended' },
  {
    pattern: /administrative\s+penalty|\$[\d,]+\s+(?:penalty|fine|assessed)|civil\s+penalty/i,
    findingType: 'license_penalty_assessed',
  },
  {
    pattern: /agreed\s+order|final\s+order|reprimand|probation|sanction/i,
    findingType: 'license_disciplinary_action',
  },
];

export interface TdlrDisciplinaryInput {
  legalName: string;
  stateCode: string;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeName(raw: string): string | null {
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return cleaned.length === 0 ? null : cleaned;
}

function nameMentioned(haystack: string, name: string): boolean {
  return new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(haystack);
}

/**
 * SSRF-safe destination fetch:
 *   - https-only, hostname allowlist (*.tdlr.texas.gov)
 *   - manual single-hop redirect with re-check
 *   - 5s timeout, 2MB streamed body cap (defends missing/lying Content-Length)
 */
async function fetchAllowlistedHtml(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) return null;

  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(DESTINATION_FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Groundcheck/1.0 (+https://earthmove.io/trust)' },
    });
  } catch {
    return null;
  }

  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (!loc) return null;
    let nextUrl: URL;
    try {
      nextUrl = new URL(loc, parsed);
    } catch {
      return null;
    }
    if (!ALLOWED_HOSTNAMES.has(nextUrl.hostname) || nextUrl.protocol !== 'https:') return null;
    try {
      res = await fetch(nextUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(DESTINATION_FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': 'Groundcheck/1.0 (+https://earthmove.io/trust)' },
      });
    } catch {
      return null;
    }
  }

  if (!res.ok) return null;

  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > DESTINATION_MAX_BYTES) return null;

  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  let readResult = await reader.read();
  while (!readResult.done) {
    const { value } = readResult;
    if (value) {
      total += value.byteLength;
      if (total > DESTINATION_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    readResult = await reader.read();
  }
  if (chunks.length === 1) return new TextDecoder('utf-8').decode(chunks[0]);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

interface GcseItem {
  link: string;
  title: string;
  snippet: string;
}

/** Defensive narrowing of GCSE response shape — no zod dep. */
function parseGcseItems(raw: unknown): GcseItem[] {
  if (raw === null || typeof raw !== 'object') return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: GcseItem[] = [];
  for (const it of items) {
    if (it === null || typeof it !== 'object') continue;
    const r = it as Record<string, unknown>;
    if (typeof r.link === 'string' && typeof r.title === 'string' && typeof r.snippet === 'string') {
      out.push({ link: r.link, title: r.title, snippet: r.snippet });
    }
  }
  return out;
}

interface Classification {
  finding_type: TrustFindingType;
  matched_keyword: string;
}

function classifyFinding(text: string): Classification | null {
  for (const { pattern, findingType } of SANCTION_KEYWORDS) {
    const m = text.match(pattern);
    if (m) return { finding_type: findingType, matched_keyword: m[0] };
  }
  return null;
}

// ── Main entrypoint ──────────────────────────────────────────────────────────

export async function scrapeTdlrDisciplinary(
  input: TdlrDisciplinaryInput,
): Promise<ScraperEvidence | ScraperEvidence[]> {
  const start = Date.now();
  const state = (input.stateCode ?? '').toUpperCase();

  // 1. State gate — TX-only.
  if (state !== 'TX') {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'source_not_applicable',
      confidence: 'verified_structured',
      finding_summary: `TDLR Disciplinary: not applicable for state ${state || '(none)'} — TX only`,
      extracted_facts: { reason: 'state_not_applicable', state },
      query_sent: null,
      response_sha256: null,
      response_snippet: null,
      duration_ms: Date.now() - start,
      cost_cents: 0,
    };
  }

  // 2. Name validation.
  const name = sanitizeName(input.legalName);
  if (!name) {
    throw new ScraperUpstreamError('TDLR Disciplinary: empty/invalid legalName', SOURCE_KEY, 0);
  }

  // 3. Env gate. Throwing ScraperAuthError lets the orchestrator persist a
  //    source_error attribution; nothing else in this module references the key.
  const cseId = process.env.GOOGLE_CSE_ID;
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  if (!cseId || !apiKey) {
    throw new ScraperAuthError(
      'TDLR Disciplinary: GOOGLE_CSE_ID or GOOGLE_CSE_API_KEY not set',
      SOURCE_KEY,
    );
  }

  // 4. Query — quoted name forces phrase match across known sanction keywords.
  const query = `site:tdlr.texas.gov "${name}" (revoked OR suspended OR sanction OR penalty OR "agreed order" OR "final order")`;
  const params = new URLSearchParams({ key: apiKey, cx: cseId, q: query, num: '10' });
  const requestUrl = `${GCSE_ENDPOINT}?${params.toString()}`;
  // citationUrl is what we persist (query_sent / extracted_facts.citation_url).
  // It must never contain the API key — requestUrl is for the in-flight fetch only.
  const citationUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  // 5. GCSE fetch with timeout.
  let gcseRes: Response;
  try {
    gcseRes = await fetch(requestUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(GCSE_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ScraperTimeoutError(
        `TDLR Disciplinary: GCSE timeout after ${GCSE_TIMEOUT_MS}ms`,
        SOURCE_KEY,
      );
    }
    throw new ScraperUpstreamError(
      `TDLR Disciplinary: GCSE network error: ${err instanceof Error ? err.message : 'unknown'}`,
      SOURCE_KEY,
      0,
    );
  }

  const rawText = await gcseRes.text();
  const responseSha = createHash('sha256').update(rawText).digest('hex');
  const snippetForDb = rawText.slice(0, SNIPPET_DB_CAP);

  // 6. Quota / forbidden — throw ScraperRateLimitError; orchestrator persists.
  if (gcseRes.status === 429 || gcseRes.status === 403) {
    const ra = gcseRes.headers.get('retry-after');
    throw new ScraperRateLimitError(
      `TDLR Disciplinary: GCSE quota exhausted (HTTP ${gcseRes.status})`,
      SOURCE_KEY,
      ra ? Number(ra) : null,
    );
  }

  if (!gcseRes.ok) {
    throw new ScraperUpstreamError(
      `TDLR Disciplinary: GCSE HTTP ${gcseRes.status}`,
      SOURCE_KEY,
      gcseRes.status,
    );
  }

  // 7. Defensive JSON parse.
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ScraperUpstreamError(
      'TDLR Disciplinary: GCSE returned non-JSON body',
      SOURCE_KEY,
      gcseRes.status,
    );
  }

  const items = parseGcseItems(parsed).slice(0, MAX_GCSE_ITEMS_PROCESSED);

  // 8. Zero indexed hits → single license_no_record evidence.
  if (items.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'license_no_record',
      confidence: 'verified_structured',
      finding_summary: `TDLR Disciplinary (TX): no indexed sanction pages found for "${name}" (0 GCSE hits)`,
      extracted_facts: {
        ag_state: 'TX',
        results_checked: 0,
        citation_url: citationUrl,
      },
      query_sent: citationUrl,
      response_sha256: responseSha,
      response_snippet: snippetForDb,
      duration_ms: Date.now() - start,
      cost_cents: 0,
    };
  }

  // 9. Two-pass classification: snippet first, fall back to destination body.
  const evidence: ScraperEvidence[] = [];
  let destinationFetchBudget = MAX_DESTINATION_FETCHES;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // SSRF gate before any destination work.
    let itemHost: string;
    try {
      itemHost = new URL(item.link).hostname;
    } catch {
      continue;
    }
    if (!ALLOWED_HOSTNAMES.has(itemHost)) continue;

    const snippetText = `${item.title}\n${item.snippet}`;
    const snippetHasName = nameMentioned(snippetText, name);
    const snippetClassification = classifyFinding(snippetText);

    let matchSource: 'snippet' | 'destination_page' | 'unmatched' = 'unmatched';
    let finalConfidence: TrustConfidence = 'medium_llm';
    let finalClassification: Classification | null = snippetClassification;
    let finalText = snippetText;

    if (snippetHasName && snippetClassification) {
      matchSource = 'snippet';
      finalConfidence = 'high_llm';
    }

    if (
      destinationFetchBudget > 0 &&
      (!snippetHasName || !snippetClassification)
    ) {
      destinationFetchBudget--;
      const body = await fetchAllowlistedHtml(item.link);
      if (body !== null) {
        const bodyHasName = nameMentioned(body, name);
        const bodyClassification = classifyFinding(body);
        if (bodyHasName && bodyClassification) {
          matchSource = 'destination_page';
          finalConfidence = 'verified_structured';
          finalClassification = bodyClassification;
          finalText = body;
        }
      }
    }

    if (matchSource === 'unmatched' || !finalClassification) continue;

    const evidenceSnippet =
      matchSource === 'destination_page'
        ? finalText.slice(0, SNIPPET_DB_CAP)
        : snippetForDb;

    evidence.push({
      source_key: SOURCE_KEY,
      finding_type: finalClassification.finding_type,
      confidence: finalConfidence,
      finding_summary:
        `TDLR Disciplinary (TX): ${finalClassification.finding_type} matched for "${name}" ` +
        `via ${matchSource} — keyword "${finalClassification.matched_keyword}"`,
      extracted_facts: {
        ag_state: 'TX',
        citation_url: item.link,
        hit_index: i,
        match_source: matchSource,
        sanction_keyword: finalClassification.matched_keyword,
        gcse_search_url: citationUrl,
        results_checked: items.length,
      },
      query_sent: citationUrl,
      response_sha256: responseSha,
      response_snippet: evidenceSnippet,
      duration_ms: Date.now() - start,
      cost_cents: 0,
    });
  }

  // 10. GCSE returned items but none classified → single no_record summary.
  if (evidence.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'license_no_record',
      confidence: 'verified_structured',
      finding_summary: `TDLR Disciplinary (TX): ${items.length} GCSE hits but no strict-name + sanction-keyword matches for "${name}"`,
      extracted_facts: {
        ag_state: 'TX',
        results_checked: items.length,
        citation_url: citationUrl,
      },
      query_sent: citationUrl,
      response_sha256: responseSha,
      response_snippet: snippetForDb,
      duration_ms: Date.now() - start,
      cost_cents: 0,
    };
  }

  return evidence;
}
