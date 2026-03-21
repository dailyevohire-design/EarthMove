import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket, getAllMarkets } from '@/lib/market'
import { deriveDisplayPrice, formatCurrency, unitLabel } from '@/lib/pricing-engine'
import type { MarketMaterialCard } from '@/types'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { MaterialCard } from '@/components/marketplace/material-card'
import { DealBanner } from '@/components/marketplace/deal-banner'
import { CategoryGrid } from '@/components/marketplace/category-grid'
import { CitySelector } from '@/components/marketplace/city-selector'
import { MapPin, ShieldCheck, Truck, Zap, ArrowRight, Star, Clock } from 'lucide-react'

async function getFeaturedCards(marketId: string): Promise<MarketMaterialCard[]> {
  const supabase = await createClient()
  const now = new Date().toISOString()

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
    .eq('is_featured', true)
    .order('sort_order')
    .limit(8)

  if (!data) return []
  const promos = await getActivePromotions(marketId)
  return (data as any[]).map(row => buildCard(row, promos)).filter(Boolean) as MarketMaterialCard[]
}

async function getActivePromotions(marketId: string) {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .or(`market_id.eq.${marketId},market_id.is.null`)
  return data ?? []
}

function buildCard(row: any, promos: any[]): MarketMaterialCard | null {
  const preferred = row.pool?.find((p: any) => p.is_preferred)
  const offering = preferred?.offering ?? row.pool?.[0]?.offering ?? null
  const material = row.material
  if (!material) return null

  const displayPrice = deriveDisplayPrice(row.price_display_mode, row.custom_display_price, offering)
  if (displayPrice == null) return null

  const promo = promos.find(
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
}

async function getDealOfDay(marketId: string) {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_deal_of_day', true)
    .eq('is_active', true)
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .or(`market_id.eq.${marketId},market_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export default async function HomePage() {
  const [market, allMarkets] = await Promise.all([getCurrentMarket(), getAllMarkets()])
  const [featuredCards, dealOfDay] = market
    ? await Promise.all([getFeaturedCards(market.id), getDealOfDay(market.id)])
    : [[], null]

  return (
    <>
      <SiteHeader />
      <main>
        {/* ── HERO ── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 border-b border-gray-100">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_-20%,_hsl(160_84%_39%_/_0.06),_transparent_60%)]" />
          <div className="container-main relative py-16 md:py-28">
            <div className="max-w-3xl">
              {/* City selector */}
              {market && allMarkets.length > 0 && (
                <div className="mb-6">
                  <CitySelector
                    cities={allMarkets}
                    currentCity={market}
                  />
                </div>
              )}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-6">
                Bulk materials,<br />
                <span className="text-emerald-600">delivered</span> to your job site.
              </h1>
              <p className="text-lg md:text-xl text-gray-500 max-w-xl mb-10 leading-relaxed">
                Fill dirt, gravel, road base, topsoil, and more — ordered online in minutes. No phone tag. No runaround.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/browse" className="btn-primary btn-xl">
                  Browse Materials
                  <ArrowRight size={16} />
                </Link>
                <Link href="/browse?deals=1" className="btn-secondary btn-xl">View Deals</Link>
              </div>
            </div>

            {/* Trust strip */}
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
              {[
                [ShieldCheck, 'Secure Checkout', 'Pay with confidence via Stripe'],
                [Truck, 'Fast Local Delivery', 'Same-day or scheduled delivery'],
                [Clock, 'Order in Minutes', 'No phone calls needed'],
              ].map(([Icon, title, sub]) => (
                <div key={title as string} className="flex items-start gap-3 p-4 rounded-xl bg-white/80 border border-gray-100">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{title as string}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{sub as string}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── DEAL BANNER ── */}
        {dealOfDay && (
          <section className="bg-emerald-50/60 border-b border-emerald-100">
            <div className="container-main py-3.5">
              <DealBanner promotion={dealOfDay} />
            </div>
          </section>
        )}

        {/* ── CATEGORY GRID ── */}
        <section className="border-b border-gray-100 bg-gray-50/50">
          <div className="container-main py-6">
            <CategoryGrid />
          </div>
        </section>

        {/* ── FEATURED MATERIALS ── */}
        <section className="section">
          <div className="container-main">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Popular in {market?.name ?? 'your area'}</h2>
                <p className="text-gray-500 mt-1 text-sm">In-stock and ready for delivery</p>
              </div>
              <Link href="/browse" className="btn-ghost btn-sm hidden sm:flex">View all →</Link>
            </div>

            {featuredCards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {featuredCards.map(card => <MaterialCard key={card.market_material_id} card={card} />)}
              </div>
            ) : (
              <div className="card p-12 text-center text-gray-400">
                Materials coming soon to your area.
              </div>
            )}

            <div className="mt-6 sm:hidden">
              <Link href="/browse" className="btn-secondary btn-md w-full">Browse all materials</Link>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="section bg-gray-50 border-y border-gray-100">
          <div className="container-main">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 text-center">How it works</h2>
            <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">From browse to delivery in three steps.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { step: '1', title: 'Choose your material', body: 'Browse the catalog. Select the material and quantity your job needs.' },
                { step: '2', title: 'Enter delivery details', body: 'Provide your job site address. Choose ASAP or schedule a date.' },
                { step: '3', title: 'Pay and we deliver', body: 'Secure checkout. We dispatch and keep you updated every step.' },
              ].map(({ step, title, body }) => (
                <div key={step} className="flex flex-col items-center text-center gap-4 animate-fade-up">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20">
                    <span className="text-xl font-bold text-white">{step}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── MARKETS ── */}
        {allMarkets.length > 1 && (
          <section className="section">
            <div className="container-main">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 text-center">Serving {allMarkets.length} markets</h2>
              <p className="text-gray-500 text-center mb-10">And growing every month.</p>
              <div className="flex flex-wrap justify-center gap-3">
                {allMarkets.map(m => (
                  <span key={m.id} className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium border border-gray-200">
                    {m.name}, {m.state}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
