import { describe, it, expect, vi, beforeEach } from 'vitest'

// -----------------------------------------------------------------------------
// Mocks. Declared up top (hoisted) so the route imports get the shims.
// -----------------------------------------------------------------------------

let rpcImpl: (name: string, args: any) => Promise<{ data: any; error: any }> = async () => ({ data: null, error: null })
const rpcCalls: Array<{ name: string; args: any }> = []
const fromCalls: Array<{ table: string }> = []
let auditInserts: any[] = []
let authedUser: any = { id: 'user-1', email: 'test@earthmove.io' }
let profileData: any = { role: 'authenticated', is_active: true }

function makeQb(finalValue: any) {
  const chain: any = {}
  const methods = ['select', 'eq', 'is', 'single', 'maybeSingle', 'order', 'limit', 'update', 'insert']
  for (const m of methods) chain[m] = vi.fn(() => chain)
  chain.then = (ok: any) => Promise.resolve(finalValue).then(ok)
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: authedUser }, error: null }) },
    from: (table: string) => {
      fromCalls.push({ table })
      if (table === 'profiles') return makeQb({ data: profileData, error: null })
      return makeQb({ data: null, error: null })
    },
  }),
  createAdminClient: () => ({
    from: (table: string) => {
      fromCalls.push({ table })
      if (table === 'profiles') return makeQb({ data: profileData, error: null })
      if (table === 'trust_audit_log') {
        return {
          insert: (row: any) => { auditInserts.push(row); return Promise.resolve({ error: null }) },
        }
      }
      if (table === 'trust_reports' || table === 'trust_api_usage') {
        return {
          insert: (_row: any) => makeQb({ data: { id: 'report-1' }, error: null }),
        }
      }
      return makeQb({ data: null, error: null })
    },
    rpc: async (name: string, args: any) => {
      rpcCalls.push({ name, args })
      return rpcImpl(name, args)
    },
  }),
}))

// Prompt guards — pass-through validator so we don't have to stand up the real one.
vi.mock('@/lib/trust/prompt-guards', () => ({
  validateInput: (name: string, city: string, state: string, hints: any) => ({
    valid: true,
    clean: { name, city, state: state.toUpperCase(), hints },
  }),
}))

// Rate limiter — allow by default.
vi.mock('@/lib/trust/rate-limiter', () => ({
  getRateLimiter: () => ({ limit: async () => ({ success: true, limit: 20, remaining: 19, reset: Date.now() + 60000 }) }),
}))

// Trust engine — never actually call Claude.
vi.mock('@/lib/trust/trust-engine', () => ({
  runFreeTier: async () => ({
    report: { trust_score: 70, risk_level: 'LOW', confidence_level: 'HIGH' },
    costUsd: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0, cacheCreationTokens: 0, piiHits: [],
  }),
}))

// Stripe mock with assertable spies.
const stripeCreateCalls: Array<{ args: any; idem?: any }> = []
const stripeRetrieveCalls: string[] = []
let stripeRetrieveImpl: (sessionId: string) => Promise<any> = async () => ({})

vi.mock('@/lib/stripe', () => ({
  stripe: () => ({
    checkout: {
      sessions: {
        create: async (args: any, opts?: any) => {
          stripeCreateCalls.push({ args, idem: opts?.idempotencyKey })
          return { id: 'cs_test_123', url: 'https://stripe.test/pay/cs_test_123' }
        },
        retrieve: async (id: string) => { stripeRetrieveCalls.push(id); return stripeRetrieveImpl(id) },
      },
    },
  }),
}))

// Feature flag — toggled per-test.
let flagEnabled = false
vi.mock('@/lib/trust/feature-flags', () => ({
  isGroundcheckCheckoutEnabled: () => flagEnabled,
}))

// -----------------------------------------------------------------------------
// Imports AFTER mocks
// -----------------------------------------------------------------------------
import { POST as trustPost }     from '@/app/api/trust/route'
import { POST as checkoutPost }  from '@/app/api/trust/checkout/route'
import { GET  as successGet }    from '@/app/api/trust/checkout/success/route'
import { assertEntityOnly, EntityOnlyError } from '@/lib/trust/trust-validator'

function jsonReq(url: string, body: any, headers: Record<string,string> = {}) {
  return {
    url,
    headers: {
      get: (k: string) => ({ origin: 'https://earthmove.io', ...headers } as any)[k.toLowerCase()] ?? null,
    },
    json: async () => body,
  } as any
}

function nextReq(url: string) {
  const u = new URL(url)
  return {
    url,
    nextUrl: u,
    headers: { get: (k: string) => (k.toLowerCase() === 'origin' ? u.origin : null) },
  } as any
}

