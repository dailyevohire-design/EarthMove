import 'server-only';
import {
  type ScraperEvidence,
  type TrustFindingType,
  type TrustConfidence,
  ScraperUpstreamError,
} from './types';
import {
  getSearchProvider,
  type SearchProviderResult,
} from './search-providers';

/**
 * tdlr_disciplinary — Texas TDLR Disciplinary Actions via a configurable search provider.
 *
 * Pivots around the cimsfo/fosearch.asp unscriptable problem (mig 212) by querying
 * Google's index of tdlr.texas.gov Final Order detail pages. Provider is chosen
 * via SEARCH_PROVIDER env var (default: serper). GCSE remains supported as a
 * fallback for free-tier (100/day) operation.
 *
 * Confidence weight 0.85 vs tx_tdlr 0.90 reflects index-coverage gap (~60-80%
 * of FOs are indexed by Google). Coverage gap is documented in trust_source_registry.notes.
 *
 * Contract: mirrors state-ag-enforcement.ts — pure function that returns
 * ScraperEvidence (or array) and throws typed ScraperError subclasses on infra
 * failure. persist-evidence.ts is the single DB chokepoint.
 */

const SOURCE_KEY = 'tdlr_disciplinary';
const ALLOWED_HOSTNAMES = new Set([
  'www.tdlr.texas.gov',
  'tdlr.texas.gov',
]);
const MAX_NAME_LENGTH = 200;
const MAX_ITEMS_PROCESSED = 5;
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

  // 3. Resolve the configured search provider (default: serper). Provider
  //    throws ScraperAuthError / ScraperRateLimitError / ScraperUpstreamError
  //    / ScraperTimeoutError on infra failure — orchestrator catches and
  //    persists a source_error attribution against this scraper's source_key.
  const provider = getSearchProvider();

  // 4. Query — quoted name forces phrase match across known sanction keywords.
  const query = `site:tdlr.texas.gov "${name}" (revoked OR suspended OR sanction OR penalty OR "agreed order" OR "final order")`;
  const result: SearchProviderResult = await provider.search(query, { numResults: 10 });

  const items = result.items.slice(0, MAX_ITEMS_PROCESSED);

  // 5. Zero indexed hits → single license_no_record evidence.
  if (items.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'license_no_record',
      confidence: 'verified_structured',
      finding_summary: `TDLR Disciplinary (TX): no indexed sanction pages found for "${name}" (0 search hits via ${provider.name})`,
      extracted_facts: {
        ag_state: 'TX',
        results_checked: 0,
        citation_url: result.citationUrl,
        search_provider: provider.name,
      },
      query_sent: result.citationUrl,
      response_sha256: result.rawResponseSha256,
      response_snippet: result.rawResponseSnippet,
      duration_ms: Date.now() - start,
      cost_cents: result.cost_cents,
    };
  }

  // 6. Two-pass classification: snippet first, fall back to destination body.
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
        : result.rawResponseSnippet;

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
        search_url: result.citationUrl,
        search_provider: provider.name,
        results_checked: items.length,
      },
      query_sent: result.citationUrl,
      response_sha256: result.rawResponseSha256,
      response_snippet: evidenceSnippet,
      duration_ms: Date.now() - start,
      cost_cents: result.cost_cents,
    });
  }

  // 7. Search returned items but none classified → single no_record summary.
  if (evidence.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'license_no_record',
      confidence: 'verified_structured',
      finding_summary: `TDLR Disciplinary (TX): ${items.length} search hits via ${provider.name} but no strict-name + sanction-keyword matches for "${name}"`,
      extracted_facts: {
        ag_state: 'TX',
        results_checked: items.length,
        citation_url: result.citationUrl,
        search_provider: provider.name,
      },
      query_sent: result.citationUrl,
      response_sha256: result.rawResponseSha256,
      response_snippet: result.rawResponseSnippet,
      duration_ms: Date.now() - start,
      cost_cents: result.cost_cents,
    };
  }

  return evidence;
}
