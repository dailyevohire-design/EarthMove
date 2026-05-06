import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import {
  type ScraperEvidence,
  type TrustFindingType,
  type TrustConfidence,
  ScraperRateLimitError,
  ScraperUpstreamError,
  ScraperTimeoutError,
} from './types';
import { TtlCache } from './scraper-throttle';

const SOURCE_KEY = 'state_ag_enforcement';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_EMIT = 20;
const TX_BASE = 'https://www.texasattorneygeneral.gov';

// Browser-y UA so the WordPress / Drupal portals don't gate us as a bot.
const UA = 'Mozilla/5.0 (compatible; Groundcheck/1.0; +https://earthmove.io/trust)';

// 7-day TTL — AG press releases are immutable once published; refresh weekly.
const cache = new TtlCache<ScraperEvidence[]>(1000, 7 * 24 * 60 * 60 * 1000);

const CO_URL = (q: string) => `https://coag.gov/?s=${encodeURIComponent(q)}`;
// TX AG news search lives at /news with the search_api_fulltext query param;
// /news/search returns 404. Discovered via probe 2026-05-06.
const TX_URL = (q: string) => `${TX_BASE}/news?search_api_fulltext=${encodeURIComponent(q)}`;

/** Test-only: reset module-scope cache. */
export function _resetStateAgThrottle(): void {
  cache.clear();
}

