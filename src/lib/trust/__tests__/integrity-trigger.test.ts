/**
 * Tests for the trust integrity v2 layer.
 *
 * Unit tests cover the TS template that mirrors the SQL build_trust_summary_text.
 * Integration tests against the SQL trigger live behind INTEGRITY_TRIGGER_DB_URL
 * — skipped by default since the rest of this test suite mocks Supabase. To
 * run them locally: pnpm vitest src/lib/trust/__tests__/integrity-trigger
 * with INTEGRITY_TRIGGER_DB_URL + INTEGRITY_TRIGGER_SERVICE_KEY set against
 * a disposable Supabase project that has migrations 237 + 238 applied.
 */

import { describe, it, expect } from 'vitest';
import { buildTrustSummaryTemplate } from '../summary-template';

describe('buildTrustSummaryTemplate — TS twin of SQL build_trust_summary_text', () => {
  it('null score returns the verify-with-state fallback', () => {
    expect(buildTrustSummaryTemplate(null, null, 0, 0)).toBe(
      'Insufficient public records to score this entity. Verify directly with state.',
    );
    expect(buildTrustSummaryTemplate(null, 'CRITICAL', 5, 0)).toBe(
      'Insufficient public records to score this entity. Verify directly with state.',
    );
  });

  it('CRITICAL risk template references score + red flag count', () => {
    const out = buildTrustSummaryTemplate(35, 'CRITICAL', 2, 0);
    expect(out).toContain('35/100');
    expect(out).toContain('CRITICAL');
    expect(out).toContain('2 red flag(s)');
    expect(out).toContain('Recommend caution before contracting');
  });

  it('HIGH risk template references score + both counts', () => {
    const out = buildTrustSummaryTemplate(46, 'HIGH', 3, 1);
    expect(out).toContain('46/100');
    expect(out).toContain('HIGH');
    expect(out).toContain('3 red flag(s)');
    expect(out).toContain('1 positive indicator(s)');
  });

  it('MEDIUM risk template references score + both counts', () => {
    const out = buildTrustSummaryTemplate(67, 'MEDIUM', 1, 2);
    expect(out).toContain('67/100');
    expect(out).toContain('MEDIUM');
  });

  it('LOW risk template uses "verified active operator" framing', () => {
    const out = buildTrustSummaryTemplate(97, 'LOW', 0, 4);
    expect(out).toContain('97/100');
    expect(out).toContain('verified active operator');
    expect(out).toContain('4 positive indicator(s)');
    expect(out).not.toContain('red flag');
  });

  it('unknown risk band falls back to bare score', () => {
    expect(buildTrustSummaryTemplate(50, null, 0, 0)).toBe('Trust score 50/100.');
    expect(buildTrustSummaryTemplate(50, 'UNKNOWN_FUTURE_VALUE' as never, 0, 0)).toBe('Trust score 50/100.');
  });

  it('matches the SQL trigger regex (score word-boundary inside /100 pattern)', () => {
    // The integrity trigger checks for /100 patterns whose number is within
    // ±2 of trust_score. Our template emits exactly `N/100` so it must match.
    const cases: Array<[number, string]> = [
      [35, 'CRITICAL'],
      [46, 'HIGH'],
      [67, 'MEDIUM'],
      [97, 'LOW'],
    ];
    for (const [score, risk] of cases) {
      const out = buildTrustSummaryTemplate(score, risk, 1, 1);
      const match = out.match(/([0-9]{1,3}(?:\.[0-9]+)?)\s*\/\s*100/);
      expect(match, `template for ${score}/${risk} must contain N/100`).not.toBeNull();
      expect(Number(match![1])).toBe(score);
    }
  });
});

const RUN_INTEGRATION = Boolean(process.env.INTEGRITY_TRIGGER_DB_URL);

describe.skipIf(!RUN_INTEGRATION)('integrity trigger — live DB', () => {
  // These cases would exercise the trigger directly. They are scaffolded but
  // skipped by default because the standard test setup mocks Supabase rather
  // than connecting to a real instance. Set INTEGRITY_TRIGGER_DB_URL +
  // INTEGRITY_TRIGGER_SERVICE_KEY to enable.
  it.todo('score=35 with summary="Trust score 100/100" → trigger rewrites summary to template');
  it.todo('score=80, risk_level=CRITICAL → trigger overrides risk_level to LOW');
  it.todo('score=35 with empty red_flags + business_inactive evidence → trigger auto-extracts');
  it.todo('score=80 with <5 evidence rows → trigger demotes to 59/HIGH + requires_re_review');
  it.todo('score=NULL → all checks skipped, summary set to "Insufficient public records…"');
  it.todo('hit_rate=0.30, confidence_level=HIGH → trigger downgrades to LOW');
  it.todo('UPDATE that changes score → trust_report_audit row inserted');
  it.todo('detect_trust_report_anomalies surfaces SUMMARY_SCORE_DRIFT on pre-trigger insert');
  it.todo('scan_phoenix_network groups Bedrock variants by shared address');
});
