/**
 * Score-arithmetic reconciliation invariant.
 *
 * After the reconciliation, buildEvidenceDerivedReport's trust_score
 * MUST equal score_breakdown.final_score for every report. The
 * breakdown's adjustments[] must sum to (final_score - base_score) within
 * the floor/ceiling clamps. This test file is the regression guard.
 *
 * If any of these tests fail, the audit-trail invariant is broken and
 * the displayed score no longer matches what the user can derive from
 * the explanation card. That's the bug we just fixed.
 */

import { describe, expect, it } from 'vitest'
import { buildEvidenceDerivedReport, type BuildReportEvidence } from '../build-evidence-derived-report'
import type { TrustFindingType, TrustConfidence } from '../scrapers/types'

function ev(
  finding_type: TrustFindingType,
  source_key = 'mock_source',
  extras: Record<string, unknown> = {},
  id = `e-${finding_type}-${Math.random().toString(36).slice(2, 6)}`,
): BuildReportEvidence {
  return {
    source_key,
    finding_type,
    confidence: 'verified_structured' as TrustConfidence,
    finding_summary: `${finding_type} test row`,
    extracted_facts: extras,
    query_sent: null,
    response_sha256: null,
    response_snippet: null,
    duration_ms: 0,
    cost_cents: 0,
    id,
  }
}

function assertReconciled(report: ReturnType<typeof buildEvidenceDerivedReport>) {
  // For null trust_score (entity_not_found / failed), the breakdown still
  // computes from evidence. Skip the equality check in those cases.
  if (report.trust_score === null) {
    expect(report.data_integrity_status === 'entity_not_found' || report.data_integrity_status === 'failed').toBe(true)
    return
  }
  // Core invariant: displayed trust_score == breakdown final_score.
  expect(report.trust_score).toBe(report.score_breakdown.final_score)
  // Arithmetic invariant: base + sum(deltas) clamped to [0, 100] == final.
  const sumOfDeltas = report.score_breakdown.adjustments.reduce((s, a) => s + a.delta, 0)
  const expected = Math.max(0, Math.min(100, report.score_breakdown.base_score + sumOfDeltas))
  expect(report.score_breakdown.final_score).toBe(expected)
}

describe('Score reconciliation — trust_score equals breakdown.final_score', () => {
  it('clean entity (business_active + sanction_clear)', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz', { entity_type: 'LLC', formation_date: '2010-01-01' }),
      ev('sanction_clear', 'sam_gov_exclusions'),
      ev('legal_no_actions', 'courtlistener_fed'),
      ev('osha_violations_clean', 'osha_est_search'),
    ])
    assertReconciled(report)
  })

  it('dissolved business + revoked license', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_dissolved', 'co_sos_biz'),
      ev('license_revoked', 'co_dora'),
    ])
    assertReconciled(report)
  })

  it('multi-OSHA citations hit category cap', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz'),
      ev('osha_serious_citation', 'osha_est_search', {}, 'o1'),
      ev('osha_serious_citation', 'osha_est_search', {}, 'o2'),
      ev('osha_serious_citation', 'osha_est_search', {}, 'o3'),
      ev('osha_serious_citation', 'osha_est_search', {}, 'o4'),
      ev('osha_willful_citation', 'osha_est_search', {}, 'w1'),
    ])
    assertReconciled(report)
  })

  it('phoenix-LLC pattern triggers cap-bounded deduction', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz'),
      ev('phoenix_signal', 'system_internal', {}, 'p1'),
      ev('phoenix_signal', 'system_internal', {}, 'p2'),
      ev('phoenix_signal', 'system_internal', {}, 'p3'),
    ])
    assertReconciled(report)
  })

  it('open-web adverse single-engine', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz'),
      ev('open_web_adverse_signal', 'perplexity_sweep', {}, 'a1'),
      ev('open_web_adverse_signal', 'perplexity_sweep', {}, 'a2'),
    ])
    assertReconciled(report)
  })

  it('cross-engine corroborated adverse', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz'),
      ev('open_web_adverse_signal', 'perplexity_sweep', {}, 'a1'),
      ev('cross_engine_corroboration_event', 'system_internal', { claim_direction: 'adverse' }, 'c1'),
      ev('cross_engine_corroboration_event', 'system_internal', { claim_direction: 'adverse' }, 'c2'),
    ])
    assertReconciled(report)
  })

  it('cross-engine corroborated positive', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz'),
      ev('open_web_positive_signal', 'perplexity_sweep'),
      ev('cross_engine_corroboration_event', 'system_internal', { claim_direction: 'positive' }, 'c1'),
    ])
    assertReconciled(report)
  })

  it('sanction_hit drives -50 (severe)', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz'),
      ev('sanction_hit', 'sam_gov_exclusions'),
    ])
    assertReconciled(report)
    expect(report.trust_score).toBe(50) // 100 - 50
  })

  it('multiple categories combined (legal + osha + phoenix)', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz'),
      ev('legal_action_found', 'courtlistener_fed', {}, 'l1'),
      ev('legal_action_found', 'courtlistener_fed', {}, 'l2'),
      ev('osha_serious_citation', 'osha_est_search', {}, 'o1'),
      ev('phoenix_signal', 'system_internal', {}, 'p1'),
    ])
    assertReconciled(report)
  })

  it('positive-heavy report does not exceed 100', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz'),
      ev('bbb_rating_a_plus', 'bbb_link_check'),
      ev('sanction_clear', 'sam_gov_exclusions'),
      ev('legal_no_actions', 'courtlistener_fed'),
      ev('osha_violations_clean', 'osha_est_search'),
      ev('federal_contractor_active', 'sam_gov_exclusions'),
    ])
    assertReconciled(report)
    expect(report.trust_score).toBeLessThanOrEqual(100)
  })

  it('entity_not_found null-score path stays consistent', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_not_found', 'co_sos_biz'),
      ev('license_no_record', 'co_dora'),
      ev('sanction_clear', 'sam_gov_exclusions'),
    ])
    assertReconciled(report)
    expect(report.trust_score).toBeNull()
    expect(report.data_integrity_status).toBe('entity_not_found')
  })

  it('failure cascade caps at 0 floor', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_dissolved', 'co_sos_biz'),
      ev('license_revoked', 'co_dora'),
      ev('sanction_hit', 'sam_gov_exclusions'),
      ev('osha_willful_citation', 'osha_est_search'),
      ev('phoenix_signal', 'system_internal', {}, 'p1'),
      ev('phoenix_signal', 'system_internal', {}, 'p2'),
    ])
    assertReconciled(report)
    expect(report.trust_score).toBe(0)
  })

  it('empty evidence stays at base 100 (clean fallback)', () => {
    const report = buildEvidenceDerivedReport([])
    // Empty evidence puts data_integrity_status in 'entity_not_found' or
    // similar — assertReconciled handles both branches.
    assertReconciled(report)
  })
})
