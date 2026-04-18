/**
 * All 10 legal pages return 200 and contain the required boilerplate
 * (FCRA non-applicability framing, no-sale commitment, counsel stamp slot).
 */
import { test, expect } from '@playwright/test'

const LEGAL_PAGES: Array<{ url: string; mustContain: string[] }> = [
  { url: '/groundcheck/methodology',     mustContain: ['Methodology', 'Four badges', 'Score bands'] },
  { url: '/groundcheck/privacy',         mustContain: ['Privacy Policy', 'We do not sell'] },
  { url: '/groundcheck/terms',           mustContain: ['Terms of Service', 'FCRA', 'arbitration'] },
  { url: '/groundcheck/legal/fcra',      mustContain: ['FCRA Notice', 'not consumers', 'Prohibited'] },
  { url: '/groundcheck/legal/ca',        mustContain: ['CCPA', 'no-sale', 'California'] },
  { url: '/groundcheck/legal/ny',        mustContain: ['SHIELD', 'breach', 'New York'] },
  { url: '/groundcheck/legal/il',        mustContain: ['BIPA', 'biometrics', 'Illinois'] },
  { url: '/groundcheck/legal/wa',        mustContain: ['My Health My Data', 'Washington'] },
  { url: '/groundcheck/disputes',        mustContain: ['Dispute Process', '7 business days', '30 days'] },
  { url: '/groundcheck/responses-policy', mustContain: ['Response Policy', 'Moderation', 'Appeal'] },
  { url: '/groundcheck/cookies',         mustContain: ['Cookie Policy', 'Essential'] },
]

test.describe('Legal pages — boilerplate + PENDING stamps', () => {
  for (const p of LEGAL_PAGES) {
    test(`${p.url} returns 200 + required boilerplate`, async ({ page }) => {
      const res = await page.goto(p.url)
      expect(res?.status()).toBe(200)
      for (const text of p.mustContain) {
        await expect(page.getByText(new RegExp(text, 'i'))).toBeVisible()
      }
      // Reviewed-by stamp slot present on every page
      await expect(page.getByText(/PENDING/i)).toBeVisible()
      // DraftBanner (unapproved) present — will disappear when approved.json flips
      await expect(page.getByText(/DRAFT — This page is pending/i)).toBeVisible()
    })
  }
})
