import { createClient } from '@/lib/supabase/server'
import { deriveDisplayPrice } from '@/lib/pricing-engine'

export interface DealCard {
  id: string
  title: string
  badge_label: string | null
  is_deal_of_day: boolean
  ends_at: string | null
  promotion_type: string
  discount_value: number
  material_name: string
  material_slug: string
  unit: string
  original_price: number
  deal_price: number
  image_url: string | null
  delivery_fee: number | null
}

/**
 * Returns active promotions for a market, split into the "deal of day"
 * (if any) and the rest. Used by both /deals and the homepage.
 */
export async function getDeals(
  marketId: string
): Promise<{ dealOfDay: DealCard | null; deals: DealCard[] }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: promos } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .or(`market_id.eq.${marketId},market_id.is.null`)
    .order('is_deal_of_day', { ascending: false })
    .order('created_at', { ascending: false })

  if (!promos || promos.length === 0) return { dealOfDay: null, deals: [] }

  const dealCards: DealCard[] = []
  for (const promo of promos) {
    if (!promo.material_catalog_id) continue

    const { data: material } = await supabase
      .from('material_catalog')
      .select('id, name, slug, default_unit')
      .eq('id', promo.material_catalog_id)
      .single()
    if (!material) continue

    const { data: mm } = await supabase
      .from('market_materials')
      .select('id, price_display_mode, custom_display_price')
      .eq('material_catalog_id', material.id)
      .eq('market_id', marketId)
      .eq('is_visible', true)
      .maybeSingle()
    if (!mm) continue

    const { data: poolEntry } = await supabase
      .from('market_supply_pool')
      .select('offering:supplier_offerings(price_per_unit, unit, image_url, delivery_fee_base)')
      .eq('market_material_id', mm.id)
      .eq('is_preferred', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    const offering = (poolEntry as any)?.offering ?? null
    const displayPrice = deriveDisplayPrice(mm.price_display_mode, mm.custom_display_price, offering)
    if (displayPrice == null) continue

    let dealPrice = displayPrice
    if (promo.promotion_type === 'percentage') {
      dealPrice = displayPrice * (1 - (promo.discount_value / 100))
    } else if (promo.promotion_type === 'flat_amount') {
      dealPrice = displayPrice - promo.discount_value
    } else if (promo.promotion_type === 'price_override') {
      dealPrice = promo.override_price
    }

    dealCards.push({
      id: promo.id,
      title: promo.title,
      badge_label: promo.badge_label,
      is_deal_of_day: promo.is_deal_of_day,
      ends_at: promo.ends_at,
      promotion_type: promo.promotion_type,
      discount_value: promo.discount_value,
      material_name: material.name,
      material_slug: material.slug,
      unit: offering?.unit ?? material.default_unit,
      original_price: displayPrice,
      deal_price: Math.max(0, dealPrice),
      image_url: offering?.image_url ?? null,
      delivery_fee: offering?.delivery_fee_base ?? null,
    })
  }

  const dealOfDay = dealCards.find(d => d.is_deal_of_day) ?? dealCards[0] ?? null
  const otherDeals = dealCards.filter(d => d.id !== dealOfDay?.id)

  return { dealOfDay, deals: otherDeals }
}
