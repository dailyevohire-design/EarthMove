/**
 * MarketplaceHome — the with-market branch of `/`.
 *
 * Extracted verbatim from the previous src/app/page.tsx render. Behavior unchanged.
 * The without-market branch is <Homepage> (v6 marketing landing).
 */
import Link from 'next/link'
import { ArrowRight, Star, Tag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { HeroSection } from '@/components/marketplace/hero-section'
import { MaterialCard } from '@/components/marketplace/material-card'
import { DealGrid } from '@/components/marketplace/deal-grid'
import { LiveActivity } from '@/components/marketplace/live-activity'
import { getDeals } from '@/lib/deals'
import { LAUNCH_MARKET_SLUGS } from '@/lib/zip-market'
import type { MarketMaterialCard } from '@/types'

type Market = {
  id: string
  name: string
  state: string
  slug: string
}

export async function MarketplaceHome({ market }: { market: Market }) {
  const supabase = await createClient()

  const { data: markets } = await supabase
    .from('markets')
    .select('id, name, state, slug')
    .eq('is_active', true)
    .in('slug', LAUNCH_MARKET_SLUGS as unknown as string[])
    .order('name')

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

  const cards: MarketMaterialCard[] = []
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

  const featured = cards.filter(c => c.is_featured)
  const rest = cards.filter(c => !c.is_featured)

  const { dealOfDay, deals: otherDeals } = await getDeals(market.id)
  const allDeals = [
    ...(dealOfDay ? [dealOfDay] : []),
    ...otherDeals,
  ]

  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection
          marketCount={markets?.length ?? 0}
          marketName={market.name}
          marketState={market.state}
        />

        {allDeals.length > 0 && (
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
                    Popular in {market.name}
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

        {rest.length > 0 && (
          <section className="py-12 bg-gray-50 border-y border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">All materials</h2>
              <p className="text-gray-500 text-sm mb-8">{cards.length} available in {market.name}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {rest.map(card => <MaterialCard key={card.market_material_id} card={card} />)}
              </div>
            </div>
          </section>
        )}

        <LiveActivity markets={markets ?? []} />
      </main>
      <SiteFooter />
    </>
  )
}
