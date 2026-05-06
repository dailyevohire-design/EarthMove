import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  type TrustFindingType,
  ScraperAuthError,
  ScraperRateLimitError,
  ScraperUpstreamError,
  ScraperTimeoutError,
} from './types';
import { RateLimiter, TtlCache } from './scraper-throttle';

const SOURCE_KEY = 'courtlistener_fed';
const SEARCH_ENDPOINT = 'https://www.courtlistener.com/api/rest/v4/search/';
const SITE_ROOT = 'https://www.courtlistener.com';
const DEFAULT_TIMEOUT_MS = 30_000;
// CourtListener v4 uses cursor-based pagination via env.next URL. The
// `page=N` query param is silently ignored; only env.next advances. We still
// request page_size=100 (capped server-side at ~20) in case quotas change.
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

// Federal civil Nature-of-Suit codes that matter for contractor trust:
//   190 — Other Contract
//   195 — Contract Product Liability
//   220 — Foreclosure (real-property lien actions)
//   240 — Torts to Land
//   290 — All Other Real Property Actions
//   365 — Personal Injury — Product Liability
//   422 — Bankruptcy Appeals (28 USC 158)
// Codes outside this set (employment, IP, antitrust, etc.) are filtered out
// — they're rarely fraud-predictive for a construction trust score.
const NOS_ALLOWLIST = new Set(['190', '195', '220', '240', '290', '365', '422']);
const NOS_FORECLOSURE = '220';

// CourtListener authenticated quota is 5000/hr per docs. 80/min = 4800/hr
// leaves narrow but safe headroom for retries + bursts.
const limiter = new RateLimiter({ name: SOURCE_KEY, maxPerMinute: 80 });
// 7-day TTL — federal docket data is high-latency (PACER ingest is slow,
// adversary proceedings stretch over months/years); same entity within a
// week returns cached array result without burning quota.
const cache = new TtlCache<ScraperEvidence[]>(1000, 7 * 24 * 60 * 60 * 1000);

/** Test-only: reset module-scope throttle + cache to fresh. */
export function _resetCourtListenerThrottle(): void {
  cache.clear();
  limiter.reset();
}

/**
 * Normalize a business name for STRICT party-name matching against
 * CourtListener's `party` array entries. Mirrors osha-score.ts's stripper:
 * lowercase, drop punctuation, strip ALL legal-suffix occurrences, collapse
 * whitespace. Distinct from ../normalize/business-name.ts which strips only
 * one trailing suffix and is used as a contractors-table dedupe key.
 *
 * Used here to filter case results client-side: only cases whose party list
 * contains an exact normalized match for the queried entity should count.
 */