// Cost-cap default: allow. Any rpc() call for check_trust_daily_cost_cap returns allowed.
function defaultRpc(name: string, _args: any) {
  if (name === 'check_trust_daily_cost_cap') {
    return Promise.resolve({ data: [{ allowed: true, used_usd: 0, cap_usd: 25 }], error: null })
  }
  if (name === 'check_trust_rate_limit') {
    return Promise.resolve({ data: [{ allowed: true, remaining: 99 }], error: null })
  }
  if (name === 'get_cached_trust_report' || name === 'set_cached_trust_report') {
    return Promise.resolve({ data: null, error: null })
  }
  return Promise.resolve({ data: null, error: null })
}

beforeEach(() => {
  rpcCalls.length = 0
  fromCalls.length = 0
  auditInserts.length = 0
  stripeCreateCalls.length = 0
  stripeRetrieveCalls.length = 0
  flagEnabled = false
  authedUser = { id: 'user-1', email: 'test@earthmove.io' }
  profileData = { id: 'user-1', email: 'test@earthmove.io', role: 'gc', is_active: true }
  rpcImpl = defaultRpc
  stripeRetrieveImpl = async () => ({})
})

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('assertEntityOnly', () => {
  it('throws EntityOnlyError on natural person names', () => {
    expect(() => assertEntityOnly('John Doe')).toThrow(EntityOnlyError)
  })
  it('accepts LLC/Inc/Corp', () => {
    expect(() => assertEntityOnly('Acme LLC')).not.toThrow()
    expect(() => assertEntityOnly('Bemas Construction')).not.toThrow()
    expect(() => assertEntityOnly('ABC Holdings, Inc.')).not.toThrow()
  })
})

