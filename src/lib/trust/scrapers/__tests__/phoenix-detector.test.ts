import { describe, expect, it } from 'vitest'
import {
  detectPhoenixPattern,
  relatedEntitiesToEvidence,
  type CanonicalEntity,
  type RelatedEntity,
} from '../phoenix-detector'

const canonicalCO: CanonicalEntity = {
  source_key: 'co_sos_biz',
  entity_id: '20031389005',
  entity_name: 'BEDROCK EXCAVATING CORP',
  principal_address: '7519 E State Hwy 86, Franktown, CO, 80116',
  registered_agent_name: 'JAMIE A. SHULTZ',
  formation_date: '2010-01-01',
}

function fakeFetch(rowsByUrl: Record<string, unknown[]>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = typeof url === 'string' ? url : (url as URL).toString()
    const matchedKey = Object.keys(rowsByUrl).find((k) => u.includes(k))
    if (!matchedKey) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify(rowsByUrl[matchedKey]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
}

describe('detectPhoenixPattern (CO)', () => {
  it('returns empty when no related entities found', async () => {
    const result = await detectPhoenixPattern(canonicalCO, {
      fetchFn: fakeFetch({ 'data.colorado.gov': [] }),
    })
    expect(result).toEqual([])
  })

  it('classifies phoenix_signal when related entity dissolved before canonical formation + non-address shared', async () => {
    const result = await detectPhoenixPattern({ ...canonicalCO, formation_date: '2020-01-01' }, {
      fetchFn: fakeFetch({
        'data.colorado.gov': [
          {
            entityid: '99999', entityname: 'PRIOR ROOFING LLC',
            entitystatus: 'Voluntarily Dissolved', entityformdate: '2010-01-01',
            agentfirstname: 'JAMIE', agentlastname: 'SHULTZ',
            principaladdress1: '999 Other St',
          },
        ],
      }),
    })
    // Address-only matches default to neighbor; agent match drives stronger
    // classification. With dissolved + canonical-formed-after, expect phoenix.
    const phoenix = result.find((r) => r.relationship_type === 'phoenix_signal')
    expect(phoenix).toBeDefined()
  })

  it('classifies same_operator when both active + within 2 years + agent match', async () => {
    const result = await detectPhoenixPattern({ ...canonicalCO, formation_date: '2018-01-01' }, {
      fetchFn: fakeFetch({
        'data.colorado.gov': [
          {
            entityid: '111', entityname: 'SISTER LLC',
            entitystatus: 'Good Standing', entityformdate: '2018-06-01',
            agentfirstname: 'JAMIE', agentlastname: 'SHULTZ',
            principaladdress1: 'somewhere',
          },
        ],
      }),
    })
    const same = result.find((r) => r.relationship_type === 'same_operator')
    expect(same).toBeDefined()
  })

  it('classifies address_neighbor when only address shared', async () => {
    const result = await detectPhoenixPattern(canonicalCO, {
      fetchFn: fakeFetch({
        'data.colorado.gov': [
          {
            entityid: '222', entityname: 'COWORKING TENANT LLC',
            entitystatus: 'Good Standing', entityformdate: '2015-01-01',
            agentfirstname: 'OTHER', agentlastname: 'PERSON',
            principaladdress1: '7519 E State Hwy 86, Franktown, CO',
          },
        ],
      }),
    })
    const neighbor = result.find((r) => r.relationship_type === 'address_neighbor')
    expect(neighbor).toBeDefined()
  })

  it('skips canonical entity from related results', async () => {
    const result = await detectPhoenixPattern(canonicalCO, {
      fetchFn: fakeFetch({
        'data.colorado.gov': [
          { entityid: canonicalCO.entity_id, entityname: 'BEDROCK EXCAVATING CORP', principaladdress1: 'X' },
          { entityid: 'OTHER', entityname: 'NEIGHBOR LLC', principaladdress1: 'X' },
        ],
      }),
    })
    expect(result.find((r) => r.entity_id === canonicalCO.entity_id)).toBeUndefined()
    expect(result.find((r) => r.entity_id === 'OTHER')).toBeDefined()
  })

  it('returns empty + does not throw on fetch failure', async () => {
    const failingFetch: typeof fetch = (async () => { throw new Error('boom') }) as typeof fetch
    const result = await detectPhoenixPattern(canonicalCO, { fetchFn: failingFetch })
    expect(result).toEqual([])
  })

  it('returns empty when canonical has no usable identifiers', async () => {
    const empty: CanonicalEntity = {
      ...canonicalCO,
      principal_address: null,
      registered_agent_name: null,
    }
    const result = await detectPhoenixPattern(empty, { fetchFn: fakeFetch({}) })
    expect(result).toEqual([])
  })

  it('returns empty for unsupported source_key', async () => {
    const fl: CanonicalEntity = { ...canonicalCO, source_key: 'fl_sunbiz' as 'co_sos_biz' }
    const result = await detectPhoenixPattern(fl, { fetchFn: fakeFetch({}) })
    expect(result).toEqual([])
  })
})

describe('relatedEntitiesToEvidence', () => {
  it('maps phoenix_signal to phoenix_signal finding_type', () => {
    const related: RelatedEntity = {
      entity_name: 'PRIOR LLC', entity_id: '1', status: 'Dissolved',
      formation_date: '2010-01-01', dissolution_date: '2018-01-01',
      shared_indicator: 'agent', relationship_type: 'phoenix_signal',
      source_url: 'https://x', similarity_score: 1,
    }
    const ev = relatedEntitiesToEvidence([related], canonicalCO)
    expect(ev[0].finding_type).toBe('phoenix_signal')
  })

  it('maps same_operator → officer_match, address_neighbor → address_reuse', () => {
    const related: RelatedEntity[] = [
      { entity_name: 'SAME', entity_id: '1', status: 'Active', formation_date: '2020', dissolution_date: null,
        shared_indicator: 'agent', relationship_type: 'same_operator', source_url: '', similarity_score: 1 },
      { entity_name: 'NEIGHBOR', entity_id: '2', status: 'Active', formation_date: '2020', dissolution_date: null,
        shared_indicator: 'address', relationship_type: 'address_neighbor', source_url: '', similarity_score: 1 },
    ]
    const ev = relatedEntitiesToEvidence(related, canonicalCO)
    expect(ev[0].finding_type).toBe('officer_match')
    expect(ev[1].finding_type).toBe('address_reuse')
  })
})
