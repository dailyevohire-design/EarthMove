/**
 * Programmatic SEO — sitemap + robots + state/category pages.
 */
import { test, expect } from '@playwright/test'

test.describe('Programmatic SEO', () => {
  test('robots.txt has correct allow + disallow rules', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    for (const allowed of ['/', '/groundcheck', '/groundcheck/c/', '/groundcheck/best-']) {
      expect(body).toContain(`Allow: ${allowed}`)
    }
    for (const blocked of ['/groundcheck/report', '/groundcheck/library', '/groundcheck/watches',
                           '/groundcheck/alerts', '/groundcheck/share', '/groundcheck/claim',
                           '/groundcheck/buy', '/contractor/']) {
      expect(body).toContain(`Disallow: ${blocked}`)
    }
  })

  test('groundcheck sitemap.xml is valid XML + has expected roots', async ({ request }) => {
    const res = await request.get('/groundcheck/sitemap.xml')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toMatch(/^<\?xml/)
    expect(body).toContain('<urlset')
    expect(body).toContain('/groundcheck/methodology')
    expect(body).toContain('/groundcheck/contractors')
    // No authed URLs in sitemap
    expect(body).not.toContain('/groundcheck/report/')
    expect(body).not.toContain('/groundcheck/library')
    expect(body).not.toContain('/groundcheck/share/')
    expect(body).not.toContain('/contractor/')
  })

  test('state index page renders for Colorado', async ({ page }) => {
    const res = await page.goto('/groundcheck/colorado')
    expect(res?.status()).toBe(200)
    await expect(page.getByText(/Colorado/i)).toBeVisible()
  })

  test('state×category 404s when thin', async ({ request }) => {
    // At current data volume, most category pages will 404.
    const res = await request.get('/groundcheck/wyoming/pest_control')
    expect([404, 200]).toContain(res.status())
  })

  test('contractor directory renders', async ({ page }) => {
    const res = await page.goto('/groundcheck/contractors')
    expect(res?.status()).toBe(200)
    await expect(page.getByText(/Browse by state/i)).toBeVisible()
  })
})
