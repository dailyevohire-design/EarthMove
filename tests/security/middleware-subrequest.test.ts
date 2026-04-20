import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock supabase before importing the route. createClient returns a null user so
// the auth/profile block is short-circuited; createAdminClient rpc/insert are
// no-ops so any path that reaches DB code returns cleanly.
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  }),
  createAdminClient: () => ({
    rpc: async () => ({ data: null, error: null }),
    from: () => ({
      insert: () => ({
        select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }),
}))

import { POST } from '@/app/api/trust/route'

describe('CVE-2025-29927 defense-in-depth', () => {
  it('rejects x-middleware-subrequest header at route handler', async () => {
    const req = new NextRequest('http://localhost/api/trust', {
      method: 'POST',
      headers: {
        'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ contractor_name: 'ACME', state_code: 'CO', city: 'Denver' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('malformed_request')
  })

  it('allows requests without the header', async () => {
    const req = new NextRequest('http://localhost/api/trust', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contractor_name: 'ACME', state_code: 'CO', city: 'Denver' }),
    })
    const res = await POST(req)
    const body = await res.json()
    // The header check must NOT fire. Downstream may 429/400/500 for unrelated
    // reasons, but the 'malformed_request' signal belongs exclusively to the
    // CVE defense.
    expect(body.error).not.toBe('malformed_request')
  })
})
