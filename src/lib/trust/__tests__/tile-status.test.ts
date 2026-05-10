import { describe, expect, it } from 'vitest'
import {
  deriveBusinessTile,
  deriveLicensingTile,
  deriveBbbTile,
  deriveReviewsTile,
  deriveLegalTile,
  deriveOshaTile,
  deriveSanctionsTile,
} from '../tile-status'

describe('deriveBusinessTile', () => {
  it('Active → verified', () => {
    const t = deriveBusinessTile({ biz_status: 'Active' })
    expect(t.tone).toBe('verified')
    expect(t.statusLabel).toBe('In Good Standing')
  })

  it('Delinquent → warning with explanatory body', () => {
    const t = deriveBusinessTile({ biz_status: 'Delinquent' })
    expect(t.tone).toBe('warning')
    expect(t.bodyText).toMatch(/may not be authorized/i)
  })

  it('Dissolved → critical', () => {
    const t = deriveBusinessTile({ biz_status: 'Dissolved' })
    expect(t.tone).toBe('critical')
  })

  it('null → not_searched', () => {
    const t = deriveBusinessTile({ biz_status: null })
    expect(t.tone).toBe('not_searched')
    expect(t.statusLabel).toBe('Not Searched')
  })
})

describe('deriveLicensingTile', () => {
  it('CO + Not Found + statewide-no-license note → not_applicable', () => {
    const t = deriveLicensingTile({
      lic_status: 'Not Found',
      state_code: 'CO',
      raw_report: {
        licensing: {
          source_note: 'CO DORA: no professional/occupational license record. CO has no statewide GC license; this source covers electricians, plumbers, CPAs, etc.',
        },
      },
    })
    expect(t.tone).toBe('not_applicable')
    expect(t.statusLabel).toMatch(/Not Required/i)
    expect(t.tooltipText).toMatch(/no statewide GC license/i)
  })

  it('Not Found without statewide note → not_searched', () => {
    const t = deriveLicensingTile({
      lic_status: 'Not Found',
      state_code: 'TX',
      raw_report: { licensing: { source_note: 'TX TDLR: no record' } },
    })
    expect(t.tone).toBe('not_searched')
  })

  it('Active → verified', () => {
    const t = deriveLicensingTile({ lic_status: 'Active' })
    expect(t.tone).toBe('verified')
  })

  it('Revoked → critical', () => {
    const t = deriveLicensingTile({ lic_status: 'Revoked' })
    expect(t.tone).toBe('critical')
  })
})

describe('deriveBbbTile', () => {
  it('A+ → verified', () => {
    const t = deriveBbbTile({ bbb_rating: 'A+' })
    expect(t.tone).toBe('verified')
  })

  it('null → not_searched with explanation', () => {
    const t = deriveBbbTile({ bbb_rating: null })
    expect(t.tone).toBe('not_searched')
    expect(t.tooltipText).toMatch(/bbb\.org/i)
  })

  it('F → critical', () => {
    const t = deriveBbbTile({ bbb_rating: 'F' })
    expect(t.tone).toBe('critical')
  })
})

describe('deriveReviewsTile', () => {
  it('avg 4.5 + 12 reviews → verified with body', () => {
    const t = deriveReviewsTile({ review_avg_rating: 4.5, review_total: 12 })
    expect(t.tone).toBe('verified')
    expect(t.statusLabel).toMatch(/4\.5/)
    expect(t.statusLabel).toMatch(/12 reviews/)
  })

  it('null → not_searched + tier-explanation tooltip', () => {
    const t = deriveReviewsTile({ review_avg_rating: null })
    expect(t.tone).toBe('not_searched')
    expect(t.tooltipText).toMatch(/Standard tier/i)
  })

  it('avg 2.5 → warning', () => {
    const t = deriveReviewsTile({ review_avg_rating: 2.5, review_total: 8 })
    expect(t.tone).toBe('warning')
  })
})

describe('deriveLegalTile', () => {
  it('No Actions Found + empty findings → clean', () => {
    const t = deriveLegalTile({ legal_status: 'No Actions Found', legal_findings: [] })
    expect(t.tone).toBe('clean')
    expect(t.tooltipText).toMatch(/CourtListener/i)
  })

  it('null status → not_searched', () => {
    const t = deriveLegalTile({ legal_status: null, legal_findings: null })
    expect(t.tone).toBe('not_searched')
  })

  it('3+ findings → critical', () => {
    const t = deriveLegalTile({
      legal_status: 'Action Found',
      legal_findings: ['judgment 1', 'judgment 2', 'lien 3'],
    })
    expect(t.tone).toBe('critical')
  })

  it('1-2 findings → warning', () => {
    const t = deriveLegalTile({
      legal_status: 'Action Found',
      legal_findings: ['single judgment'],
    })
    expect(t.tone).toBe('warning')
  })
})

describe('deriveOshaTile', () => {
  it('Clean → verified', () => {
    const t = deriveOshaTile({ osha_status: 'Clean' })
    expect(t.tone).toBe('verified')
  })

  it('null → not_searched + roadmap-tooltip', () => {
    const t = deriveOshaTile({ osha_status: null })
    expect(t.tone).toBe('not_searched')
    expect(t.tooltipText).toMatch(/in development/i)
  })

  it('Fatality → critical', () => {
    const t = deriveOshaTile({ osha_status: 'Fatality', osha_violation_count: 1, osha_serious_count: 1 })
    expect(t.tone).toBe('critical')
  })
})

describe('deriveSanctionsTile', () => {
  it('sam_gov_exclusions in sources_cited → verified', () => {
    const t = deriveSanctionsTile({
      raw_report: { sources_cited: [{ source_key: 'sam_gov_exclusions' }] },
    })
    expect(t.tone).toBe('verified')
  })

  it('no SAM cited → not_searched', () => {
    const t = deriveSanctionsTile({
      raw_report: { sources_cited: [{ source_key: 'co_sos_biz' }] },
    })
    expect(t.tone).toBe('not_searched')
  })

  it('null raw_report → not_searched', () => {
    const t = deriveSanctionsTile({ raw_report: null })
    expect(t.tone).toBe('not_searched')
  })
})
