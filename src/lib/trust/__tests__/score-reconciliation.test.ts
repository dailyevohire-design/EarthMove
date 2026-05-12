/**
 * Free-tier builder contract — post path-(a) realignment.
 *
 * buildEvidenceDerivedReport no longer computes trust_score; the
 * orchestrator overrides trust_score / risk_level / score_breakdown with
 * the SQL pipeline (calculate_contractor_trust_score) when
 * data_integrity_status==='ok'. This file is the regression guard for the
 * builder's new contract:
 *
 *   - entity_not_found / failed paths emit trust_score=null.
 *   - ok / partial / degraded paths emit trust_score=null as a placeholder
 *     that the orchestrator overrides before INSERT.
 *   - score_breakdown carries the placeholder methodology marker so the
 *     PDF / share page can detect the rare case where the override didn't
 *     fire.
 *   - Column projection (biz_status, lic_status, bbb_rating, osha_status,
 *     legal_status, evidence_ids, raw_report) is unaffected by the swap
 *     and continues to populate from evidence rows.
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

describe('Free-tier builder — null trust_score on entity_not_found / failed', () => {
  it('entity_not_found emits null trust_score and null risk_level', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_not_found', 'co_sos_biz'),
      ev('license_no_record', 'co_dora'),
      ev('sanction_clear', 'sam_gov_exclusions'),
    ])
    expect(report.data_integrity_status).toBe('entity_not_found')
    expect(report.trust_score).toBeNull()
    expect(report.risk_level).toBeNull()
    expect(report.confidence_level).toBe('LOW')
  })

  it('all sources errored ⇒ failed + null trust_score', () => {
    const report = buildEvidenceDerivedReport([
      ev('source_error', 'co_sos_biz'),
      ev('source_error', 'co_dora'),
      ev('source_error', 'sam_gov_exclusions'),
    ])
    expect(report.data_integrity_status).toBe('failed')
    expect(report.trust_score).toBeNull()
    expect(report.risk_level).toBeNull()
  })

  it('entity_disambiguation_required emits null trust_score', () => {
    const report = buildEvidenceDerivedReport([
      ev('entity_disambiguation_candidates', 'system_internal', {
        candidates: [{ entity_name: 'Foo LLC', entity_id: '1' }],
        query: 'Foo',
      }),
    ])
    expect(report.data_integrity_status).toBe('entity_disambiguation_required')
    expect(report.trust_score).toBeNull()
  })

  it('empty evidence routes through entity_not_found null path', () => {
    const report = buildEvidenceDerivedReport([])
    expect(report.trust_score).toBeNull()
    expect(report.risk_level).toBeNull()
  })
})

describe('Free-tier builder — placeholder trust_score on ok / partial / degraded', () => {
  it('ok path emits placeholder null trust_score (orchestrator overrides)', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz', { entity_type: 'LLC', formation_date: '2010-01-01' }),
      ev('license_active', 'co_dora', { license_number: 'EC.0001234' }),
      ev('sanction_clear', 'sam_gov_exclusions'),
      ev('legal_no_actions', 'courtlistener_fed'),
    ])
    expect(report.data_integrity_status).toBe('ok')
    expect(report.trust_score).toBeNull()
    expect(report.risk_level).toBeNull()
    expect(report.score_breakdown.methodology).toBe('placeholder_pre_sql_override')
    expect(report.score_breakdown.adjustments).toEqual([])
    expect(report.score_breakdown.final_score).toBeNull()
  })

  it('partial coverage still emits placeholder for orchestrator to override', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz', { entity_type: 'LLC' }),
      ev('source_error', 'co_dora'),
    ])
    expect(report.data_integrity_status).toBe('partial')
    expect(report.trust_score).toBeNull()
    expect(report.score_breakdown.methodology).toBe('placeholder_pre_sql_override')
  })
})

describe('Free-tier builder — column projection unchanged by score swap', () => {
  it('projects biz_status / biz_entity_type / biz_formation_date from SOS evidence', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz', {
        entity_type: 'LLC',
        formation_date: '2010-01-01',
        entity_name: 'Foo LLC',
      }),
    ])
    expect(report.biz_status).toBe('Active')
    expect(report.biz_entity_type).toBe('LLC')
    expect(report.biz_formation_date).toBe('2010-01-01')
  })

  it('projects lic_status / lic_license_number from license evidence', () => {
    const report = buildEvidenceDerivedReport([
      ev('license_active', 'co_dora', { license_number: 'EC.0001234' }),
    ])
    expect(report.lic_status).toBe('Active')
    expect(report.lic_license_number).toBe('EC.0001234')
  })

  it('open_web_* aggregates still populate from evidence', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz'),
      ev('open_web_adverse_signal', 'perplexity_sweep', {}, 'a1'),
      ev('open_web_adverse_signal', 'perplexity_sweep', {}, 'a2'),
      ev('open_web_positive_signal', 'perplexity_sweep', {}, 'p1'),
      ev('cross_engine_corroboration_event', 'system_internal', { claim_direction: 'adverse' }, 'c1'),
    ])
    expect(report.open_web_adverse_count).toBe(2)
    expect(report.open_web_positive_count).toBe(1)
    expect(report.open_web_corroboration_depth).toBe(1)
  })

  it('phoenix related_entities still project from phoenix_signal evidence', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz'),
      ev('phoenix_signal', 'system_internal', {
        entity_name: 'Other LLC',
        entity_id: '999',
        relationship_type: 'shared_officer',
      }, 'p1'),
    ])
    expect(report.related_entities).toHaveLength(1)
    expect(report.related_entities[0]).toMatchObject({
      entity_name: 'Other LLC',
      relationship_type: 'shared_officer',
    })
  })

  it('evidence_ids populates from rows with ids', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz', {}, 'id-1'),
      ev('license_active', 'co_dora', {}, 'id-2'),
    ])
    expect(report.evidence_ids).toEqual(['id-1', 'id-2'])
  })

  it('synthesis_model stays templated_evidence_derived', () => {
    const report = buildEvidenceDerivedReport([
      ev('business_active', 'co_sos_biz'),
    ])
    expect(report.synthesis_model).toBe('templated_evidence_derived')
  })
})
