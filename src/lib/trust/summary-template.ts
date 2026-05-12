/**
 * Templated summary text for trust_reports. TS twin of the SQL
 * build_trust_summary_text function (migration 237). Both must stay in
 * sync — same inputs produce the same string, character-for-character.
 *
 * Used in finalizeFreeTier to regenerate the summary after the SQL score
 * override, closing the PR #38 drift bug where buildSummary ran with a
 * placeholder null trust_score and the orchestrator then rewrote
 * trust_score without rewriting summary.
 */

export function buildTrustSummaryTemplate(
  score: number | null,
  risk: string | null,
  redN: number,
  posN: number,
): string {
  if (score === null) {
    return 'Insufficient public records to score this entity. Verify directly with state.';
  }
  switch (risk) {
    case 'CRITICAL':
      return `Trust score ${score}/100 — CRITICAL risk. ${redN} red flag(s) on record. Recommend caution before contracting.`;
    case 'HIGH':
      return `Trust score ${score}/100 — HIGH risk. ${redN} red flag(s) and ${posN} positive indicator(s) on record.`;
    case 'MEDIUM':
      return `Trust score ${score}/100 — MEDIUM risk. ${redN} red flag(s) and ${posN} positive indicator(s) on record.`;
    case 'LOW':
      return `Trust score ${score}/100 — verified active operator. ${posN} positive indicator(s) on record.`;
    default:
      return `Trust score ${score}/100.`;
  }
}
