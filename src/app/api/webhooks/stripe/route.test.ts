// src/app/api/webhooks/stripe/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────

let stripeEvent: any = null
let stripeShouldThrow = false

vi.mock('@/lib/stripe', () => ({
  constructWebhookEvent: (_body: string, _sig: string) => {
    if (stripeShouldThrow) throw new Error('bad signature')
    return stripeEvent
  },
}))

// Supabase admin client: chainable thenable stub.
// Tests can override returnedOrder to simulate the idempotency guard.
let returnedOrder: any = null
const auditInserts: any[] = []

function makeQueryBuilder(finalValue: any) {
  const chain: any = {}
  const methods = ['from', 'update', 'insert', 'eq', 'is', 'select', 'single', 'maybeSingle']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  // Make it awaitable — returns { data, error }
  chain.then = (onFulfilled: any) => Promise.resolve(finalValue).then(onFulfilled)
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => {
    // Return a stateful client that remembers audit inserts
    return {
      from: (table: string) => {
        if (table === 'audit_events') {
          return {
            insert: (row: any) => {
              auditInserts.push(row)
              return Promise.resolve({ error: null })
            },
          }
        }
        if (table === 'orders') {
          const qb: any = makeQueryBuilder({ data: returnedOrder, error: null })
          return qb
        }
        if (table === 'profiles') {
          return makeQueryBuilder({ data: null, error: null })
        }
        return makeQueryBuilder({ data: null, error: null })
      },
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: null }, error: null }),
        },
      },
    }
  },
}))

const enqueueOrderMock = vi.fn(async () => {})
vi.mock('@/lib/dispatch', () => ({
  enqueueOrder: (o: any) => enqueueOrderMock(o),
}))

vi.mock('@/lib/email', () => ({
  sendOrderConfirmation: vi.fn(async () => {}),
  sendGuestClaimAccount: vi.fn(async () => {}),
}))

// `after()` is a Next.js Fluid Compute primitive — just run the callback now.
vi.mock('next/server', async () => {
  const actual = await vi.importActual<any>('next/server')
  return {
    ...actual,
    after: (fn: () => Promise<void> | void) => {
      // Fire and forget in tests
      Promise.resolve().then(fn)
    },
  }
})

// Import AFTER mocks
import { POST } from './route'

// Minimal NextRequest stub
function makeReq(body: string, headers: Record<string, string> = {}) {
  return {
    text: async () => body,
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? null,
    },
  } as any
}

beforeEach(() => {
  stripeEvent = null
  stripeShouldThrow = false
  returnedOrder = null
  auditInserts.length = 0
  enqueueOrderMock.mockClear()
  enqueueOrderMock.mockImplementation(async () => {})
})

describe('POST /api/webhooks/stripe', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/signature/i)
  })

  it('returns 400 when signature verification throws', async () => {
    stripeShouldThrow = true
    const res = await POST(makeReq('{}', { 'stripe-signature': 'bad' }))
    expect(res.status).toBe(400)
  })

  it('returns 200 and ignores events with unknown types', async () => {
    stripeEvent = { type: 'customer.updated', data: { object: {} } }
    const res = await POST(makeReq('{}', { 'stripe-signature': 'good' }))
    expect(res.status).toBe(200)
    expect(enqueueOrderMock).not.toHaveBeenCalled()
  })

  it('does not enqueue when the order was already processed (idempotency guard)', async () => {
    // returnedOrder = null simulates the .single() returning no row because
    // the status guard didn't match — already-processed order.
    returnedOrder = null
    stripeEvent = {
      type: 'checkout.session.completed',
      data: { object: { metadata: { order_id: 'o1' }, payment_intent: 'pi_1', id: 'cs_1' } },
    }
    const res = await POST(makeReq('{}', { 'stripe-signature': 'good' }))
    expect(res.status).toBe(200)
    expect(enqueueOrderMock).not.toHaveBeenCalled()
  })

  it('enqueues and writes audit events when a new confirmed order is processed', async () => {
    returnedOrder = { id: 'o1', customer_id: null, guest_email: 'g@example.com' }
    stripeEvent = {
      type: 'checkout.session.completed',
      data: { object: { metadata: { order_id: 'o1' }, payment_intent: 'pi_1', id: 'cs_1', amount_total: 1000 } },
    }
    const res = await POST(makeReq('{}', { 'stripe-signature': 'good' }))
    expect(res.status).toBe(200)
    expect(enqueueOrderMock).toHaveBeenCalledOnce()
    expect(auditInserts.some(a => a.event_type === 'order.payment_confirmed')).toBe(true)
  })

  it('logs a dispatch_failed audit event and STILL returns 200 when enqueue throws', async () => {
    // Must not bubble — otherwise Stripe retries and the idempotency guard
    // prevents re-processing, orphaning the order forever.
    returnedOrder = { id: 'o1', customer_id: null, guest_email: 'g@example.com' }
    enqueueOrderMock.mockImplementationOnce(async () => {
      throw new Error('dispatch db down')
    })
    stripeEvent = {
      type: 'checkout.session.completed',
      data: { object: { metadata: { order_id: 'o1' }, payment_intent: 'pi_1', id: 'cs_1', amount_total: 1000 } },
    }
    const res = await POST(makeReq('{}', { 'stripe-signature': 'good' }))
    expect(res.status).toBe(200)
    expect(auditInserts.some(a => a.event_type === 'order.dispatch_failed')).toBe(true)
  })
})
