import { createSecurityClient } from './server-client';
import { INJECTION_USER } from './injection-patterns';

export type SanitizeResult =
  | { safe: true; cleaned: string }
  | { safe: false; pattern: string; redacted: string };

export async function sanitizeUserInput(
  input: string,
  ctx: { userId?: string; ip?: string; sourceLabel: string }
): Promise<SanitizeResult> {
  if (!input || input.length === 0) return { safe: true, cleaned: '' };

  for (const pattern of INJECTION_USER) {
    const m = input.match(pattern);
    if (m) {
      const excerpt = input.slice(Math.max(0, (m.index ?? 0) - 20), (m.index ?? 0) + m[0].length + 20).slice(0, 500);
      try {
        const sb = createSecurityClient();
        await sb.from('ai_injection_attempts').insert({
          source: ctx.sourceLabel,
          pattern_matched: pattern.source.slice(0, 200),
          excerpt,
          user_id: ctx.userId ?? null,
          ip: ctx.ip ?? null,
          action_taken: 'blocked',
        });
      } catch { /* swallow */ }
      return { safe: false, pattern: pattern.source, redacted: '[blocked: injection pattern]' };
    }
  }
  return { safe: true, cleaned: input };
}
