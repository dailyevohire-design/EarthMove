/**
 * Google Places API (v1) — Text Search wrapper for free-tier review enrichment.
 *
 * Uses Places API New v1 single Text Search call (rating + userRatingCount are
 * included in the FieldMask, billed at Pro SKU ≈ $0.032/call). Single-call
 * design avoids the cost of a Text Search → Place Details round-trip.
 *
 * Null-safe by design:
 *  - Missing GOOGLE_MAPS_API_KEY → return null
 *  - Places API not enabled on the key (REQUEST_DENIED 403) → return null
 *  - No place match → return null
 *  - Network/5xx after retries → return null
 *
 * Caller (trust-engine free-tier orchestration) interprets null as "no review
 * data available" and leaves trust_reports.review_* columns NULL. This matches
 * the pre-enrichment behavior, so adding this lib never regresses an existing
 * report.
 */

const PLACES_TEXTSEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

// Pro SKU fields (rating + userRatingCount are atmosphere-tier in v1).
// Keep tight — every additional field can bump us into a higher SKU.
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount';

const TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1_000, 2_000, 4_000];

export interface PlaceReviewSummary {
  rating: number | null;
  total: number | null;
  sentiment: ReviewSentiment;
  place_id: string;
  matched_name: string | null;
  matched_address: string | null;
}

export type ReviewSentiment = 'EXCELLENT' | 'POSITIVE' | 'MIXED' | 'NEGATIVE' | 'INSUFFICIENT_DATA';

interface PlacesV1Response {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
  }>;
}

export async function findPlaceAndReviews(args: {
  contractor_name: string;
  city: string | null;
  state_code: string;
}): Promise<PlaceReviewSummary | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.info('[GooglePlaces] GOOGLE_MAPS_API_KEY not set — skipping review enrichment');
    return null;
  }

  const queryParts = [args.contractor_name, args.city, args.state_code].filter(Boolean);
  const textQuery = queryParts.join(', ');

  const body = JSON.stringify({
    textQuery,
    languageCode: 'en',
    pageSize: 1,
  });

  let lastErr: string | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(BACKOFF_MS[attempt - 1]);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(PLACES_TEXTSEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Permanent failures: don't retry. REQUEST_DENIED = Places API disabled
      // on this key, INVALID_ARGUMENT = bad query. Either way, more retries
      // won't help.
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        const text = await res.text();
        console.warn('[GooglePlaces] permanent error — review enrichment unavailable', {
          status: res.status,
          body: text.slice(0, 240),
          textQuery,
        });
        return null;
      }

      // Transient: 429 (rate limit) or 5xx — retry.
      if (res.status === 429 || res.status >= 500) {
        lastErr = `http_${res.status}`;
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        console.warn('[GooglePlaces] unexpected response', {
          status: res.status,
          body: text.slice(0, 240),
        });
        return null;
      }

      const data = (await res.json()) as PlacesV1Response;
      const place = data.places?.[0];
      if (!place) {
        console.info('[GooglePlaces] no place match', { textQuery });
        return null;
      }

      const rating = typeof place.rating === 'number' ? place.rating : null;
      const total = typeof place.userRatingCount === 'number' ? place.userRatingCount : null;

      return {
        rating,
        total,
        sentiment: deriveSentiment(rating, total),
        place_id: place.id,
        matched_name: place.displayName?.text ?? null,
        matched_address: place.formattedAddress ?? null,
      };
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err instanceof Error ? err.message : String(err);
      // network errors / aborts: retry
    }
  }

  console.warn('[GooglePlaces] all attempts failed', { textQuery, lastErr });
  return null;
}

/**
 * Sentiment derivation from rating + review count. Insufficient-data check
 * runs first because a 5-star average across 2 reviews is statistical noise,
 * not "EXCELLENT" — same logic for a 1-star average across 2 reviews.
 */
export function deriveSentiment(rating: number | null, total: number | null): ReviewSentiment {
  if (rating == null || total == null) return 'INSUFFICIENT_DATA';
  if (total < 5) return 'INSUFFICIENT_DATA';
  if (rating >= 4.5 && total >= 10) return 'EXCELLENT';
  if (rating >= 4.0) return 'POSITIVE';
  if (rating >= 3.0) return 'MIXED';
  return 'NEGATIVE';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
