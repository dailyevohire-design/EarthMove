import 'server-only';
import { createHash } from 'node:crypto';
import {
  ScraperAuthError,
  ScraperRateLimitError,
  ScraperTimeoutError,
  ScraperUpstreamError,
} from '../types';
import type { SearchProvider, SearchProviderResult, SearchResult } from './index';

const GCSE_ENDPOINT = 'https://customsearch.googleapis.com/customsearch/v1';
const GCSE_TIMEOUT_MS = 8_000;
const SNIPPET_DB_CAP = 4_096;

const PROVIDER_SOURCE_KEY = 'search_provider:gcse';

export class GcseProvider implements SearchProvider {
  readonly name = 'gcse' as const;

  async search(
    query: string,
    opts: { numResults: number },
  ): Promise<SearchProviderResult> {
    const cseId = process.env.GOOGLE_CSE_ID;
    const apiKey = process.env.GOOGLE_CSE_API_KEY;
    if (!cseId || !apiKey) {
      throw new ScraperAuthError(
        'GOOGLE_CSE_ID or GOOGLE_CSE_API_KEY not set',
        PROVIDER_SOURCE_KEY,
      );
    }

    const params = new URLSearchParams({
      key: apiKey,
      cx: cseId,
      q: query,
      num: String(opts.numResults),
    });
    const requestUrl = `${GCSE_ENDPOINT}?${params.toString()}`;
    // citationUrl omits the API key — never persist requestUrl.
    const citationUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    let res: Response;
    try {
      res = await fetch(requestUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(GCSE_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ScraperTimeoutError(
          `GCSE timeout after ${GCSE_TIMEOUT_MS}ms`,
          PROVIDER_SOURCE_KEY,
        );
      }
      throw new ScraperUpstreamError(
        `GCSE network error: ${err instanceof Error ? err.message : 'unknown'}`,
        PROVIDER_SOURCE_KEY,
        0,
      );
    }

    const rawText = await res.text();
    const rawResponseSha256 = createHash('sha256').update(rawText).digest('hex');
    const rawResponseSnippet = rawText.slice(0, SNIPPET_DB_CAP);

    if (res.status === 429) {
      const ra = res.headers.get('retry-after');
      throw new ScraperRateLimitError(
        'GCSE quota exhausted (HTTP 429)',
        PROVIDER_SOURCE_KEY,
        ra ? Number(ra) : null,
      );
    }

    // 403 has TWO distinct meanings on GCSE — distinguish them by reason:
    //   reason=dailyLimitExceeded / rateLimitExceeded → quota; retry-after-window
    //   reason=forbidden / accessNotConfigured        → config; needs human fix
    // The old scraper conflated both into ScraperRateLimitError, mislabeling
    // "API not enabled" / "project blocked" as "quota exhausted" in evidence.
    if (res.status === 403) {
      let reason: string | null = null;
      try {
        const parsedErr = JSON.parse(rawText) as {
          error?: { errors?: Array<{ reason?: string }> };
        };
        reason = parsedErr?.error?.errors?.[0]?.reason ?? null;
      } catch {
        /* leave reason null */
      }
      if (reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded') {
        throw new ScraperRateLimitError(
          `GCSE quota exhausted (HTTP 403 reason=${reason})`,
          PROVIDER_SOURCE_KEY,
          null,
        );
      }
      throw new ScraperAuthError(
        `GCSE forbidden (HTTP 403 reason=${reason ?? 'unknown'})`,
        PROVIDER_SOURCE_KEY,
      );
    }

    if (!res.ok) {
      throw new ScraperUpstreamError(
        `GCSE HTTP ${res.status}`,
        PROVIDER_SOURCE_KEY,
        res.status,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new ScraperUpstreamError(
        'GCSE returned non-JSON body',
        PROVIDER_SOURCE_KEY,
        res.status,
      );
    }

    const items = parseGcseItems(parsed);

    // GCSE pricing: free 100/day, paid $5/1000 queries beyond. 0¢ on free tier.
    return {
      items,
      rawResponseSha256,
      rawResponseSnippet,
      citationUrl,
      cost_cents: 0,
    };
  }
}

function parseGcseItems(raw: unknown): SearchResult[] {
  if (raw === null || typeof raw !== 'object') return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: SearchResult[] = [];
  for (const it of items) {
    if (it === null || typeof it !== 'object') continue;
    const r = it as Record<string, unknown>;
    if (
      typeof r.link === 'string' &&
      typeof r.title === 'string' &&
      typeof r.snippet === 'string'
    ) {
      out.push({ link: r.link, title: r.title, snippet: r.snippet });
    }
  }
  return out;
}
