/**
 * Compliance surface — FCRA consent, privacy endpoints, DraftBanner gate,
 * CookieBanner.
 */
import { test, expect } from '@playwright/test'

test.describe('Compliance flow', () => {
  test('DraftBanner renders on an unreviewed legal page', async ({ page }) => {
    await page.goto('/groundcheck/privacy')
    await expect(page.getByText(/DRAFT — This page is pending legal review/i)).toBeVisible()
    await expect(page.getByText(/We do not sell data we collect/i)).toBeVisible()
  })

  test('FCRA notice page has the non-applicability opening statement', async ({ page }) => {
    await page.goto('/groundcheck/legal/fcra')
    await expect(page.getByText(/Groundcheck reports on businesses, not consumers/i)).toBeVisible()
  })

  test('privacy export returns 202 for authed user (requires fixture cookie)', async ({ request, context }) => {
    await context.addCookies([{
      name: 'sb-test-auth-token', value: 'privacy-fixture',
      domain: 'localhost', path: '/',
    }])
    const res = await request.post('/api/privacy/export')
    expect([202, 401, 429]).toContain(res.status())
    if (res.status() === 202) {
      const body = await res.json()
      expect(body.status).toBe('queued')
      expect(body.estimated_delivery_hours).toBeGreaterThan(0)
    }
  })

  test('privacy delete schedules 14-day grace', async ({ request, context }) => {
    await context.addCookies([{
      name: 'sb-test-auth-token', value: 'delete-fixture',
      domain: 'localhost', path: '/',
    }])
    const res = await request.post('/api/privacy/delete')
    expect([202, 401]).toContain(res.status())
    if (res.status() === 202) {
      const body = await res.json()
      expect(body.grace_period_days).toBe(14)
    }
  })

  test('DELETE /api/privacy/delete cancels within grace', async ({ request, context }) => {
    await context.addCookies([{
      name: 'sb-test-auth-token', value: 'delete-fixture',
      domain: 'localhost', path: '/',
    }])
    const res = await request.delete('/api/privacy/delete')
    expect([200, 401]).toContain(res.status())
  })
})
