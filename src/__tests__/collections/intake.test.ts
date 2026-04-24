import { describe, it, expect, vi, beforeEach } from 'vitest'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

let flagEnabled = true
vi.mock('@/lib/collections/feature-flag', async () => {
  const actual = await vi.importActual<any>('@/lib/collections/feature-flag')
  return {
    ...actual,
    isCollectionsEnabled: () => flagEnabled,
    assertCollectionsEnabled: () => { if (!flagEnabled) throw new Error('COLLECTIONS_DISABLED') },
  }
})

let authedUser: any = { id: 'user-1', email: 'test@earthmove.io' }
const insertedCases: any[] = []
const insertedEvents: any[] = []
const updatedCases: any[] = []

function makeInsertBuilder(table: string) {
  return {
    insert: (row: any) => {
      if (table === 'collections_cases') {
        const id = 'case-' + (insertedCases.length + 1)
        const stored = { id, ...row }
        insertedCases.push(stored)
        return {
          select: () => ({ single: async () => ({ data: { id, user_id: row.user_id, state_code: row.state_code, kit_variant: row.kit_variant }, error: null }) }),
        }
      }
      if (table === 'collections_case_events') {
        insertedEvents.push(row)
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    },
    update: (values: any) => ({
      eq: (_col: string, _val: any) => { updatedCases.push({ table, values }); return Promise.resolve({ data: null, error: null }) },
    }),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: authedUser }, error: null }) },
  }),
  createAdminClient: () => ({
    from: (table: string) => makeInsertBuilder(table),
  }),
}))

const stripeCreateCalls: any[] = []
vi.mock('@/lib/stripe', () => ({
  stripe: () => ({
    checkout: {
      sessions: {
        create: async (args: any, opts?: any) => {
          stripeCreateCalls.push({ args, opts })
          return { id: 'cs_test_abc', url: 'https://stripe.test/pay/cs_test_abc' }
        },
      },
    },
  }),
}))

import { POST } from '@/app/api/collections/intake/route'
import { resolveKitVariant } from '@/lib/collections/validation'

function mkReq(body: any) {
  return {
    nextUrl: new URL('https://earthmove.io/api/collections/intake'),
    url: 'https://earthmove.io/api/collections/intake',
    headers: { get: (_k: string) => null },
    json: async () => body,
  } as any
}

function baseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const today = new Date()
  const last  = new Date(today); last.setUTCMonth(last.getUTCMonth() - 1)
  const first = new Date(last);  first.setUTCMonth(first.getUTCMonth() - 1)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return {
    state_code: 'CO',
    contractor_role: 'original_contractor',
    property_type: 'commercial',
    is_homestead: false,
    claimant_name: 'Acme Excavation LLC',
    claimant_address: '123 Industrial Way, Denver, CO 80202',
    claimant_phone: '555-0100',
    claimant_email: 'ops@acme-ex.test',
    claimant_entity_type: 'llc',
    respondent_name: 'BigBuild Developers Inc.',
    respondent_address: '4900 Office Pkwy, Denver, CO 80202',
    respondent_relationship: 'general_contractor',
    property_street_address: '900 Market St',
    property_city: 'Denver',
    property_state: 'CO',
    property_zip: '80202',
    property_county: 'denver',
    property_legal_description: 'Lot 4, Block 3, Downtown Subdivision',
    property_owner_name: 'Market St Owner LLC',
    property_owner_address: '1 Owner Plz, Denver, CO 80202',
    work_description: 'Excavation, grading, and haul-off of 12,000 cubic yards of fill dirt for the site prep of the new office building.',
    first_day_of_work: iso(first),
    last_day_of_work:  iso(last),
    amount_owed_cents: 4750000,
    ...overrides,
  }
}

beforeEach(() => {
  insertedCases.length = 0
  insertedEvents.length = 0
  updatedCases.length = 0
  stripeCreateCalls.length = 0
  flagEnabled = true
  authedUser = { id: 'user-1', email: 'test@earthmove.io' }
  process.env.STRIPE_PRICE_COLLECTIONS_KIT = 'price_coll_kit_test'
})

