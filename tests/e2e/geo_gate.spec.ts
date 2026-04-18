/**
 * Geo-gate banner renders when X-Vercel-IP-Country-Region is in the
 * restricted set. Link points to /groundcheck/legal/[state] which Agent 9
 * implemented.
 */
import { test, expect } from '@playwright/test'

const SEEDED_SLUG = process.env.TEST_SEEDED_CONTRACTOR_SLUG ?? 'acme-home-remodel-co'
const CASES: Array<{ region: string; stateName: string; legalSlug: string }> = [
  { region: 'CA', stateName: 'California', legalSlug: 'ca' },
  { region: 'NY', stateName: 'New York',   legalSlug: 'ny' },
  { region: 'IL', stateName: 'Illinois',   legalSlug: 'il' },
  { region: 'WA', stateName: 'Washington', legalSlug: 'wa' },
]

for (const c of CASES) {
  test(`geo gate for ${c.stateName}`, async ({ context, page }) => {
    await context.setExtraHTTPHeaders({ 'x-vercel-ip-country-region': c.region })
    await page.goto(`/groundcheck/c/${SEEDED_SLUG}`)
    await expect(page.getByText(/Additional state restrictions/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /See Methodology|Methodology/i })).toBeVisible()
  })
}
