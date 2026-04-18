/**
 * Access gate verification — critical security path.
 *
 * (a) Anon GET /groundcheck/report/[id] redirects to /login.
 * (b) Authed user without grant sees AccessRequired, findings NOT in HTML.
 * (c) Cross-user cannot see another user's watches / credits / alerts.
 * (d) Share link expires after 72h (or when revoked — tests revoke path).
 * (e) Revoked share link returns not-found.
 */
import { test, expect } from '@playwright/test'

const REPORT_ID = process.env.TEST_REPORT_ID ?? '00000000-0000-0000-0000-000000000000'

test.describe('Access gates — defense in depth', () => {
  test('anon → /login redirect on authed report URL', async ({ page }) => {
    await page.goto(`/groundcheck/report/${REPORT_ID}`, { waitUntil: 'domcontentloaded' })
    expect(page.url()).toMatch(/\/login\?next=.+groundcheck.+report/)
  })

  test('authed user without grant sees AccessRequired; findings NOT in HTML', async ({ page, context }) => {
    await context.addCookies([{
      name: 'sb-no-access-auth-token', value: 'no-access-user',
      domain: new URL(page.url() || 'http://localhost:3000').hostname, path: '/',
    }])
    await page.goto(`/groundcheck/report/${REPORT_ID}`)
    await expect(page.getByText(/Paid access required|Your access expired|Upgrade required/i)).toBeVisible({ timeout: 10_000 })
    const html = await page.content()
    // Strict HTML-grep: no findings, no red-flag entries leaking
    expect(html).not.toMatch(/"red_flags"\s*:/i)
    expect(html).not.toMatch(/"positive_indicators"\s*:/i)
    expect(html).not.toMatch(/"raw_report"\s*:/i)
  })

  test('cross-user watch access returns 403 or 404', async ({ request, context }) => {
    const otherWatchId = process.env.TEST_OTHER_USER_WATCH_ID
    test.skip(!otherWatchId, 'TEST_OTHER_USER_WATCH_ID required')
    await context.addCookies([{
      name: 'sb-test-auth-token', value: 'user-B',
      domain: new URL('http://localhost:3000').hostname, path: '/',
    }])
    const res = await request.post(`/api/groundcheck/prehire/${otherWatchId}/pause`)
    expect([403, 404]).toContain(res.status())
  })

  test('revoked share link is not accessible', async ({ page }) => {
    const revokedToken = process.env.TEST_REVOKED_SHARE_TOKEN
    test.skip(!revokedToken, 'TEST_REVOKED_SHARE_TOKEN required')
    await page.goto(`/groundcheck/share/${revokedToken}`)
    // App renders a 404-style page on invalid/revoked/expired tokens
    await expect(page.getByText(/not found|404|expired/i)).toBeVisible({ timeout: 10_000 })
  })
})
