import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { HeroSection } from '@/components/marketplace/hero-section'
import { MaterialCard } from '@/components/marketplace/material-card'
import { DealGrid } from '@/components/marketplace/deal-grid'
import { PreZipPitch } from '@/components/marketplace/pre-zip-pitch'
import { StickyZipBar } from '@/components/marketplace/sticky-zip-bar'
import { LiveActivity } from '@/components/marketplace/live-activity'
import { getDeals } from '@/lib/deals'
import { LAUNCH_MARKET_SLUGS } from '@/lib/zip-market'
import type { MarketMaterialCard } from '@/types'
import { ArrowRight, Star, Tag } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()

  // Only show launch markets (DFW + Denver). Even if other rows exist
  // in the markets table, they're not part of the launch and shouldn't
  // appear anywhere on the homepage.
  const { data: markets } = await supabase
    .from('markets')
    .select('id, name, state')
    .eq('is_active', true)
    .in('slug', LAUNCH_MARKET_SLUGS as unknown as string[])
    .order('name')

  // Pick the user's chosen market from cookie. No default — user must enter ZIP.
  const cookieStore = await cookies()
  const cookieMarketId = cookieStore.get('market_id')?.value
  const market =
    (cookieMarketId && markets?.find(m => m.id === cookieMarketId)) || null

  let cards: MarketMaterialCard[] = []
  if (market) {
    const { data: rows } = await supabase
      .from('market_materials')
      .select(`
        id, price_display_mode, custom_display_price, is_featured,
        material:material_catalog(id, name, slug, default_unit, category:material_categories(name, slug)),
        pool:market_supply_pool(is_preferred, offering:supplier_offerings(price_per_unit, unit, delivery_fee_base, minimum_order_quantity, image_url))
      `)
      .eq('market_id', market.id)
      .eq('is_visible', true)
      .eq('is_available', true)
      .order('sort_order')

    for (const row of (rows ?? []) as any[]) {
      const mat = row.material
      if (!mat) continue
      const pref = row.pool?.find((p: any) => p.is_preferred)
      const off = pref?.offering ?? row.pool?.[0]?.offering ?? null
      if (!off) continue
      const price = row.price_display_mode === 'custom' && row.custom_display_price
        ? row.custom_display_price : off.price_per_unit
      if (!price) continue

      cards.push({
        market_material_id: row.id, material_catalog_id: mat.id,
        slug: mat.slug, name: mat.name, description: null,
        image_url: off.image_url ?? null,
        category_name: mat.category?.name ?? '', category_slug: mat.category?.slug ?? '',
        unit: off.unit ?? mat.default_unit, display_price: price,
        price_display_mode: row.price_display_mode,
        minimum_order_quantity: off.minimum_order_quantity ?? 1,
        delivery_fee_base: off.delivery_fee_base ?? null,
        is_featured: row.is_featured, is_deal_of_day: false,
        badge_label: null, promotion_id: null,
      })
    }
  }

  const featured = cards.filter(c => c.is_featured)
  const rest = cards.filter(c => !c.is_featured)

  // Active deals for this market (returns empty if none)
  const { dealOfDay, deals: otherDeals } = market
    ? await getDeals(market.id)
    : { dealOfDay: null, deals: [] }
  const allDeals = [
    ...(dealOfDay ? [dealOfDay] : []),
    ...otherDeals,
  ]

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <HeroSection
          marketCount={markets?.length ?? 0}
          marketName={market?.name ?? null}
          marketState={market?.state ?? null}
        />

        {/* Pre-ZIP: sell the product instead of showing an empty page */}
        {!market && <PreZipPitch />}

        {/* Deals near you */}
        {allDeals.length > 0 && market && (
          <section className="py-12 bg-[#0a0a0a]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Tag size={16} className="text-[#00ff88]" />
                    <span className="text-xs font-bold text-[#00ff88] uppercase tracking-wider">Deals near you</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                    Limited-time savings in {market.name}
                  </h2>
                </div>
                <Link href="/deals" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-[#00ff88] hover:text-emerald-300">
                  See all deals <ArrowRight size={14} />
                </Link>
              </div>
              <DealGrid deals={allDeals} />
            </div>
          </section>
        )}

        {/* Featured Materials */}
        {featured.length > 0 && (
          <section className="py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Star size={16} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Top Picks</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
                    Popular in {market?.name ?? 'your area'}
                  </h2>
                </div>
                <Link href="/browse" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-emerald-600">
                  View all <ArrowRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {featured.map(card => <MaterialCard key={card.market_material_id} card={card} />)}
              </div>
            </div>
          </section>
        )}

        {/* All materials */}
        {rest.length > 0 && (
          <section className="py-12 bg-gray-50 border-y border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">All materials</h2>
              <p className="text-gray-500 text-sm mb-8">{cards.length} available in {market?.name}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {rest.map(card => <MaterialCard key={card.market_material_id} card={card} />)}
              </div>
            </div>
          </section>
        )}

        {/* Live activity — replaces "Live in 10 markets" + "Ready to build" */}
        <LiveActivity markets={markets ?? []} />
      </main>
      {!market && <StickyZipBar />}
      <SiteFooter />
    </>
  )
}