const LEGAL_SUFFIX_RE = /\b(l\.?l\.?c\.?|inc\.?|incorporated|corp\.?|corporation|co\.?|company|ltd\.?|limited|lp|llp|pllc|pc)\b/g;
function normalizePartyName(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase()
    .replace(/[.,'"`]/g, '')
    .replace(LEGAL_SUFFIX_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface CourtListenerInput {
  legalName: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface CourtListenerSearchResult {
  caseName?: string;
  case_name_full?: string;
  court?: string;
  court_id?: string;
  dateFiled?: string;
  dateTerminated?: string | null;
  docketNumber?: string;
  docket_id?: number;
  docket_absolute_url?: string;
  cause?: string;
  chapter?: string | null;
  jurisdictionType?: string;
  // CourtListener v4 RECAP returns the NOS in `suitNature` (e.g.
  // "442 Civil Rights: Employment"). Some older endpoints/docs reference
  // `nature_of_suit`; we read both with suitNature preferred.
  suitNature?: string;
  nature_of_suit?: string;
  party?: string[];
  pacer_case_id?: string | null;
}

interface CourtListenerSearchEnvelope {
  count: number;
  results: CourtListenerSearchResult[];
  next?: string | null;
  previous?: string | null;
}

type Role = 'plaintiff' | 'defendant' | 'debtor' | 'ambiguous';

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Extract the 3-digit NOS code if present anywhere in the field value. */
function nosCode(field: string | undefined): string | undefined {
  if (!field) return undefined;
  return field.match(/\b(\d{3})\b/)?.[1];
}

/**
 * Determine the entity's role in a case by parsing caseName + chapter +
 * party list. Conservative: returns 'ambiguous' (skip) for anything
 * not clearly defendant or debtor.
 */
function determineRole(
  result: CourtListenerSearchResult,
  normEntity: string,
): Role {
  const name = (result.caseName ?? result.case_name_full ?? '').toLowerCase();
  const isBankruptcyCase = result.chapter != null;

  // Bankruptcy debtor: caseName starts with the entity (or "In re <entity>").
  if (isBankruptcyCase) {
    const stripped = name.replace(/^in re\s+/i, '');
    const startMatch = normalizePartyName(stripped.split(/\s+v\.?\s+/)[0]);
    if (startMatch.includes(normEntity) || normEntity.includes(startMatch)) {
      return 'debtor';
    }
    // Entity is not the debtor — they're a creditor or party-in-interest,
    // which isn't a fraud signal for them.
    return 'ambiguous';
  }

  // Civil case: split on " v. " or " vs. ". Plaintiff is left, defendant right.
  const sides = name.split(/\s+v(?:s)?\.\s+/);
  if (sides.length < 2) {
    // Single-party caption (rare in civil) — can't determine role.
    return 'ambiguous';
  }
  const plaintiffSide = normalizePartyName(sides[0]);
  const defendantSide = normalizePartyName(sides.slice(1).join(' v. '));

  // Strict role assignment: entity must appear on exactly one side.
  const onPlaintiff = plaintiffSide.includes(normEntity);
  const onDefendant = defendantSide.includes(normEntity);

  if (onDefendant && !onPlaintiff) return 'defendant';
  if (onPlaintiff && !onDefendant) return 'plaintiff';
  return 'ambiguous';
}

/** True iff entity exactly appears in the result's `party` array. */
function partyListMatches(parties: string[] | undefined, normEntity: string): boolean {
  if (!Array.isArray(parties) || parties.length === 0) return false;
  return parties.some((p) => normalizePartyName(p) === normEntity);
}

async function fetchUrl(
  apiKey: string,
  url: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<CourtListenerSearchEnvelope> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener('abort', () => controller.abort());

  let resp: Response;
  try {
    resp = await fetchFn(url, {
      method: 'GET',
      headers: { Authorization: `Token ${apiKey}`, Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new ScraperTimeoutError(`CourtListener timeout after ${timeoutMs}ms`, SOURCE_KEY);
    }
    throw new ScraperUpstreamError(`CourtListener network error: ${err?.message ?? err}`, SOURCE_KEY, 0);
  }
  clearTimeout(timeoutId);

  if (resp.status === 401 || resp.status === 403) {
    throw new ScraperAuthError(`CourtListener ${resp.status}`, SOURCE_KEY);
  }
  if (resp.status === 429) {
    const ra = resp.headers.get('retry-after');
    throw new ScraperRateLimitError('CourtListener rate limited', SOURCE_KEY, ra ? Number(ra) : null);
  }
  if (resp.status >= 500 || !resp.ok) {
    throw new ScraperUpstreamError(`CourtListener ${resp.status}`, SOURCE_KEY, resp.status);
  }

  const rawText = await resp.text();
  try {
    return JSON.parse(rawText) as CourtListenerSearchEnvelope;
  } catch {
    throw new ScraperUpstreamError('CourtListener non-JSON response', SOURCE_KEY, resp.status);
  }
}

function buildEvidence(args: {
  finding_type: TrustFindingType;
  result: CourtListenerSearchResult;
  role: Role;
  legalName: string;
  query: string;
  rawSnippet: string;
  start: number;
  resultIndex: number;
}): ScraperEvidence {
  const { finding_type, result, role, legalName, query, rawSnippet, start, resultIndex } = args;
  const docketUrl = result.docket_absolute_url
    ? `${SITE_ROOT}${result.docket_absolute_url}`
    : null;
  const summary = (() => {
    const caseName = result.caseName ?? result.case_name_full ?? '(no caption)';
    const court = result.court_id ?? result.court ?? 'federal court';
    const filed = result.dateFiled ?? '?';
    if (finding_type === 'business_dissolved') {
      return `CourtListener: "${legalName}" filed bankruptcy (Ch ${result.chapter}) — ${caseName} [${court}, ${filed}]`;
    }
    if (finding_type === 'mechanic_lien_filed') {
      return `CourtListener: "${legalName}" named in foreclosure/lien action (NOS 220) — ${caseName} [${court}, ${filed}]`;
    }
    const nos = nosCode(result.suitNature ?? result.nature_of_suit) ?? '?';
    return `CourtListener: "${legalName}" named as ${role} — ${caseName} [${court}, ${filed}, NOS ${nos}]`;
  })();

  return {
    source_key: SOURCE_KEY,
    finding_type,
    confidence: 'verified_structured',
    finding_summary: summary,
    extracted_facts: {
      caseName: result.caseName ?? null,
      caseNameFull: result.case_name_full ?? null,
      court: result.court_id ?? result.court ?? null,
      docketNumber: result.docketNumber ?? null,
      docket_id: result.docket_id ?? null,
      dateFiled: result.dateFiled ?? null,
      dateTerminated: result.dateTerminated ?? null,
      cause: result.cause ?? null,
      chapter: result.chapter ?? null,
      nature_of_suit: result.suitNature ?? result.nature_of_suit ?? null,
      nos_code: nosCode(result.suitNature ?? result.nature_of_suit) ?? null,
      jurisdictionType: result.jurisdictionType ?? null,
      role,
      query,
      docket_url: docketUrl,
      citation_url: docketUrl,
      result_index: resultIndex,
    },
    query_sent: query,
    response_sha256: rawSnippet ? sha256Hex(rawSnippet) : null,
    response_snippet: rawSnippet.slice(0, 1500),
    duration_ms: Date.now() - start,
    cost_cents: 0,
  };
}

export async function scrapeCourtListenerFed(input: CourtListenerInput): Promise<ScraperEvidence[]> {
  if (!input.legalName?.trim()) {
    throw new Error('scrapeCourtListenerFed: legalName required');
  }

  const normEntity = normalizePartyName(input.legalName);
  const cached = cache.get(normEntity);
  if (cached) {
    return cached.map((ev) => ({
      ...ev,
      extracted_facts: { ...ev.extracted_facts, cache_hit: true },
      duration_ms: 0,
    }));
  }

  await limiter.acquire();

  const apiKey = input.apiKey ?? process.env.COURTLISTENER_API_TOKEN;
  if (!apiKey) {
    throw new ScraperAuthError('COURTLISTENER_API_TOKEN not set', SOURCE_KEY);
  }

  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();

  // Phrase-quoted query keeps the raw-result set tractable (unquoted matches
  // any filing containing any token from the name and explodes for common
  // words like "Toll" or "Brothers"). Strict party-list filter still applies
  // client-side; phrase-quoted is a coarse pre-filter, not a final one.
  const query = `"${input.legalName.trim()}"`;
  const queryRedacted = `${SEARCH_ENDPOINT}?type=r&q=${encodeURIComponent(query)}&page_size=${PAGE_SIZE}`;

  // Cursor-paginate via env.next; dedup by docket_id (CL sometimes emits the
  // same docket across pages when relevance scores tie).
  const initialUrl = (() => {
    const u = new URL(SEARCH_ENDPOINT);
    u.searchParams.set('type', 'r');
    u.searchParams.set('q', query);
    u.searchParams.set('page_size', String(PAGE_SIZE));
    return u.toString();
  })();

  const allResults: CourtListenerSearchResult[] = [];
  const seenDocketIds = new Set<number>();
  let totalRawCount = 0;
  let lastPageRawText = '';
  let nextUrl: string | null = initialUrl;
  for (let page = 1; page <= MAX_PAGES && nextUrl; page++) {
    const env = await fetchUrl(apiKey, nextUrl, fetchFn, timeoutMs, input.signal);
    if (page === 1) totalRawCount = typeof env?.count === 'number' ? env.count : 0;
    const pageResults = Array.isArray(env?.results) ? env.results : [];
    const newOnes = pageResults.filter((r) => {
      if (typeof r.docket_id !== 'number') return true;
      if (seenDocketIds.has(r.docket_id)) return false;
      seenDocketIds.add(r.docket_id);
      return true;
    });
    allResults.push(...newOnes);
    lastPageRawText = JSON.stringify(env);
    if (!env.next) break;
    if (newOnes.length === 0) break;  // dup-only page → stop
    nextUrl = env.next;
  }

  // Filter pipeline:
  //   1. Party-list strict match (skip false-positive token hits).
  //   2. Role-aware: defendant or debtor only (skip plaintiff/ambiguous).
  //   3. NOS allowlist (skip employment/IP/antitrust/etc.).
  let nPartyMismatch = 0;
  let nPlaintiffOrAmbiguous = 0;
  let nNosOutOfAllowlist = 0;
  const evidence: ScraperEvidence[] = [];

  for (let i = 0; i < allResults.length; i++) {
    const result = allResults[i];

    if (!partyListMatches(result.party, normEntity)) {
      nPartyMismatch++;
      continue;
    }

    const role = determineRole(result, normEntity);
    if (role === 'plaintiff' || role === 'ambiguous') {
      nPlaintiffOrAmbiguous++;
      continue;
    }

    // Bankruptcy debtor → business_dissolved (regardless of NOS, which is
    // typically null/empty for bankruptcy cases).
    if (role === 'debtor') {
      evidence.push(buildEvidence({
        finding_type: 'business_dissolved',
        result,
        role,
        legalName: input.legalName,
        query: queryRedacted,
        rawSnippet: lastPageRawText,
        start,
        resultIndex: i,
      }));
      continue;
    }

    // Defendant → check NOS allowlist.
    const code = nosCode(result.suitNature ?? result.nature_of_suit);
    if (!code || !NOS_ALLOWLIST.has(code)) {
      nNosOutOfAllowlist++;
      continue;
    }

    evidence.push(buildEvidence({
      finding_type: code === NOS_FORECLOSURE ? 'mechanic_lien_filed' : 'legal_action_found',
      result,
      role,
      legalName: input.legalName,
      query: queryRedacted,
      rawSnippet: lastPageRawText,
      start,
      resultIndex: i,
    }));
  }

  // Zero matches after all three filters → emit single legal_no_actions row,
  // documenting the filtering for debug.
  if (evidence.length === 0) {
    const ev: ScraperEvidence = {
      source_key: SOURCE_KEY,
      finding_type: 'legal_no_actions',
      confidence: 'verified_structured',
      finding_summary:
        `CourtListener: no qualifying federal civil/bankruptcy actions found for "${input.legalName}" ` +
        `(scanned ${allResults.length} of ${totalRawCount} raw hits; ` +
        `${nPartyMismatch} dropped on party-name match, ` +
        `${nPlaintiffOrAmbiguous} on plaintiff/ambiguous role, ` +
        `${nNosOutOfAllowlist} on NOS-allowlist filter)`,
      extracted_facts: {
        totalRawCount,
        scannedCount: allResults.length,
        droppedPartyMismatch: nPartyMismatch,
        droppedPlaintiffOrAmbiguous: nPlaintiffOrAmbiguous,
        droppedNosOutOfAllowlist: nNosOutOfAllowlist,
        emittedCount: 0,
        query: input.legalName,
        scope: 'recap_federal',
        nos_allowlist: Array.from(NOS_ALLOWLIST),
      },
      query_sent: queryRedacted,
      response_sha256: lastPageRawText ? sha256Hex(lastPageRawText) : null,
      response_snippet: lastPageRawText.slice(0, 1500),
      duration_ms: Date.now() - start,
      cost_cents: 0,
    };
    cache.set(normEntity, [ev]);
    return [ev];
  }

  cache.set(normEntity, evidence);
  return evidence;
}
