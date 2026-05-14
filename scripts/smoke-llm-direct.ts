// Direct API probe — bypasses our synthesis wrapper to isolate whether the stall
// is at the API level (auth/rate/quota) or downstream (validation/schema/prompt
// construction). 3 simultaneous probes: Sonnet 4.6, Opus 4.7, Sonar Pro.
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

interface ProbeResult {
  provider: string;
  model: string;
  ok: boolean;
  status?: number;
  duration_ms: number;
  body_excerpt?: string;
  error?: string;
}

async function probeAnthropic(model: 'claude-sonnet-4-6' | 'claude-opus-4-7'): Promise<ProbeResult> {
  const t0 = Date.now();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { provider: 'anthropic', model, ok: false, duration_ms: 0, error: 'ANTHROPIC_API_KEY not set in env' };
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Reply with one word only: alive' }],
      }),
    });
    const body = await r.text();
    return { provider: 'anthropic', model, ok: r.ok, status: r.status, duration_ms: Date.now() - t0, body_excerpt: body.slice(0, 700) };
  } catch (e) {
    return { provider: 'anthropic', model, ok: false, duration_ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function probeSonar(): Promise<ProbeResult> {
  const t0 = Date.now();
  const key = process.env.PERPLEXITY_API_KEY ?? process.env.SONAR_API_KEY;
  if (!key) return { provider: 'sonar', model: 'sonar-pro', ok: false, duration_ms: 0, error: 'PERPLEXITY_API_KEY/SONAR_API_KEY not set in env' };
  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: 'Reply with one word only: alive' }],
        max_tokens: 32,
      }),
    });
    const body = await r.text();
    return { provider: 'sonar', model: 'sonar-pro', ok: r.ok, status: r.status, duration_ms: Date.now() - t0, body_excerpt: body.slice(0, 700) };
  } catch (e) {
    return { provider: 'sonar', model: 'sonar-pro', ok: false, duration_ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const results = await Promise.all([
    probeAnthropic('claude-sonnet-4-6'),
    probeAnthropic('claude-opus-4-7'),
    probeSonar(),
  ]);

  for (const r of results) {
    console.log(`\n── ${r.provider} / ${r.model} ──`);
    console.log(`  ok=${r.ok}  status=${r.status ?? 'n/a'}  duration=${r.duration_ms}ms`);
    if (r.error) console.log(`  error: ${r.error}`);
    if (r.body_excerpt) console.log(`  body: ${r.body_excerpt}`);
  }

  const verdict = results.every((r) => r.ok) ? 'all_apis_healthy' : results.some((r) => r.ok) ? 'partial_outage' : 'full_outage';
  console.log(`\nRESULT_JSON: ${JSON.stringify({ verdict, results })}`);
}

main().catch((e) => {
  console.error('[smoke] crashed', e);
  process.exit(1);
});
