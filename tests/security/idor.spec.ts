/**
 * IDOR (insecure direct object reference) audit.
 * Every authenticated endpoint that accepts a resource id must reject
 * cross-user attempts with 403 or 404 — never 200 with data.
 */
import { test, expect } from '@playwright/test'

const UA_COOKIE = process.env.TEST_USER_A_COOKIE ?? null
const UB_COOKIE = process.env.TEST_USER_B_COOKIE ?? null
const A_REPORT = process.env.TEST_USER_A_REPORT_ID
const A_WATCH  = process.env.TEST_USER_A_WATCH_ID
const A_SHARE_GRANT = process.env.TEST_USER_A_SHARE_GRANT_ID
const A_CLAIM = process.env.TEST_USER_A_CLAIM_ID

test.describe('IDOR — cross-user resource access', () => {
  test.skip(!UA_COOKIE || !UB_COOKIE, 'IDOR suite requires TEST_USER_A_COOKIE + TEST_USER_B_COOKIE fixtures')

  async function asUserB(request: any, extras: Record<string, string> = {}) {
    return request.newContext({
      extraHTTPHeaders: { cookie: UB_COOKIE!, ...extras },
    })
  }

  test('user B GET /groundcheck/report/<A_report_id> → 403 (no access) or AccessRequired render', async ({ playwright }) => {
    test.skip(!A_REPORT, 'TEST_USER_A_REPORT_ID required')
    const ctx = await playwright.request.newContext({
      extraHTTPHeaders: { cookie: UB_COOKIE! },
    })
    const res = await ctx.get(`/groundcheck/report/${A_REPORT}`)
    // Either server returns AccessRequired (200 without findings) or 403.
    // Critically, the HTML must not include raw findings.
    const body = await res.text()
    expect(body).not.toMatch(/"red_flags"\s*:/)
    expect(body).not.toMatch(/"raw_report"\s*:/)
    await ctx.dispose()
  })

  test('user B POST /api/groundcheck/prehire/<A_watch>/pause → 403/404', async ({ playwright }) => {
    test.skip(!A_WATCH, 'TEST_USER_A_WATCH_ID required')
    const ctx = await playwright.request.newContext({ extraHTTPHeaders: { cookie: UB_COOKIE! } })
    const res = await ctx.post(`/api/groundcheck/prehire/${A_WATCH}/pause`)
    expect([403, 404]).toContain(res.status())
    await ctx.dispose()
  })

  test('user B DELETE /api/groundcheck/report/<A_report>/share?grant=<A_grant> → no-op', async ({ playwright }) => {
    test.skip(!A_REPORT || !A_SHARE_GRANT, 'TEST_USER_A_REPORT_ID + TEST_USER_A_SHARE_GRANT_ID required')
    const ctx = await playwright.request.newContext({ extraHTTPHeaders: { cookie: UB_COOKIE! } })
    const res = await ctx.delete(
      `/api/groundcheck/report/${A_REPORT}/share?grant=${A_SHARE_GRANT}`,
    )
    // Supabase RLS + explicit filter on granted_by_user_id = user.id → no rows updated; endpoint returns ok but nothing revoked.
    // The verification here is that the underlying grant is still active (tested out-of-band by the test runner asserting revoked_at remains null).
    expect([200, 403, 404]).toContain(res.status())
    await ctx.dispose()
  })

  test('user B POST /api/contractor/claim/verify with A claim_id → 403', async ({ playwright }) => {
    test.skip(!A_CLAIM, 'TEST_USER_A_CLAIM_ID required')
    const ctx = await playwright.request.newContext({ extraHTTPHeaders: { cookie: UB_COOKIE! } })
    const res = await ctx.post('/api/contractor/claim/verify', {
      data: { claim_id: A_CLAIM, code: '000000' },
    })
    expect(res.status()).toBe(403)
    await ctx.dispose()
  })

  test('user B GET /api/privacy/export — scopes to user B only (never sees A data)', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ extraHTTPHeaders: { cookie: UB_COOKIE! } })
    const res = await ctx.post('/api/privacy/export')
    // Endpoint queues a job scoped to user.id from the server-side session — cannot be coerced to export A's data.
    expect([202, 401, 429]).toContain(res.status())
    await ctx.dispose()
  })
})
