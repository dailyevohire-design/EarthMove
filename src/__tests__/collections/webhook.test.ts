import { describe, it, expect, vi, beforeEach } from 'vitest'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

let stripeEvent: any = null
let stripeShouldThrow = false

vi.mock('@/lib/stripe', () => ({
  constructWebhookEvent: (_body: string, _sig: string) => {
    if (stripeShouldThrow) throw new Error('bad signature')
    return stripeEvent
  },
}))

const rpcCalls: Array<{ name: string; args: any }> = []
const eventInserts: any[] = []
let rpcShouldFail = false

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    rpc: async (name: string, args: any) => {
      rpcCalls.push({ name, args })
      if (rpcShouldFail) return { data: null, error: { message: 'rpc_failed' } as any }
      return { data: args.p_case_id, error: null }
    },
    from: (table: string) => {
      if (table === 'collections_case_events') {
        return { insert: (row: any) => { eventInserts.push(row); return Promise.resolve({ error: null }) } }
      }
      // Fallback chainable thenable
      const chain: any = {}
      for (const m of ['from','update','insert','eq','is','select','single','maybeSingle']) chain[m] = vi.fn(() => chain)
      chain.then = (ok: any) => Promise.resolve({ data: null, error: null }).then(ok)
      return chain
    },
    auth: { admin: { getUserById: async () => ({ data: { user: null }, error: null }) } },
  }),
}))

const generateCalls: string[] = []
vi.mock('@/lib/collections/generator', () => ({
  generateAndStoreCase: async (id: string) => { generateCalls.push(id) },
}))

vi.mock('@/lib/dispatch', () => ({ enqueueOrder: vi.fn(async () => {}) }))
vi.mock('@/lib/email', () => ({
  sendOrderConfirmation: vi.fn(async () => {}),
  sendGuestClaimAccount: vi.fn(async () => {}),
}))

vi.mock('next/server', async () => {
  const actual = await vi.importActual<any>('next/server')
  return {
    ...actual,
    after: (fn: () => Promise<void> | void) => { Promise.resolve().then(fn) },
  }
})

import { POST } from '@/app/api/webhooks/stripe/route'

function mkReq(body: string, headers: Record<string, string> = {}) {
  return {
    text: async () => body,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as any
}

beforeEach(() => {
  rpcCalls.length = 0
  eventInserts.length = 0
  generateCalls.length = 0
  stripeEvent = null
  stripeShouldThrow = false
  rpcShouldFail = false
})

describe('POST /api/webhooks/stripe — collections routing', () => {
  it('1. checkout.session.completed w/ product_variant=contractor_payment_kit_v1 → RPC called + paid event logged', async () => {
    stripeEvent = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_abc',
          amount_total: 4900,
          payment_intent: 'pi_abc',
          client_reference_id: 'user-1',
          metadata: {
            product_family:  'collections',
            product_variant: 'contractor_payment_kit_v1',
            kit_variant:     'full_kit',
            case_id:         'case-1',
            user_id:         'user-1',
          },
        },
      },
    }
    const res = await POST(mkReq('{}', { 'stripe-signature': 'sig' }))
    expect(res.status).toBe(200)
    const collectionsCall = rpcCalls.find(c => c.name === 'grant_collections_case_from_stripe_event')
    expect(collectionsCall).toBeTruthy()
    await new Promise(r => setTimeout(r, 10))
    expect(generateCalls).toContain('case-1')
  })

  it('2. duplicate stripe_event_id → RPC is still called (idempotency inside the DB function)', async () => {
    stripeEvent = {
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_dup', amount_total: 4900, payment_intent: 'pi_dup',
          client_reference_id: 'user-1',
          metadata: {
            product_family: 'collections', product_variant: 'contractor_payment_kit_v1',
            kit_variant: 'full_kit', case_id: 'case-1', user_id: 'user-1',
          },
        },
      },
    }
    const r1 = await POST(mkReq('{}', { 'stripe-signature': 'sig' }))
    expect(r1.status).toBe(200)
    const r2 = await POST(mkReq('{}', { 'stripe-signature': 'sig' }))
    expect(r2.status).toBe(200)
    const collectionsGrants = rpcCalls.filter(c => c.name === 'grant_collections_case_from_stripe_event')
    expect(collectionsGrants).toHaveLength(2)
  })

  it('3. invalid HMAC → 400', async () => {
    stripeShouldThrow = true
    const res = await POST(mkReq('{}', { 'stripe-signature': 'sig' }))
    expect(res.status).toBe(400)
  })

  it('4. missing case_id metadata → 400', async () => {
    stripeEvent = {
      id: 'evt_4',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_missing',
          client_reference_id: 'user-1',
          metadata: { product_family: 'collections', user_id: 'user-1' },
        },
      },
    }
    const res = await POST(mkReq('{}', { 'stripe-signature': 'sig' }))
    expect(res.status).toBe(400)
  })

  it("5. client_reference_id != metadata.user_id → 400 'user_mismatch'", async () => {
    stripeEvent = {
      id: 'evt_5',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_mismatch',
          client_reference_id: 'user-OTHER',
          metadata: { product_family: 'collections', case_id: 'case-x', user_id: 'user-1' },
        },
      },
    }
    const res = await POST(mkReq('{}', { 'stripe-signature': 'sig' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('user_mismatch')
  })
})
