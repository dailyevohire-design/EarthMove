import { describe, expect, it } from 'vitest'
import { buildScoreExplanation } from '../score-explanation'
import type { ScraperEvidence, TrustFindingType, TrustConfidence } from '../scrapers/types'

function ev(findingType: TrustFindingType, id = 'e1', extras: Record<string, unknown> = {}): ScraperEvidence & { id: string } {
  return {
    source_key: extras.source_key as string ?? 'mock_source',
    finding_type: findingType,
    confidence: 'verified_structured' as TrustConfidence,
    finding_summary: 'test',
    extracted_facts: extras,
    query_sent: null, response_sha256: null, response_snippet: null,
    duration_ms: 0, cost_cents: 0,
    id,
  }
}

describe('buildScoreExplanation', () => {
  it('returns base 100 when no evidence', () => {
    const r = buildScoreExplanation([])
    expect(r.base_score).toBe(100)
    expect(r.adjustments).toEqual([])
    expect(r.final_score).toBe(100)
  })

  it('applies single adverse finding deduction', () => {
    const r = buildScoreExplanation([ev('business_dissolved')])
    expect(r.adjustments[0].delta).toBe(-25)
    expect(r.final_score).toBe(75)
  })

  it('applies single positive finding bonus', () => {
    const r = buildScoreExplanation([ev('bbb_rating_a_plus')])
    expect(r.adjustments[0].delta).toBe(5)
    expect(r.final_score).toBe(100) // capped at 100, started at 100 + 5
  })

  it('caps OSHA category at -30 across multiple citations', () => {
    const r = buildScoreExplanation([
      ev('osha_serious_citation', 'o1'),
      ev('osha_serious_citation', 'o2'),
      ev('osha_serious_citation', 'o3'),
      ev('osha_serious_citation', 'o4'),
    ])
    const oshaTotal = r.adjustments.reduce((s, a) => s + a.delta, 0)
    expect(oshaTotal).toBeGreaterThanOrEqual(-30)
  })

  it('phoenix signal deducts -15 with -30 cap', () => {
    const r = buildScoreExplanation([
      ev('phoenix_signal', 'p1'),
      ev('phoenix_signal', 'p2'),
      ev('phoenix_signal', 'p3'),
    ])
    const phoenixTotal = r.adjustments.reduce((s, a) => s + a.delta, 0)
    expect(phoenixTotal).toBe(-30)
    expect(r.adjustments).toHaveLength(2) // cap reached after 2nd
  })

  it('sanction_hit deducts -50 (severe)', () => {
    const r = buildScoreExplanation([ev('sanction_hit')])
    expect(r.adjustments[0].delta).toBe(-50)
  })

  it('cross_engine_corroboration adverse deducts -3 per up to -20', () => {
    const corro = (id: string, dir: 'adverse' | 'positive') =>
      ev('cross_engine_corroboration_event' as TrustFindingType, id, { claim_direction: dir })
    const r = buildScoreExplanation([
      corro('c1', 'adverse'),
      corro('c2', 'adverse'),
      corro('c3', 'adverse'),
      corro('c4', 'adverse'),
    ])
    const adverseDeltas = r.adjustments.filter((a) => a.reason.includes('adverse'))
    const total = adverseDeltas.reduce((s, a) => s + a.delta, 0)
    expect(total).toBeGreaterThanOrEqual(-20)
  })

  it('caps below 0 floor', () => {
    const r = buildScoreExplanation([
      ev('sanction_hit'),       // -50
      ev('business_dissolved'), // -25
      ev('phoenix_signal', 'p1'), // -15
      ev('phoenix_signal', 'p2'), // -15
    ])
    expect(r.final_score).toBe(0)
  })

  it('honors finalScoreOverride when caller passes one', () => {
    // Caller can pass the orchestrator-computed score (which uses
    // different adjustments e.g. open-web delta) so the explanation
    // arithmetic doesn't have to perfectly match.
    const r = buildScoreExplanation([ev('business_dissolved')], 60)
    expect(r.final_score).toBe(60)
    // arithmetic still recorded — override only changes the final number
    expect(r.adjustments[0].delta).toBe(-25)
  })

  it('attributes source + evidence_id', () => {
    const r = buildScoreExplanation([ev('license_revoked', 'lic-evid-id')])
    expect(r.adjustments[0].source).toBe('mock_source')
    expect(r.adjustments[0].evidence_id).toBe('lic-evid-id')
  })

  it('handles same finding twice with cap applied progressively', () => {
    const r = buildScoreExplanation([
      ev('legal_action_found', 'l1'),
      ev('legal_action_found', 'l2'),
      ev('legal_action_found', 'l3'),
      ev('legal_action_found', 'l4'),
      ev('legal_action_found', 'l5'),
      ev('legal_action_found', 'l6'),
    ])
    const total = r.adjustments.reduce((s, a) => s + a.delta, 0)
    expect(total).toBeGreaterThanOrEqual(-25)
  })
})
