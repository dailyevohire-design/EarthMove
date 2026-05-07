/**
 * Watchdog wrapper around Anthropic messages.create.
 *
 * Wraps the SDK call in an AbortController + setTimeout to short-circuit
 * stalled generations BEFORE the SDK's own 10-min default timeout fires.
 * Returns a typed discriminated union so the caller can drive a fallback
 * cascade (e.g. Opus → Sonnet → templated) on stall, while letting non-stall
 * SDK errors (auth, rate-limit, validator-pre-fail) bubble for Inngest's
 * retry policy to handle.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface WatchdogCallParams {
  client: Anthropic;
  model: string;
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
  tools: Anthropic.Tool[];
  toolChoice: { type: 'tool'; name: string };
  timeoutMs: number;
}

export type WatchdogResult =
  | { kind: 'success'; response: Anthropic.Message; durationMs: number }
  | { kind: 'timeout'; timeoutMs: number; elapsedMs: number }
  | { kind: 'error'; error: unknown; durationMs: number };

export async function callAnthropicWithWatchdog(
  params: WatchdogCallParams,
): Promise<WatchdogResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const response = await params.client.messages.create(
      {
        model: params.model,
        max_tokens: params.maxTokens,
        temperature: 0,
        system: params.systemPrompt,
        tools: params.tools,
        tool_choice: params.toolChoice,
        messages: [{ role: 'user', content: params.userPrompt }],
      },
      { signal: controller.signal },
    );
    return { kind: 'success', response, durationMs: Date.now() - start };
  } catch (err) {
    const elapsed = Date.now() - start;
    // The watchdog can fire via two error shapes depending on where the abort
    // is observed: web-style DOMException (name='AbortError') from the
    // underlying fetch, or the SDK's wrapped APIUserAbortError. Treat both as
    // a stall signal so the caller can fall back rather than retry.
    const errName = (err as { name?: string })?.name;
    const ctorName = (err as { constructor?: { name?: string } })?.constructor?.name;
    const isAbort = errName === 'AbortError' || ctorName === 'APIUserAbortError';
    if (isAbort) {
      return { kind: 'timeout', timeoutMs: params.timeoutMs, elapsedMs: elapsed };
    }
    return { kind: 'error', error: err, durationMs: elapsed };
  } finally {
    clearTimeout(timer);
  }
}
