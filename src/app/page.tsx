import Link from 'next/link'
import Image from 'next/image'
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
import { ShieldCheck, Truck, Clock, ArrowRight, Star, Zap, MapPin, CheckCircle2 } from 'lucide-react'

async function getFeaturedCards(marketId: string): Promise<MarketMaterialCard[]> {
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

async function getAllCards(marketId: string): Promise<MarketMaterialCard[]> {
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
  const promos = await getActivePromotions(marketId)
  return (data as any[]).map(row => buildCard(row, promos)).filter(Boolean) as MarketMaterialCard[]
}

export default async function HomePage() {
  const [market, allMarkets] = await Promise.all([getCurrentMarket(), getAllMarkets()])
  const [featuredCards, allCards, dealOfDay] = market
    ? await Promise.all([getFeaturedCards(market.id), getAllCards(market.id), getDealOfDay(market.id)])
    : [[], [], null]

  return (
    <>
      <SiteHeader />
      <main>
        {/* ── HERO ── */}
        <section className="relative overflow-hidden min-h-[520px] md:min-h-[600px] flex items-center">
          {/* Background image */}
          <div className="absolute inset-0">
            <Image
              src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80"
              alt="Construction site"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/70 to-gray-900/40" />
          </div>

          <div className="container-main relative py-16 md:py-24 z-10">
            <div className="max-w-2xl">
              {/* City selector */}
              {market && allMarkets.length > 0 && (
                <div className="mb-8">
                  <CitySelector cities={allMarkets} currentCity={market} />
                </div>
              )}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-[1.06] tracking-tight mb-5">
                Materials delivered<br />
                <span className="text-emerald-400">to your job site.</span>
              </h1>
              <p className="text-lg text-gray-300 max-w-lg mb-8 leading-relaxed">
                Fill dirt, gravel, road base, topsoil and more. Order online, we deliver same-day or scheduled.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/browse" className="btn-primary btn-xl shadow-2xl shadow-emerald-600/30">
                  Browse Materials
                  <ArrowRight size={16} />
                </Link>
                <Link href="/signup" className="btn text-white bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 btn-xl">
                  Create Free Account
                </Link>
              </div>

              {/* Social proof */}
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400">
                {[
                  [CheckCircle2, '10 markets live'],
                  [Truck, 'Same-day delivery'],
                  [ShieldCheck, 'Secure checkout'],
                ].map(([Icon, label]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    <Icon size={14} className="text-emerald-400" />
                    {label as string}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── DEAL BANNER ── */}
        {dealOfDay && (
          <section className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <div className="container-main py-3.5">
              <DealBanner promotion={dealOfDay} />
            </div>
          </section>
        )}

        {/* ── CATEGORY GRID ── */}
        <section className="border-b border-gray-100 bg-white">
          <div className="container-main py-6">
            <CategoryGrid />
          </div>
        </section>

        {/* ── FEATURED MATERIALS ── */}
        {featuredCards.length > 0 && (
          <section className="py-12 md:py-16">
            <div className="container-main">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                    Popular in {market?.name ?? 'your area'}
                  </h2>
                  <p className="text-gray-500 mt-1 text-sm">Top picks — in stock and ready for delivery</p>
                </div>
                <Link href="/browse" className="btn-ghost btn-sm hidden sm:flex">View all →</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {featuredCards.map(card => <MaterialCard key={card.market_material_id} card={card} />)}
              </div>
            </div>
          </section>
        )}

        {/* ── ALL MATERIALS ── */}
        {allCards.length > featuredCards.length && (
          <section className="py-12 md:py-16 bg-gray-50/80 border-y border-gray-100">
            <div className="container-main">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900">All materials</h2>
                  <p className="text-gray-500 mt-1 text-sm">{allCards.length} materials available in {market?.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {allCards.filter(c => !featuredCards.find(f => f.market_material_id === c.market_material_id)).map(card => (
                  <MaterialCard key={card.market_material_id} card={card} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── HOW IT WORKS ── */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container-main">
            <div className="text-center mb-14">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">How it works</h2>
              <p className="text-gray-500 max-w-md mx-auto">From browse to delivery in three steps. No phone calls required.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { step: '1', title: 'Choose material', body: 'Browse the catalog. Select the material, quantity, and delivery type.', color: 'bg-emerald-600' },
                { step: '2', title: 'Enter address', body: 'Provide your job site address. Choose same-day or schedule a date.', color: 'bg-emerald-600' },
                { step: '3', title: 'Pay & get delivered', body: 'Secure checkout via Stripe. We dispatch and track your order.', color: 'bg-emerald-600' },
              ].map(({ step, title, body, color }, i) => (
                <div key={step} className={`flex flex-col items-center text-center gap-5 animate-fade-up-${i}`}>
                  <div className={`w-16 h-16 rounded-2xl ${color} flex items-center justify-center shadow-xl shadow-emerald-600/25`}>
                    <span className="text-2xl font-bold text-white">{step}</span>
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

        {/* ── MARKETS STRIP ── */}
        {allMarkets.length > 1 && (
          <section className="py-16 bg-gray-900 text-white">
            <div className="container-main text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Live in {allMarkets.length} markets</h2>
              <p className="text-gray-400 mb-10 max-w-md mx-auto">Expanding fast. Find bulk materials near you.</p>
              <div className="flex flex-wrap justify-center gap-3">
                {allMarkets.map(m => (
                  <span key={m.id} className="px-5 py-2.5 rounded-full bg-white/10 text-white/90 text-sm font-medium border border-white/10 hover:bg-white/20 transition-colors cursor-default">
                    <MapPin size={12} className="inline mr-1.5 text-emerald-400" />
                    {m.name}, {m.state}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── CTA ── */}
        <section className="py-16 md:py-20 bg-emerald-600">
          <div className="container-main text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to order?</h2>
            <p className="text-emerald-100 mb-8 max-w-md mx-auto">Create a free account and get materials delivered to your job site today.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="btn bg-white text-emerald-700 hover:bg-emerald-50 btn-xl font-bold shadow-xl">
                Get Started Free
                <ArrowRight size={16} />
              </Link>
              <Link href="/browse" className="btn text-white border border-white/30 hover:bg-white/10 btn-xl">
                Browse Materials
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
