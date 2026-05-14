/**
 * Live smoke for google-reviews scraper — hits Google Places (New) v1 for real.
 *
 * Requires GOOGLE_MAPS_API_KEY in the env (same var used in Vercel runtime).
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=<key> pnpm exec tsx scripts/smoke-google-reviews-live.ts
 *
 * Optional:
 *   QUERY_NAME=...     (default: 'Bedrock Excavating Corp')
 *   JURISDICTION=...   (default: 'CO')
 *   CITY=...           (default: 'Denver')
 *
 * Prints the full ScraperEvidence as JSON on success. Exits non-zero on any
 * thrown error (which includes the captured response body from the scraper's
 * 4xx/5xx body-capture, so GCP-side problems show their real message).
 */
import { scrapeGoogleReviews } from '../src/lib/trust/scrapers/google-reviews';

async function main() {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('GOOGLE_MAPS_API_KEY not set');
    process.exit(2);
  }
  const result = await scrapeGoogleReviews({
    query_name: process.env.QUERY_NAME ?? 'Bedrock Excavating Corp',
    jurisdiction: process.env.JURISDICTION ?? 'CO',
    city: process.env.CITY ?? 'Denver',
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('THREW:', e.constructor.name, e.message);
  process.exit(1);
});
