/**
 * Smoke test for runTrustSynthesizeV2 — Path B (isolated handler invocation).
 *
 * Calls the new function's handler directly with a mock Inngest step API.
 * Tests the full synthesis pipeline (load job → score → load evidence →
 * synthesize → finalize → mark completed) without requiring an Inngest
 * dev server or the v2 fan-out emit path.
 *
 * Usage:
 *   pnpm exec tsx scripts/smoke-trust-synth.ts <job_id>
 *
 * Prereqs: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or whatever
 * createAdminClient() reads from). For paid tiers: ANTHROPIC_API_KEY.
 * For tier='free' (this smoke test): no Anthropic key needed.
 */

import { runTrustSynthesizeV2 } from '../src/lib/trust/inngest-functions';

const jobId = process.argv[2];
if (!jobId) {
  console.error('USAGE: pnpm exec tsx scripts/smoke-trust-synth.ts <job_id>');
  process.exit(1);
}

// Inngest function objects expose their handler differently across versions.
// v4 typically exposes `.fn` or `.handler`. We try both, fall back to introspection.
type AnyFn = (...args: unknown[]) => unknown;
const fnObj = runTrustSynthesizeV2 as unknown as Record<string, unknown>;
const handler =
  (fnObj.fn as AnyFn | undefined) ??
  (fnObj.handler as AnyFn | undefined) ??
  (fnObj['_fn'] as AnyFn | undefined);

if (typeof handler !== 'function') {
  console.error('ERR: could not locate handler on runTrustSynthesizeV2; introspecting:');
  console.error(Object.keys(fnObj));
  process.exit(2);
}

// Mock step API — passthrough, just executes the async body and returns its result.
const mockStep = {
  run: async <T>(_name: string, fn: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    try {
      const result = await fn();
      console.log(`  ✓ step "${_name}" (${Date.now() - start}ms)`);
      return result;
    } catch (err) {
      console.error(`  ✗ step "${_name}" failed after ${Date.now() - start}ms:`, err);
      throw err;
    }
  },
  sendEvent: async (name: string, payload: unknown) => {
    console.log(`  → step.sendEvent "${name}":`, JSON.stringify(payload));
  },
};

const mockEvent = {
  name: 'trust/job.synthesize.requested',
  data: { job_id: jobId },
  ts: Date.now(),
};

console.log(`\n=== invoking runTrustSynthesizeV2 with job_id=${jobId} ===\n`);

(async () => {
  try {
    const result = await handler({ event: mockEvent, step: mockStep });
    console.log('\n=== handler returned ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('\n=== handler threw ===');
    console.error(err);
    process.exit(3);
  }
})();
