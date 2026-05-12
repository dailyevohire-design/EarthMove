import 'server-only';
import { createHash } from 'node:crypto';
import {
  ScraperAuthError,
  ScraperRateLimitError,
  ScraperTimeoutError,
  ScraperUpstreamError,
} from '../types';
import type { SearchProvider, SearchProviderResult, SearchResult } from './index';

const SERPER_ENDPOINT = 'https://google.serper.dev/search';
const SERPER_TIMEOUT_MS = 8_000;
const SNIPPET_DB_CAP = 4_096;

// Source attribution for error throwing. Errors propagate to persist-evidence
// which re-attributes to the calling scraper's source_key — this constant is
// only what appears on the in-flight ScraperError.source_key field.
const PROVIDER_SOURCE_KEY = 'search_provider:serper';

export class SerperProvider implements SearchProvider {
  readonly name = 'serper' as const;

  async search(
    query: string,
    opts: { numResults: number },
  ): Promise<SearchProviderResult> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new ScraperAuthError('SERPER_API_KEY not set', PROVIDER_SOURCE_KEY);
    }

    // citationUrl is safe to persist: no API key, no Serper-specific URL.
    // Mirrors what a human would paste into Google to reproduce the query.
    const citationUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    let res: Response;
    try {
      res = await fetch(SERPER_ENDPOINT, {
        method: 'POST',
        signal: AbortSignal.timeout(SERPER_TIMEOUT_MS),
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ q: query, num: opts.numResults }),
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ScraperTimeoutError(
          `Serper timeout after ${SERPER_TIMEOUT_MS}ms`,
          PROVIDER_SOURCE_KEY,
        );
      }
      throw new ScraperUpstreamError(
        `Serper network error: ${err instanceof Error ? err.message : 'unknown'}`,
        PROVIDER_SOURCE_KEY,
        0,
      );
    }

    const rawText = await res.text();
    const rawResponseSha256 = createHash('sha256').update(rawText).digest('hex');
    const rawResponseSnippet = rawText.slice(0, SNIPPET_DB_CAP);

    if (res.status === 401 || res.status === 403) {
      throw new ScraperAuthError(
        `Serper auth failure (HTTP ${res.status})`,
        PROVIDER_SOURCE_KEY,
      );
    }
    if (res.status === 429) {
      const ra = res.headers.get('retry-after');
      throw new ScraperRateLimitError(
        'Serper quota exhausted (HTTP 429)',
        PROVIDER_SOURCE_KEY,
        ra ? Number(ra) : null,
      );
    }
    if (!res.ok) {
      throw new ScraperUpstreamError(
        `Serper HTTP ${res.status}`,
        PROVIDER_SOURCE_KEY,
        res.status,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new ScraperUpstreamError(
        'Serper returned non-JSON body',
        PROVIDER_SOURCE_KEY,
        res.status,
      );
    }

    const items = parseSerperResults(parsed);

    // Serper pricing: free tier 2,500/month; paid ~$0.001/search (0.1¢).
    // Tracking at 0 — adjust to 1 when sustained paid-tier usage starts.
    return {
      items,
      rawResponseSha256,
      rawResponseSnippet,
      citationUrl,
      cost_cents: 0,
    };
  }
}

function parseSerperResults(raw: unknown): SearchResult[] {
  if (raw === null || typeof raw !== 'object') return [];
  const organic = (raw as { organic?: unknown }).organic;
  if (!Array.isArray(organic)) return [];
  const out: SearchResult[] = [];
  for (const it of organic) {
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
