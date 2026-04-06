import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket } from '@/lib/market'
import { deriveDisplayPrice, formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { DealSlider } from '@/components/marketplace/deal-slider'
import { DealGrid } from '@/components/marketplace/deal-grid'
import { Zap } from 'lucide-react'

async function getDeals(marketId: string) {
  const supabase = await createClient()
  const now = new Date().toISOString()

  // Get promotions for this market
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

  // For each promo, get the material info
  const dealCards = []
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

    // Get offering for price and image
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

    // Calculate deal price
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

export const metadata = {
  title: "Today's Deals on Bulk Materials",
  description: "Save on fill dirt, gravel, sand, and more. Flash sales, contractor deals, and limited-time promotions on bulk material delivery.",
  alternates: { canonical: '/deals' },
  openGraph: {
    title: "Today's Deals | EarthMove",
    description: 'Limited-time savings on bulk construction materials. Same-day delivery.',
  },
}

export default async function DealsPage() {
  const market = await getCurrentMarket()
  if (!market) return <div>No market selected</div>

  const { dealOfDay, deals } = await getDeals(market.id)

  return (
    <div className="bg-[#0a0a0a] min-h-screen">
      {/* Hero Deal */}
      {dealOfDay && (
        <DealSlider deal={dealOfDay} marketName={market.name} />
      )}

      {/* Deals Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filter tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-none">
            {['All Deals', 'Flash Sales', 'Contractor Deals', 'Weekend Only'].map((tab, i) => (
              <button
                key={tab}
                className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  i === 0
                    ? 'bg-[#00ff88] text-black shadow-lg shadow-[#00ff88]/20'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {deals.length > 0 ? (
            <DealGrid deals={deals} />
          ) : (
            <div className="text-center py-20">
              <Zap size={40} className="text-[#00ff88]/30 mx-auto mb-4" />
              <p className="text-white/40 text-lg">More deals coming soon for {market.name}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
