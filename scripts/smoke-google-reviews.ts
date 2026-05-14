/**
 * Stub smoke for google-reviews scraper.
 * Tests error paths that don't require a live API key.
 * Live integration smoke is a separate manual step after GOOGLE_PLACES_API_KEY
 * is set in Vercel.
 */
import { scrapeGoogleReviews } from '../src/lib/trust/scrapers/google-reviews';

let failures = 0;
function fail(label: string, msg: string) {
  console.error('FAIL ' + label + ': ' + msg);
  failures++;
}
function pass(label: string) {
  console.log('OK ' + label);
}

async function expectErrorClass(
  label: string,
  fn: () => Promise<unknown>,
  expectedClassName: string,
) {
  try {
    await fn();
    fail(label, `expected ${expectedClassName}, got success`);
  } catch (e) {
    const actual = (e as Error).constructor.name;
    if (actual !== expectedClassName) {
      fail(label, `expected ${expectedClassName}, got ${actual}: ${(e as Error).message}`);
    } else {
      pass(label + ' threw ' + expectedClassName);
    }
  }
}

async function main() {
  delete process.env.GOOGLE_PLACES_API_KEY;
  await expectErrorClass(
    'missing API key',
    () => scrapeGoogleReviews({ query_name: 'Bedrock Excavation', jurisdiction: 'CO', city: 'Denver' }),
    'ScraperAuthError',
  );

  process.env.GOOGLE_PLACES_API_KEY = 'short';
  await expectErrorClass(
    'too-short API key',
    () => scrapeGoogleReviews({ query_name: 'Test', jurisdiction: 'CO', city: 'Denver' }),
    'ScraperAuthError',
  );

  if (failures > 0) {
    console.error('\nFAILED: ' + failures + ' smoke test(s)');
    process.exit(1);
  }
  console.log('\nsmoke: all tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
