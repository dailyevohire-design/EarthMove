import 'server-only';
import { SerperProvider } from './serper';
import { GcseProvider } from './gcse';

/**
 * Search provider abstraction for scrapers that need a Google-style web search
 * (currently tdlr_disciplinary; designed to fit future *_disciplinary scrapers
 * that pivot around unscriptable agency search forms).
 *
 * Default provider is Serper (paid, auth via single API key, no GCP project
 * coupling). GCSE remains supported for free-tier (100/day) use.
 *
 * Provider is chosen via SEARCH_PROVIDER env var. Both providers throw the
 * same ScraperError subclasses, so callers don't branch on provider name —
 * they just call provider.search() and handle errors uniformly.
 */

export interface SearchResult {
  link: string;
  title: string;
  snippet: string;
}

export interface SearchProviderResult {
  items: SearchResult[];
  rawResponseSha256: string;
  rawResponseSnippet: string;
  /** Public-facing URL safe to persist as query_sent / citation_url.
   *  Never contains API keys. */
  citationUrl: string;
  cost_cents: number;
}

export interface SearchProvider {
  readonly name: 'serper' | 'gcse';
  search(query: string, opts: { numResults: number }): Promise<SearchProviderResult>;
  // Implementations throw:
  //   ScraperAuthError on missing env or auth-class failure (401/403/forbidden)
  //   ScraperRateLimitError on 429 (or 403 with rate-limit reason for GCSE)
  //   ScraperTimeoutError on AbortError
  //   ScraperUpstreamError on other non-OK status / network / JSON parse errors
}

export function getSearchProvider(): SearchProvider {
  const provider = process.env.SEARCH_PROVIDER ?? 'serper';
  if (provider === 'serper') return new SerperProvider();
  if (provider === 'gcse') return new GcseProvider();
  throw new Error(`Unknown SEARCH_PROVIDER: ${provider}`);
}
