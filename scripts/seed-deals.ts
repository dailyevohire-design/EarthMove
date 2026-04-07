/**
 * Seed promotions for the /deals page so DealSlider + DealGrid have data to render.
 *
 * For each active market, picks up to 7 visible materials that have a preferred
 * offering with an image, and creates promotions:
 *   - 1 Deal of the Day (percentage, biggest discount, 24h)
 *   - 2 Flash Sale (flat_amount, ~6h)
 *   - 2 Contractor Deal (percentage, 48h)
 *   - 2 Weekend Only (price_override, until Sunday)
 *
 * Idempotent: re-running updates in-place using (market_id, title) as the key.
 *
 * Run:  npx tsx scripts/seed-deals.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
})

type PromoSpec = {
  title: string
  badge_label: string
  is_deal_of_day: boolean
  promotion_type: 'percentage' | 'flat_amount' | 'price_override'
  discount_value?: number
  override_price_fn?: (basePrice: number) => number
  durationHours: number
}

function endOfWeekend(): Date {
  // Sunday 23:59 local
  const d = new Date()
  const day = d.getDay() // 0=Sun
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + daysUntilSunday)
  d.setHours(23, 59, 0, 0)
  return d
}

async function seedMarket(marketId: string, marketName: string) {
  console.log(`\n→ ${marketName} (${marketId})`)

  // Find up to 7 visible materials with a preferred, active offering that has an image.
  // Use a single join query so we don't N+1.
  const { data: candidates, error: candErr } = await supabase
    .from('market_materials')
    .select(`
      id,
      material_catalog_id,
      price_display_mode,
      custom_display_price,
      material_catalog ( id, name, slug, default_unit ),
      market_supply_pool!inner (
        is_preferred,
        is_active,
        offering:supplier_offerings!inner (
          id,
          price_per_unit,
          unit,
          image_url
        )
      )
    `)
    .eq('market_id', marketId)
    .eq('is_visible', true)
    .eq('market_supply_pool.is_preferred', true)
    .eq('market_supply_pool.is_active', true)
    .not('market_supply_pool.offering.image_url', 'is', null)
    .limit(12)

  if (candErr) {
    console.error('  candidate query failed:', candErr.message)
    return
  }
  if (!candidates || candidates.length === 0) {
    console.warn('  no eligible materials (need visible + preferred offering + image_url)')
    return
  }

  // Normalize + dedupe by material_catalog_id
  const seen = new Set<string>()
  const picks: Array<{
    marketMaterialId: string
    materialCatalogId: string
    offeringId: string
    name: string
    basePrice: number
  }> = []

  for (const row of candidates as any[]) {
    const mc = row.material_catalog
    const pool = Array.isArray(row.market_supply_pool) ? row.market_supply_pool[0] : row.market_supply_pool
    const offering = pool?.offering
    if (!mc || !offering?.price_per_unit) continue
    if (seen.has(mc.id)) continue
    seen.add(mc.id)

    const displayPrice =
      row.price_display_mode === 'custom' && row.custom_display_price != null
        ? Number(row.custom_display_price)
        : Number(offering.price_per_unit)

    picks.push({
      marketMaterialId: row.id,
      materialCatalogId: mc.id,
      offeringId: offering.id,
      name: mc.name,
      basePrice: displayPrice,
    })
    if (picks.length >= 7) break
  }

  if (picks.length === 0) {
    console.warn('  no candidates after filtering')
    return
  }

  console.log(`  ${picks.length} materials eligible: ${picks.map(p => p.name).join(', ')}`)

  // Assign a promo spec to each pick based on position
  const specs: PromoSpec[] = [
    { title: 'Deal of the Day',          badge_label: 'DEAL OF THE DAY', is_deal_of_day: true,  promotion_type: 'percentage',    discount_value: 25, durationHours: 24 },
    { title: 'Flash Sale',               badge_label: 'FLASH SALE',      is_deal_of_day: false, promotion_type: 'flat_amount',   discount_value: 8,  durationHours: 6 },
    { title: 'Flash Sale',               badge_label: 'FLASH SALE',      is_deal_of_day: false, promotion_type: 'flat_amount',   discount_value: 12, durationHours: 6 },
    { title: 'Contractor Deal',          badge_label: 'CONTRACTOR',      is_deal_of_day: false, promotion_type: 'percentage',    discount_value: 15, durationHours: 48 },
    { title: 'Contractor Deal',          badge_label: 'CONTRACTOR',      is_deal_of_day: false, promotion_type: 'percentage',    discount_value: 20, durationHours: 48 },
    { title: 'Weekend Only',             badge_label: 'WEEKEND ONLY',    is_deal_of_day: false, promotion_type: 'price_override', override_price_fn: (p) => Math.max(1, Math.round((p * 0.75) * 100) / 100), durationHours: 0 },
    { title: 'Weekend Only',             badge_label: 'WEEKEND ONLY',    is_deal_of_day: false, promotion_type: 'price_override', override_price_fn: (p) => Math.max(1, Math.round((p * 0.70) * 100) / 100), durationHours: 0 },
  ]

  const now = new Date()
  const weekendEnd = endOfWeekend()

  // Build rows to upsert
  const rows = picks.map((pick, i) => {
    const spec = specs[i]!
    const endsAt =
      spec.durationHours > 0
        ? new Date(now.getTime() + spec.durationHours * 3600 * 1000)
        : weekendEnd

    const base: Record<string, unknown> = {
      market_id:           marketId,
      material_catalog_id: pick.materialCatalogId,
      offering_id:         pick.offeringId,
      title:               `${spec.title}: ${pick.name}`,
      description:         null,
      badge_label:         spec.badge_label,
      is_deal_of_day:      spec.is_deal_of_day,
      promotion_type:      spec.promotion_type,
      discount_value:      null,
      override_price:      null,
      starts_at:           now.toISOString(),
      ends_at:             endsAt.toISOString(),
      is_active:           true,
      updated_at:          now.toISOString(),
    }

    if (spec.promotion_type === 'price_override' && spec.override_price_fn) {
      base.override_price = spec.override_price_fn(pick.basePrice)
    } else if (spec.discount_value != null) {
      base.discount_value = spec.discount_value
    }

    return base
  })

  // Idempotent: delete any of our seeded titles for this market first, then insert.
  // (We don't have a unique constraint on (market_id, title), so upsert via onConflict
  //  isn't available without a migration.)
  const titles = rows.map(r => r.title as string)
  const { error: delErr } = await supabase
    .from('promotions')
    .delete()
    .eq('market_id', marketId)
    .in('title', titles)

  if (delErr) {
    console.error('  delete-before-insert failed:', delErr.message)
    return
  }

  const { error: insErr, count } = await supabase
    .from('promotions')
    .insert(rows, { count: 'exact' })

  if (insErr) {
    console.error('  insert failed:', insErr.message)
    return
  }

  console.log(`  ✓ inserted ${count ?? rows.length} promotions`)
}

async function main() {
  const { data: markets, error } = await supabase
    .from('markets')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Failed to load markets:', error.message)
    process.exit(1)
  }
  if (!markets || markets.length === 0) {
    console.error('No active markets found.')
    process.exit(1)
  }

  console.log(`Seeding deals for ${markets.length} markets…`)
  for (const m of markets) {
    await seedMarket(m.id, m.name)
  }
  console.log('\nDone.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