export interface StateAgEnforcementInput {
  legalName: string;
  stateCode: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface ParsedResult {
  headline: string;
  url: string;
  date: string | null;
  /** First 500 chars of the result's HTML block — preserved for evidence_payload. */
  excerpt: string;
  /** Plain-text body/excerpt content from the result, used for strict-name match
   *  when the entity name appears only in the body and not the headline. */
  body_text: string;
}

/**
 * Strict normalize for name matching. Differs from ../normalize/business-name.ts
 * (which strips ONE trailing suffix) — this one strips ALL suffix occurrences,
 * lowercases, and removes punctuation. Same shape as the osha-score.ts /
 * courtlistener-fed.ts normalizer, kept inline rather than extracted to avoid
 * cross-scraper coupling at this stage.
 */
const LEGAL_SUFFIX_RE = /\b(llc|inc|corp|corporation|incorporated|company|co|ltd|lp|pllc|pa)\b\.?/g;
function normalize(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[.,'"`]/g, '')
    .replace(LEGAL_SUFFIX_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strict word-boundary substring match against any of a list of candidate
 * strings. The normalized entity name must appear with non-alphanumeric
 * characters (or string boundaries) on both sides in at least one candidate.
 *
 * Used to check the result's headline AND excerpt/body — WordPress / Drupal
 * search engines return matches by body content, but the entity name often
 * doesn't appear in the headline (e.g., "Morgan County contractor charged"
 * → body names "Plains Building Systems, LLC"). Headline-only check
 * produces false negatives in that pattern.
 */
function strictNameMatchAny(candidates: Array<string | null | undefined>, name: string): boolean {
  const normName = normalize(name);
  if (normName.length === 0) return false;
  const isAlnum = (c: string) => /[a-z0-9]/.test(c);
  for (const c of candidates) {
    if (!c) continue;
    const normC = normalize(c);
    const idx = normC.indexOf(normName);
    if (idx < 0) continue;
    const before = idx === 0 ? '' : normC[idx - 1];
    const after = idx + normName.length >= normC.length ? '' : normC[idx + normName.length];
    if (!isAlnum(before) && !isAlnum(after)) return true;
  }
  return false;
}

interface Classification {
  finding_type: TrustFindingType;
  confidence: TrustConfidence;
  classified_action: 'judgment' | 'lawsuit' | 'settlement' | 'cease_desist' | 'unclassified';
}

const ACTION_PATTERNS: Array<{ re: RegExp; classification: Classification }> = [
  { re: /\b(judgment|verdict|orders?\s+to\s+pay|consent\s+decree|court\s+rules?)\b/i,
    classification: { finding_type: 'legal_judgment_against', confidence: 'high_llm', classified_action: 'judgment' } },
  { re: /\b(sues|files?\s+(lawsuit|suit|charges)|indicts?)\b/i,
    classification: { finding_type: 'legal_action_found', confidence: 'high_llm', classified_action: 'lawsuit' } },
  { re: /\b(settles?|settlement|agrees?\s+to\s+pay|reaches?\s+agreement)\b/i,
    classification: { finding_type: 'legal_action_found', confidence: 'high_llm', classified_action: 'settlement' } },
  { re: /\b(cease\s+and\s+desist|c&d|enjoins?)\b/i,
    classification: { finding_type: 'legal_action_found', confidence: 'high_llm', classified_action: 'cease_desist' } },
];

function classify(headline: string): Classification {
  for (const p of ACTION_PATTERNS) {
    if (p.re.test(headline)) return p.classification;
  }
  // Name matched but no keyword — emit anyway with lower confidence.
  return { finding_type: 'legal_action_found', confidence: 'medium_llm', classified_action: 'unclassified' };
}

function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const t = Date.parse(trimmed);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function parseCoResults($: cheerio.CheerioAPI): ParsedResult[] {
  // WordPress search page — selector chain in case of theme variation.
  const selectors = ['article.post', 'article[class*="post"]', '.search-result'];
  for (const sel of selectors) {
    const items = $(sel);
    if (items.length === 0) continue;
    const parsed: ParsedResult[] = [];
    items.each((_, el) => {
      const $el = $(el);
      const $anchor = $el.find('h2 a, .entry-title a, h3 a').first();
      const headline = $anchor.text().trim();
      const url = ($anchor.attr('href') ?? '').trim();
      const dateRaw =
        $el.find('time[datetime]').attr('datetime')
        ?? $el.find('.entry-date').first().text().trim()
        ?? $el.find('.post-date').first().text().trim();
      const date = parseDate(dateRaw);
      const excerpt = ($.html(el) ?? '').slice(0, 500);
      const body_text = $el.find('.entry-content, .entry-summary, .post-excerpt, p').first().text().trim()
        || $el.text().replace(headline, '').trim().slice(0, 1000);
      if (headline && url) parsed.push({ headline, url, date, excerpt, body_text });
    });
    if (parsed.length > 0) return parsed;
  }
  return [];
}

function parseTxResults($: cheerio.CheerioAPI): ParsedResult[] {
  // Drupal Views — selector chain in case of view-template variation.
  const selectors = ['.views-row', '.search-result', 'article'];
  for (const sel of selectors) {
    const items = $(sel);
    if (items.length === 0) continue;
    const parsed: ParsedResult[] = [];
    items.each((_, el) => {
      const $el = $(el);
      const $anchor = $el.find('.field--name-title a, h3 a, h2 a').first();
      const headline = $anchor.text().trim();
      let url = ($anchor.attr('href') ?? '').trim();
      if (url && url.startsWith('/')) url = TX_BASE + url;
      const dateRaw =
        $el.find('.field--name-created').first().text().trim()
        ?? $el.find('time').attr('datetime')
        ?? $el.find('.date-display-single').first().text().trim();
      const date = parseDate(dateRaw);
      const excerpt = ($.html(el) ?? '').slice(0, 500);
      const body_text = $el.find('.field--name-body, .views-field-body, .field--name-field-summary, p').first().text().trim()
        || $el.text().replace(headline, '').trim().slice(0, 1000);
      if (headline && url) parsed.push({ headline, url, date, excerpt, body_text });
    });
    if (parsed.length > 0) return parsed;
  }
  return [];
}

async function fetchWithRetry(
  url: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<{ rawText: string; status: number }> {
  let lastErr: unknown = null;
  // 4 attempts: 0s, 1s, 2s, 4s backoff (per spec: 1/2/4 between attempts)
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) signal.addEventListener('abort', () => controller.abort());
    let resp: Response;
    try {
      resp = await fetchFn(url, {
        method: 'GET',
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ScraperTimeoutError(`State AG timeout after ${timeoutMs}ms (${url})`, SOURCE_KEY);
      }
      lastErr = err;
      if (attempt === 3) {
        throw new ScraperUpstreamError(
          `State AG network error: ${err instanceof Error ? err.message : String(err)}`,
          SOURCE_KEY, 0,
        );
      }
      continue;
    }
    clearTimeout(timeoutId);
    if (resp.ok) {
      const rawText = await resp.text();
      return { rawText, status: resp.status };
    }
    if (resp.status === 429) {
      if (attempt === 3) {
        const ra = resp.headers.get('retry-after');
        throw new ScraperRateLimitError('State AG rate limited', SOURCE_KEY, ra ? Number(ra) : null);
      }
      continue;
    }
    if (resp.status >= 500) {
      if (attempt === 3) throw new ScraperUpstreamError(`State AG ${resp.status}`, SOURCE_KEY, resp.status);
      continue;
    }
    // Other 4xx — don't retry
    throw new ScraperUpstreamError(`State AG ${resp.status}`, SOURCE_KEY, resp.status);
  }
  throw new ScraperUpstreamError(
    `State AG retries exhausted${lastErr instanceof Error ? `: ${lastErr.message}` : ''}`,
    SOURCE_KEY, 0,
  );
}

export async function scrapeStateAgEnforcement(input: StateAgEnforcementInput): Promise<ScraperEvidence[]> {
  if (!input.legalName?.trim()) {
    throw new Error('scrapeStateAgEnforcement: legalName required');
  }
  const state = (input.stateCode ?? '').toUpperCase();

  // 1. State gate — only CO + TX have AG-portal scrapers in this scraper.
  if (state !== 'CO' && state !== 'TX') {
    return [{
      source_key: SOURCE_KEY,
      finding_type: 'source_not_applicable',
      confidence: 'verified_structured',
      finding_summary: `State AG enforcement not applicable for state ${state || '(none)'} — CO + TX only`,
      extracted_facts: { ag_state: state, reason: 'out_of_scope' },
      query_sent: null,
      response_sha256: null,
      response_snippet: null,
      duration_ms: 0,
      cost_cents: 0,
    }];
  }

  // 2. Cache key per (state, normalized name).
  const ck = `state_ag:${state}:${normalize(input.legalName)}`;
  const cached = cache.get(ck);
  if (cached) {
    return cached.map((ev) => ({
      ...ev,
      extracted_facts: { ...ev.extracted_facts, cache_hit: true },
      duration_ms: 0,
    }));
  }

  // 3. Fetch the state's search page.
  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = state === 'CO' ? CO_URL(input.legalName) : TX_URL(input.legalName);
  const start = Date.now();

  const { rawText } = await fetchWithRetry(url, fetchFn, timeoutMs, input.signal);
  const sha = createHash('sha256').update(rawText).digest('hex');

  // 4. Parse + filter (two-pass).
  const $ = cheerio.load(rawText);
  const allResults = state === 'CO' ? parseCoResults($) : parseTxResults($);

  // Pass 1: strict-match on headline + search-result excerpt.
  const matched: ParsedResult[] = [];
  const unmatched: ParsedResult[] = [];
  for (const r of allResults) {
    if (strictNameMatchAny([r.headline, r.body_text], input.legalName)) {
      matched.push(r);
    } else {
      unmatched.push(r);
    }
  }

  // Pass 2: AG press-release headlines often elide the entity name (e.g.
  // "Morgan County contractor charged" while the body names "Plains Building
  // Systems, LLC"). For up to DESTINATION_FETCH_CAP unmatched results, fetch
  // the destination article and strict-match the article body. Hard cap
  // prevents runaway when search returns many false-positive hits.
  const DESTINATION_FETCH_CAP = 5;
  let destinationFetches = 0;
  for (const r of unmatched) {
    if (destinationFetches >= DESTINATION_FETCH_CAP) break;
    if (matched.length + (unmatched.length - destinationFetches) <= MAX_EMIT && matched.length >= MAX_EMIT) break;
    try {
      const { rawText: articleHtml } = await fetchWithRetry(r.url, fetchFn, timeoutMs, input.signal);
      destinationFetches++;
      const $article = cheerio.load(articleHtml);
      const articleBody = $article('article, .entry-content, main').first().text() || $article('body').text();
      if (strictNameMatchAny([articleBody], input.legalName)) {
        matched.push(r);
      }
    } catch {
      // Network/timeout/upstream errors on destination pages are non-fatal —
      // the search-results page is the primary signal source. Skip.
      destinationFetches++;
    }
  }

  // 5. Sort by date desc (null dates last) and cap at MAX_EMIT.
  matched.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
  const capped = matched.slice(0, MAX_EMIT);

  // 6. Zero matches → single legal_no_actions evidence row.
  if (capped.length === 0) {
    const ev: ScraperEvidence = {
      source_key: SOURCE_KEY,
      finding_type: 'legal_no_actions',
      confidence: 'verified_structured',
      finding_summary:
        `State AG (${state}): no enforcement actions found for "${input.legalName}" ` +
        `(${allResults.length} raw results checked, 0 strict-name matches)`,
      extracted_facts: {
        ag_state: state,
        search_url: url,
        results_checked: allResults.length,
        citation_url: url,
      },
      query_sent: url,
      response_sha256: sha,
      response_snippet: rawText.slice(0, 1500),
      duration_ms: Date.now() - start,
      cost_cents: 0,
    };
    cache.set(ck, [ev]);
    return [ev];
  }

  // 7. Emit one evidence row per capped match.
  const evidence: ScraperEvidence[] = capped.map((r) => {
    const cls = classify(r.headline);
    return {
      source_key: SOURCE_KEY,
      finding_type: cls.finding_type,
      confidence: cls.confidence,
      finding_summary: `State AG (${state}, ${cls.classified_action}): "${input.legalName}" — ${r.headline}`,
      extracted_facts: {
        ag_state: state,
        headline: r.headline,
        action_date: r.date,
        url: r.url,
        classified_action: cls.classified_action,
        citation_url: r.url,
        source_response_excerpt: r.excerpt,
      },
      query_sent: url,
      response_sha256: sha,
      response_snippet: rawText.slice(0, 1500),
      duration_ms: Date.now() - start,
      cost_cents: 0,
    };
  });

  cache.set(ck, evidence);
  return evidence;
}