describe('POST /api/collections/intake — kit model', () => {
  it('1. CO commercial → 200, kit_variant=full_kit', async () => {
    const res = await POST(mkReq(baseBody()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kit_variant).toBe('full_kit')
  })

  it('2. CO residential_non_homestead → 200 (no longer blocked)', async () => {
    const res = await POST(mkReq(baseBody({ property_type: 'residential_non_homestead' })))
    expect(res.status).toBe(200)
    expect((await res.json()).kit_variant).toBe('full_kit')
  })

  it('3. CO residential_homestead → 200 full_kit (v0 block removed in kit model)', async () => {
    const res = await POST(mkReq(baseBody({ property_type: 'residential_homestead', is_homestead: true })))
    expect(res.status).toBe(200)
    expect((await res.json()).kit_variant).toBe('full_kit')
  })

  it('4. TX commercial → 200 full_kit', async () => {
    const res = await POST(mkReq(baseBody({
      state_code: 'TX', property_state: 'TX', property_county: 'dallas', property_city: 'Dallas',
    })))
    expect(res.status).toBe(200)
    expect((await res.json()).kit_variant).toBe('full_kit')
  })

  it('5. TX residential_non_homestead → 200 full_kit (v0 block removed)', async () => {
    const res = await POST(mkReq(baseBody({
      state_code: 'TX', property_state: 'TX', property_county: 'dallas', property_city: 'Dallas',
      property_type: 'residential_non_homestead',
    })))
    expect(res.status).toBe(200)
    expect((await res.json()).kit_variant).toBe('full_kit')
  })

  it('6. TX residential_homestead WITH pre-work both-spouses contract → 200 full_kit', async () => {
    const res = await POST(mkReq(baseBody({
      state_code: 'TX', property_state: 'TX', property_county: 'dallas', property_city: 'Dallas',
      property_type: 'residential_homestead', is_homestead: true,
      original_contract_signed_date: '2026-01-02',
      original_contract_both_spouses_signed: true,
    })))
    expect(res.status).toBe(200)
    expect((await res.json()).kit_variant).toBe('full_kit')
  })

  it('7. TX residential_homestead WITHOUT pre-work contract → 200 demand_only', async () => {
    const res = await POST(mkReq(baseBody({
      state_code: 'TX', property_state: 'TX', property_county: 'dallas', property_city: 'Dallas',
      property_type: 'residential_homestead', is_homestead: true,
      original_contract_signed_date: null,
      original_contract_both_spouses_signed: null,
    })))
    expect(res.status).toBe(200)
    expect((await res.json()).kit_variant).toBe('demand_only')
  })

  it('8. TX homestead with contract signed by owner only → 200 demand_only', async () => {
    const res = await POST(mkReq(baseBody({
      state_code: 'TX', property_state: 'TX', property_county: 'dallas', property_city: 'Dallas',
      property_type: 'residential_homestead', is_homestead: true,
      original_contract_signed_date: '2026-01-02',
      original_contract_both_spouses_signed: false,
    })))
    expect(res.status).toBe(200)
    expect((await res.json()).kit_variant).toBe('demand_only')
  })

  it("9. CO past-deadline (5 months ago) → 400 'past_filing_deadline'", async () => {
    const today = new Date()
    const last  = new Date(today); last.setUTCMonth(last.getUTCMonth() - 5)
    const first = new Date(last);  first.setUTCMonth(first.getUTCMonth() - 1)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const res = await POST(mkReq(baseBody({ first_day_of_work: iso(first), last_day_of_work: iso(last) })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('past_filing_deadline')
  })

  it('10. amount_owed_cents=0 → 400', async () => {
    const res = await POST(mkReq(baseBody({ amount_owed_cents: 0 })))
    expect(res.status).toBe(400)
  })

  it("11. state_code='AZ' → 400 invalid_input", async () => {
    const res = await POST(mkReq(baseBody({ state_code: 'AZ', property_state: 'AZ' })))
    expect(res.status).toBe(400)
  })

  it('12. missing STRIPE_PRICE_COLLECTIONS_KIT → 500', async () => {
    delete process.env.STRIPE_PRICE_COLLECTIONS_KIT
    const res = await POST(mkReq(baseBody()))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('stripe_price_not_configured')
  })

  it('13. unauth → 401', async () => {
    authedUser = null
    const res = await POST(mkReq(baseBody()))
    expect(res.status).toBe(401)
  })

  it('14. resolveKitVariant correctly maps all relevant combos (pure-function sanity)', () => {
    // TX homestead no contract → demand_only
    expect(resolveKitVariant({
      ...baseBody({
        state_code: 'TX', property_state: 'TX', property_type: 'residential_homestead',
        is_homestead: true, original_contract_signed_date: null,
        original_contract_both_spouses_signed: false,
      }) as any,
    })).toBe('demand_only')
    // TX homestead WITH contract → full_kit
    expect(resolveKitVariant({
      ...baseBody({
        state_code: 'TX', property_state: 'TX', property_type: 'residential_homestead',
        is_homestead: true, original_contract_signed_date: '2026-01-02',
        original_contract_both_spouses_signed: true,
      }) as any,
    })).toBe('full_kit')
    // CO homestead → full_kit (CO does not have the TX homestead rule)
    expect(resolveKitVariant({
      ...baseBody({
        property_type: 'residential_homestead', is_homestead: true,
      }) as any,
    })).toBe('full_kit')
  })
})
