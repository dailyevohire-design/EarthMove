import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket, getAllMarkets } from '@/lib/market'
import { deriveDisplayPrice, formatCurrency, unitLabel } from '@/lib/pricing-engine'
import type { MarketMaterialCard } from '@/types'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { MaterialCard } from '@/components/marketplace/material-card'
import { CategoryGrid } from '@/components/marketplace/category-grid'
import { ArrowRight, Truck, ShieldCheck, Clock, CheckCircle2 } from 'lucide-react'

async function getCards(marketId: string): Promise<MarketMaterialCard[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('market_materials')
    .select(`
      id, price_display_mode, custom_display_price, is_featured,
      material:material_catalog(
        id, name, slug, description, default_unit,
        category:material_categories(name, slug)
      ),
      pool:market_supply_pool(
        is_preferred,
        offering:supplier_offerings(
          price_per_unit, unit, delivery_fee_base, minimum_order_quantity, image_url
        )
      )
    `)
    .eq('market_id', marketId)
    .eq('is_visible', true)
    .eq('is_available', true)
    .order('sort_order')

  if (!data) return []

  const now = new Date().toISOString()
  const { data: promos } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .or(`market_id.eq.${marketId},market_id.is.null`)

  return (data as any[]).map(row => {
    const preferred = row.pool?.find((p: any) => p.is_preferred)
    const offering = preferred?.offering ?? row.pool?.[0]?.offering ?? null
    const material = row.material
    if (!material) return null

    const displayPrice = deriveDisplayPrice(row.price_display_mode, row.custom_display_price, offering)
    if (displayPrice == null) return null

    const promo = (promos ?? []).find(
      (p: any) => p.material_catalog_id === material.id || (offering && p.offering_id === offering.id)
    ) ?? null

    return {
      market_material_id: row.id,
      material_catalog_id: material.id,
      slug: material.slug,
      name: material.name,
      description: material.description,
      image_url: offering?.image_url ?? null,
      category_name: material.category?.name ?? '',
      category_slug: material.category?.slug ?? '',
      unit: offering?.unit ?? material.default_unit,
      display_price: displayPrice,
      price_display_mode: row.price_display_mode,
      minimum_order_quantity: offering?.minimum_order_quantity ?? 1,
      delivery_fee_base: offering?.delivery_fee_base ?? null,
      is_featured: row.is_featured,
      is_deal_of_day: promo?.is_deal_of_day ?? false,
      badge_label: promo?.badge_label ?? null,
      promotion_id: promo?.id ?? null,
    }
  }).filter(Boolean) as MarketMaterialCard[]
}

export default async function HomePage() {
  const [market, allMarkets] = await Promise.all([getCurrentMarket(), getAllMarkets()])
  const allCards = market ? await getCards(market.id) : []
  const featuredCards = allCards.filter(c => c.is_featured)

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="bg-gray-900 py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight max-w-2xl">
              Order materials.<br />
              <span className="text-emerald-400">We deliver.</span>
            </h1>
            <p className="text-gray-400 text-lg mt-5 max-w-lg">
              Fill dirt, gravel, sand, topsoil, road base — ordered in minutes, delivered same-day.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/browse" className="btn-primary btn-xl text-base">
                Browse Materials <ArrowRight size={18} />
              </Link>
              <Link href="/material-match" className="btn bg-white/10 text-white border border-white/20 hover:bg-white/20 btn-xl text-base">
                Find My Material →
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-400" />
                <span>{allMarkets.length} markets</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck size={15} className="text-emerald-400" />
                <span>Same-day delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-400" />
                <span>Secure checkout</span>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <CategoryGrid />
          </div>
        </section>

        {/* Materials */}
        {featuredCards.length > 0 && (
          <section className="py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
                    Popular in {market?.name ?? 'your area'}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">In stock and ready for delivery</p>
                </div>
                <Link href="/browse" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-emerald-600">
                  View all <ArrowRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {featuredCards.map(card => <MaterialCard key={card.market_material_id} card={card} />)}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="py-16 bg-emerald-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-extrabold text-white mb-4">Ready to build?</h2>
            <p className="text-emerald-100 mb-8 max-w-md mx-auto">Get materials delivered to your job site.</p>
            <Link href="/browse" className="btn bg-white text-emerald-700 hover:bg-emerald-50 btn-xl font-bold shadow-xl inline-flex">
              Browse Materials <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
