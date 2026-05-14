/**
 * Google Places API trust scraper.
 *
 * Maps contractor legalName + city + stateCode → Google Places result →
 * open_web_* evidence. Single Text Search call per scrape (~1.7¢).
 *
 * Vocab mapping (existing TrustFindingType, no DB migration):
 *   - no place match                                  → source_not_applicable
 *   - place found, no rating fields                   → source_not_applicable
 *   - rating < 3.0 AND userRatingCount >= 5           → open_web_adverse_signal
 *   - rating >= 3.0 AND userRatingCount >= 10         → open_web_verified
 *   - otherwise (sparse or middling)                  → open_web_unverified
 *
 * Confidence: verified_structured when userRatingCount >= 10, else low_inference.
 *
 * Env: GOOGLE_MAPS_API_KEY (required) — throws ScraperAuthError if missing.
 */

import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  ScraperAuthError,
  ScraperRateLimitError,
  ScraperTimeoutError,
  ScraperUpstreamError,
} from './types';

const SOURCE_KEY = 'google_reviews';
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const DEFAULT_TIMEOUT_MS = 10_000;
const TEXT_SEARCH_COST_CENTS = 1.7;
const MIN_API_KEY_LENGTH = 20;

const TEXT_SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.businessStatus',
].join(',');

export interface ScrapeGoogleReviewsInput {
  query_name: string;
  jurisdiction: string;
  city?: string | null;
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

interface PlacesTextSearchResponse {
  places?: PlaceResult[];
}

interface PlaceResult {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  businessStatus?: string;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export async function scrapeGoogleReviews(
  input: ScrapeGoogleReviewsInput,
): Promise<ScraperEvidence> {
  const apiKey = input.apiKey ?? process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey.length < MIN_API_KEY_LENGTH) {
    throw new ScraperAuthError(
      'GOOGLE_MAPS_API_KEY not set or too short to be valid',
      SOURCE_KEY,
    );
  }

  const queryParts: string[] = [input.query_name];
  if (input.city) queryParts.push(input.city);
  queryParts.push(input.jurisdiction);
  const textQuery = queryParts.filter(Boolean).join(' ');
  const querySent = `POST ${TEXT_SEARCH_URL} :: ${textQuery}`;

  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  let resp: Response;
  try {
    resp = await fetchFn(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': TEXT_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: 5,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new ScraperTimeoutError(
        `Google Places timeout after ${timeoutMs}ms`,
        SOURCE_KEY,
      );
    }
    throw new ScraperUpstreamError(
      `Google Places network error: ${err?.message ?? err}`,
      SOURCE_KEY,
      0,
    );
  }
  clearTimeout(timeoutId);

  if (resp.status === 401 || resp.status === 403) {
    const errBody = await resp.text().catch(() => '');
    throw new ScraperAuthError(
      `Google Places auth failed: HTTP ${resp.status} :: ${errBody.slice(0, 400)}`,
      SOURCE_KEY,
    );
  }
  if (resp.status === 429) {
    const ra = resp.headers.get('retry-after');
    throw new ScraperRateLimitError(
      'Google Places rate limited',
      SOURCE_KEY,
      ra ? Number(ra) : null,
    );
  }
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new ScraperUpstreamError(
      `Google Places HTTP ${resp.status} :: ${errBody.slice(0, 400)}`,
      SOURCE_KEY,
      resp.status,
    );
  }

  const rawText = await resp.text();
  let data: PlacesTextSearchResponse;
  try {
    data = JSON.parse(rawText) as PlacesTextSearchResponse;
  } catch {
    throw new ScraperUpstreamError(
      'Google Places non-JSON response',
      SOURCE_KEY,
      resp.status,
    );
  }

  const duration_ms = Date.now() - start;
  const response_sha256 = sha256Hex(rawText);
  const response_snippet = rawText.slice(0, 1500);
  const places = data.places ?? [];

  if (places.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'source_not_applicable',
      confidence: 'verified_structured',
      finding_summary: `Google Reviews: no place match for "${input.query_name}" in ${input.city ?? input.jurisdiction}`,
      extracted_facts: {
        query_name: input.query_name,
        query_text: textQuery,
        match_count: 0,
      },
      query_sent: querySent,
      response_sha256,
      response_snippet,
      duration_ms,
      cost_cents: TEXT_SEARCH_COST_CENTS,
    };
  }

  const top = places[0];

  if (
    typeof top.rating !== 'number' ||
    typeof top.userRatingCount !== 'number' ||
    !top.id
  ) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'source_not_applicable',
      confidence: 'verified_structured',
      finding_summary: `Google Reviews: place found but no review data for "${input.query_name}"`,
      extracted_facts: {
        query_name: input.query_name,
        query_text: textQuery,
        match_count: places.length,
        place_id: top.id ?? null,
        display_name: top.displayName?.text ?? null,
      },
      query_sent: querySent,
      response_sha256,
      response_snippet,
      duration_ms,
      cost_cents: TEXT_SEARCH_COST_CENTS,
    };
  }

  const reviewCount = top.userRatingCount;
  const rating = top.rating;
  const confidence: 'verified_structured' | 'low_inference' =
    reviewCount >= 10 ? 'verified_structured' : 'low_inference';

  let finding_type: 'open_web_adverse_signal' | 'open_web_verified' | 'open_web_unverified';
  if (rating < 3.0 && reviewCount >= 5) {
    finding_type = 'open_web_adverse_signal';
  } else if (rating >= 3.0 && reviewCount >= 10) {
    finding_type = 'open_web_verified';
  } else {
    finding_type = 'open_web_unverified';
  }

  return {
    source_key: SOURCE_KEY,
    finding_type,
    confidence,
    finding_summary: `Google Reviews: "${top.displayName?.text ?? input.query_name}" rated ${rating.toFixed(1)}/5 across ${reviewCount} review${reviewCount === 1 ? '' : 's'}`,
    extracted_facts: {
      place_id: top.id,
      display_name: top.displayName?.text ?? null,
      formatted_address: top.formattedAddress ?? null,
      rating,
      user_rating_count: reviewCount,
      types: top.types ?? [],
      business_status: top.businessStatus ?? null,
      query_name: input.query_name,
      query_text: textQuery,
      match_count: places.length,
    },
    query_sent: querySent,
    response_sha256,
    response_snippet,
    duration_ms,
    cost_cents: TEXT_SEARCH_COST_CENTS,
  };
}