describe('POST /api/trust — redemption branch', () => {
  it('returns 402 insufficient_credits with zero balance', async () => {
    rpcImpl = (name, args) => {
      if (name === 'redeem_credit_atomic') {
        return Promise.resolve({ data: null, error: { code: '23514', message: 'INSUFFICIENT_CREDITS' } as any })
      }
      return defaultRpc(name, args)
    }
    const res = await trustPost(jsonReq('https://earthmove.io/api/trust', {
      contractor_name: 'Acme LLC', state_code: 'CO', city: 'Denver', tier: 'standard',
    }))
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.error).toBe('insufficient_credits')
    expect(body.checkout_url).toBe('/api/trust/checkout')
  })

  it('happy path: redeems + enqueues and returns job_id', async () => {
    rpcImpl = (name, args) => {
      if (name === 'redeem_credit_atomic') {
        return Promise.resolve({ data: [{ ledger_id: 'ledger-1', new_balance: 0, already_redeemed: false }], error: null })
      }
      if (name === 'enqueue_trust_job') {
        return Promise.resolve({ data: [{ id: 'job-1' }], error: null })
      }
      return defaultRpc(name, args)
    }
    const res = await trustPost(jsonReq('https://earthmove.io/api/trust', {
      contractor_name: 'Acme LLC', state_code: 'CO', city: 'Denver', tier: 'standard',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.job_id).toBe('job-1')
    const redeemed = rpcCalls.find(c => c.name === 'redeem_credit_atomic')
    const enqueued = rpcCalls.find(c => c.name === 'enqueue_trust_job')
    expect(redeemed).toBeTruthy()
    expect(enqueued?.args.p_credit_id).toBe('ledger-1')
  })

  it('idempotent double-submit returns already_redeemed=true with same job', async () => {
    let first = true
    rpcImpl = (name, _args) => {
      if (name === 'redeem_credit_atomic') {
        if (first) {
          first = false
          return Promise.resolve({ data: [{ ledger_id: 'ledger-1', new_balance: 0, already_redeemed: false }], error: null })
        }
        return Promise.resolve({ data: [{ ledger_id: 'ledger-1', new_balance: 0, already_redeemed: true }], error: null })
      }
      if (name === 'enqueue_trust_job') return Promise.resolve({ data: [{ id: 'job-1' }], error: null })
      return defaultRpc(name, _args)
    }
    const body = { contractor_name: 'Acme LLC', state_code: 'CO', city: 'Denver', tier: 'standard', idempotency_key: 'same-key' }
    const r1 = await trustPost(jsonReq('https://earthmove.io/api/trust', body)); const j1 = await r1.json()
    const r2 = await trustPost(jsonReq('https://earthmove.io/api/trust', body)); const j2 = await r2.json()
    expect(j1.job_id).toBe('job-1')
    expect(j2.already_redeemed).toBe(true)
    expect(j2.job_id).toBe('job-1')
  })
})

describe('POST /api/trust/checkout', () => {
  it('returns 410 checkout_disabled when flag is off', async () => {
    flagEnabled = false
    const res = await checkoutPost(jsonReq('https://earthmove.io/api/trust/checkout', {
      tier: 'standard', contractor_name: 'Acme LLC', state_code: 'CO',
    }))
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error).toBe('checkout_disabled')
  })

  it('returns 422 entity_only for natural-person names, does NOT call Stripe', async () => {
    flagEnabled = true
    process.env.STRIPE_PRICE_TRUST_STANDARD = 'price_std_test'
    process.env.STRIPE_ALLOWED_ORIGINS      = 'https://earthmove.io'
    const res = await checkoutPost(jsonReq('https://earthmove.io/api/trust/checkout', {
      tier: 'standard', contractor_name: 'John Doe', state_code: 'CO',
    }))
    expect(res.status).toBe(422)
    expect(stripeCreateCalls.length).toBe(0)
  })

  it('creates a Stripe session with client_reference_id and metadata.tier', async () => {
    flagEnabled = true
    process.env.STRIPE_PRICE_TRUST_STANDARD = 'price_std_test'
    process.env.STRIPE_ALLOWED_ORIGINS      = 'https://earthmove.io'
    const res = await checkoutPost(jsonReq('https://earthmove.io/api/trust/checkout', {
      tier: 'standard', contractor_name: 'Acme LLC', state_code: 'CO',
      return_path: '/dashboard/gc/contractors',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toMatch(/stripe\.test/)
    expect(stripeCreateCalls).toHaveLength(1)
    const call = stripeCreateCalls[0].args
    expect(call.client_reference_id).toBe('user-1')
    expect(call.metadata.tier).toBe('standard')
    expect(call.metadata.contractor_name).toBe('Acme LLC')
  })

  it('sanitizes open-redirect attempts in return_path', async () => {
    flagEnabled = true
    process.env.STRIPE_PRICE_TRUST_STANDARD = 'price_std_test'
    process.env.STRIPE_ALLOWED_ORIGINS      = 'https://earthmove.io'
    const res1 = await checkoutPost(jsonReq('https://earthmove.io/api/trust/checkout', {
      tier: 'standard', contractor_name: 'Acme LLC', state_code: 'CO',
      return_path: '//evil.com',
    }))
    expect(res1.status).toBe(200)
    const call1 = stripeCreateCalls[stripeCreateCalls.length - 1].args
    expect(call1.cancel_url).toBe('https://earthmove.io/dashboard?checkout=cancelled')

    stripeCreateCalls.length = 0
    const res2 = await checkoutPost(jsonReq('https://earthmove.io/api/trust/checkout', {
      tier: 'standard', contractor_name: 'Acme LLC', state_code: 'CO',
      return_path: 'https://evil.com',
    }))
    expect(res2.status).toBe(200)
    const call2 = stripeCreateCalls[stripeCreateCalls.length - 1].args
    expect(call2.cancel_url).toBe('https://earthmove.io/dashboard?checkout=cancelled')
  })
})

describe('GET /api/trust/checkout/success', () => {
  const validSession = {
    status: 'complete',
    payment_status: 'paid',
    client_reference_id: 'user-1',
    metadata: { tier: 'standard', contractor_name: 'Acme LLC', state_code: 'CO' },
  }

  it('ready: redeems + enqueues + returns job_id (format=json)', async () => {
    stripeRetrieveImpl = async () => validSession
    rpcImpl = (name) => {
      if (name === 'redeem_credit_atomic') return Promise.resolve({ data: [{ ledger_id: 'ledger-1', new_balance: 0, already_redeemed: false }], error: null })
      if (name === 'enqueue_trust_job')   return Promise.resolve({ data: [{ id: 'job-2' }], error: null })
      return Promise.resolve({ data: null, error: null })
    }
    const res = await successGet(nextReq('https://earthmove.io/api/trust/checkout/success?session_id=cs_1&format=json'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ready')
    expect(body.job_id).toBe('job-2')
  })

  it('pending: webhook not yet landed → 202 pending (format=json)', async () => {
    stripeRetrieveImpl = async () => validSession
    rpcImpl = (name) => {
      if (name === 'redeem_credit_atomic') return Promise.resolve({ data: null, error: { code: '23514', message: 'INSUFFICIENT_CREDITS' } as any })
      return Promise.resolve({ data: null, error: null })
    }
    const res = await successGet(nextReq('https://earthmove.io/api/trust/checkout/success?session_id=cs_pending&format=json'))
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.status).toBe('pending')
  })

  it('client_reference_id mismatch → 400 session_invalid, no redemption attempted', async () => {
    stripeRetrieveImpl = async () => ({ ...validSession, client_reference_id: 'user-OTHER' })
    let redeemCalled = false
    rpcImpl = (name) => {
      if (name === 'redeem_credit_atomic') { redeemCalled = true; return Promise.resolve({ data: null, error: null }) }
      return Promise.resolve({ data: null, error: null })
    }
    const res = await successGet(nextReq('https://earthmove.io/api/trust/checkout/success?session_id=cs_wrong&format=json'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('session_invalid')
    expect(redeemCalled).toBe(false)
  })
})
