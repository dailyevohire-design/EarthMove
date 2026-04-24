import { describe, it, expect, vi, beforeEach } from 'vitest'

// -----------------------------------------------------------------------------
// Mocks (hoisted)
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
        const stored = { id, user_id: row.user_id, state_code: row.state_code, ...row }
        insertedCases.push(stored)
        // Mimic .select('id, user_id, state_code').single() chain
        const selectChain = {
          select: () => ({ single: async () => ({ data: { id, user_id: row.user_id, state_code: row.state_code }, error: null }) }),
        }
        return selectChain
      }
      if (table === 'collections_case_events') {
        insertedEvents.push(row)
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    },
    update: (values: any) => ({
      eq: (_col: string, _val: any) => {
        updatedCases.push({ table, values })
        return Promise.resolve({ data: null, error: null })
      },
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
let stripeShouldThrow = false
vi.mock('@/lib/stripe', () => ({
  stripe: () => ({
    checkout: {
      sessions: {
        create: async (args: any, opts?: any) => {
          if (stripeShouldThrow) throw new Error('stripe failed')
          stripeCreateCalls.push({ args, opts })
          return { id: 'cs_test_abc', url: 'https://stripe.test/pay/cs_test_abc' }
        },
      },
    },
  }),
}))

// Import AFTER mocks
import { POST } from '@/app/api/collections/intake/route'

function mkReq(body: any) {
  return {
    nextUrl: new URL('https://earthmove.io/api/collections/intake'),
    url: 'https://earthmove.io/api/collections/intake',
    headers: { get: (_k: string) => null },
    json: async () => body,
  } as any
}

function baseBody(overrides: Record<string, unknown> = {}) {
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
  stripeShouldThrow = false
  flagEnabled = true
  authedUser = { id: 'user-1', email: 'test@earthmove.io' }
  process.env.STRIPE_PRICE_COLLECTIONS_ASSIST = 'price_coll_test'
})

describe('POST /api/collections/intake', () => {
  it('1. flag off → 404', async () => {
    flagEnabled = false
    const res = await POST(mkReq(baseBody()))
    expect(res.status).toBe(404)
  })

  it('2. CO commercial valid → 200, case created', async () => {
    const res = await POST(mkReq(baseBody()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.case_id).toBe('case-1')
    expect(body.checkout_url).toMatch(/stripe\.test/)
    expect(insertedCases).toHaveLength(1)
  })

  it('3. CO residential_non_homestead valid → 200', async () => {
    const res = await POST(mkReq(baseBody({ property_type: 'residential_non_homestead' })))
    expect(res.status).toBe(200)
  })

  it("4. CO residential_homestead → 400 'homestead_not_supported'", async () => {
    const res = await POST(mkReq(baseBody({ property_type: 'residential_homestead' })))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('homestead_not_supported')
  })

  it('5. TX commercial valid (original contractor) → 200', async () => {
    const res = await POST(mkReq(baseBody({
      state_code: 'TX', property_state: 'TX', property_county: 'dallas', property_city: 'Dallas',
      property_type: 'commercial', contractor_role: 'original_contractor',
    })))
    expect(res.status).toBe(200)
  })

  it('6. TX commercial subcontractor recent last_day → 200 + § 53.056 warning', async () => {
    const res = await POST(mkReq(baseBody({
      state_code: 'TX', property_state: 'TX', property_county: 'dallas', property_city: 'Dallas',
      property_type: 'commercial', contractor_role: 'subcontractor',
    })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.warnings.some((w: string) => /§ 53\.056/.test(w))).toBe(true)
  })

  it("7. TX residential_non_homestead → 400 'tx_v0_requires_commercial'", async () => {
    const res = await POST(mkReq(baseBody({
      state_code: 'TX', property_state: 'TX', property_county: 'dallas', property_city: 'Dallas',
      property_type: 'residential_non_homestead',
    })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('tx_v0_requires_commercial')
  })

  it("8. TX residential_homestead → 400 'homestead_not_supported'", async () => {
    const res = await POST(mkReq(baseBody({
      state_code: 'TX', property_state: 'TX', property_county: 'dallas', property_city: 'Dallas',
      property_type: 'residential_homestead', is_homestead: true,
    })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('homestead_not_supported')
  })

  it("9. TX + is_homestead=true → 400 'homestead_not_supported'", async () => {
    const res = await POST(mkReq(baseBody({
      state_code: 'TX', property_state: 'TX', property_county: 'dallas', property_city: 'Dallas',
      property_type: 'commercial', is_homestead: true,
    })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('homestead_not_supported')
  })

  it("10. Past-deadline CO (last_day 5 months ago) → 400 'past_filing_deadline'", async () => {
    const today = new Date()
    const last  = new Date(today); last.setUTCMonth(last.getUTCMonth() - 5)
    const first = new Date(last);  first.setUTCMonth(first.getUTCMonth() - 1)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const res = await POST(mkReq(baseBody({
      first_day_of_work: iso(first),
      last_day_of_work:  iso(last),
    })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('past_filing_deadline')
  })

  it('11. amount_owed_cents=0 → 400', async () => {
    const res = await POST(mkReq(baseBody({ amount_owed_cents: 0 })))
    expect(res.status).toBe(400)
  })

  it("12. state_code='AZ' → 400 invalid_input (zod)", async () => {
    const res = await POST(mkReq(baseBody({ state_code: 'AZ', property_state: 'AZ' })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/invalid_input|state_not_supported/)
  })

  it('13. missing STRIPE_PRICE env → 500', async () => {
    delete process.env.STRIPE_PRICE_COLLECTIONS_ASSIST
    const res = await POST(mkReq(baseBody()))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('stripe_price_not_configured')
  })

  it('14. unauth → 401', async () => {
    authedUser = null
    const res = await POST(mkReq(baseBody()))
    expect(res.status).toBe(401)
  })
})
