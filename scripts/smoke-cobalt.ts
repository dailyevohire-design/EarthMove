// scripts/smoke-cobalt.ts
//
// Smoke test for Cobalt Intelligence SOS client.
//
// Usage:
//   export COBALT_API_KEY=...
//   pnpm tsx scripts/smoke-cobalt.ts "Piezo Motion Corp." Georgia
//   pnpm tsx scripts/smoke-cobalt.ts "Earth Pro Connect LLC" CO
//
// Two-letter state codes auto-expand to full names inside the client.

import { fetchCobaltSosDetails, CobaltApiError } from '../src/lib/trust/sources/cobalt';

async function main(): Promise<void> {
  const [, , businessName, state] = process.argv;
  if (!businessName || !state) {
    console.error('Usage: pnpm tsx scripts/smoke-cobalt.ts "<business name>" <state>');
    process.exit(1);
  }
  if (!process.env.COBALT_API_KEY) {
    console.error('COBALT_API_KEY not in env. Export it or source .env.local first.');
    process.exit(1);
  }

  console.log(`→ Cobalt SOS lookup: "${businessName}" / ${state}`);
  try {
    const result = await fetchCobaltSosDetails(businessName, state);
    console.log(`✓ HTTP ${result.http.status} in ${result.http.durationMs}ms`);
    console.log(`  URL: ${result.http.url}`);
    console.log('');
    console.log('  Canonical extracted fields:');
    let extracted = 0;
    for (const [k, v] of Object.entries(result.canonical)) {
      if (v === undefined) continue;
      extracted++;
      const preview = typeof v === 'string' ? v.slice(0, 90) : JSON.stringify(v).slice(0, 90);
      console.log(`    ${k.padEnd(28)} ${preview}`);
    }
    if (extracted === 0) {
      console.log('    (none extracted — review raw response below)');
    }
    console.log('');
    const rawKeys = Object.keys(result.raw);
    console.log(`  Raw response top-level keys (${rawKeys.length}):`);
    console.log(`    ${rawKeys.join(', ') || '(empty)'}`);
    console.log('');
    console.log('  Raw response (first 3KB):');
    console.log(JSON.stringify(result.raw, null, 2).slice(0, 3072));
  } catch (err) {
    if (err instanceof CobaltApiError) {
      console.error(`✗ Cobalt API error (HTTP ${err.status}): ${err.message}`);
      console.error(`  Response body preview: ${err.body}`);
    } else {
      console.error(`✗ Unexpected: ${(err as Error).message}`);
      console.error((err as Error).stack);
    }
    process.exit(2);
  }
}

void main();
