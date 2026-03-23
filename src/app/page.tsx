import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket, getAllMarkets } from '@/lib/market'
import { deriveDisplayPrice, formatCurrency, unitLabel } from '@/lib/pricing-engine'
import type { MarketMaterialCard } from '@/types'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { MaterialCard, DealCard } from '@/components/marketplace/material-card'
import { CategoryGrid } from '@/components/marketplace/category-grid'
import { CitySelector } from '@/components/marketplace/city-selector'
import { CustomerReviews, WhyEarthMove } from '@/components/marketplace/trust-section'
import { AnimatedStats } from '@/components/marketplace/animated-stats'
import { ShieldCheck, Truck, Clock, ArrowRight, MapPin, CheckCircle2, Zap, Star, HelpCircle } from 'lucide-react'

async function getCards(marketId: string, featuredOnly: boolean): Promise<MarketMaterialCard[]> {
  const supabase = await createClient()

  let query = supabase
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

  if (featuredOnly) query = query.eq('is_featured', true).limit(8)

  const { data } = await query
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

export default async function HomePage() {
  const [market, allMarkets] = await Promise.all([getCurrentMarket(), getAllMarkets()])

  const allCards = market ? await getCards(market.id, false) : []
  const featuredCards = allCards.filter(c => c.is_featured)
  const deals = allCards.filter(c => c.badge_label || c.is_deal_of_day)
  const nonFeatured = allCards.filter(c => !c.is_featured)

  return (
    <>
      <SiteHeader />
      <main className="bg-gray-50/30">
        {/* ── HERO ── */}
        <section className="relative overflow-hidden bg-gray-900">
          <div className="absolute inset-0">
            <Image
              src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80"
              alt="Construction materials"
              fill
              className="object-cover opacity-40"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900/60 via-gray-900/80 to-gray-900" />
          </div>

          <div className="container-main relative z-10 pt-12 pb-16 md:pt-16 md:pb-24">
            {/* City selector */}
            {market && allMarkets.length > 0 && (
              <div className="mb-8">
                <CitySelector cities={allMarkets} currentCity={market} />
              </div>
            )}

            <h1 className="text-[40px] sm:text-5xl md:text-[56px] font-extrabold text-white leading-[1.05] tracking-tight max-w-2xl">
              Order materials.<br />
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">We deliver.</span>
            </h1>
            <p className="text-gray-400 text-lg mt-5 max-w-lg leading-relaxed">
              Fill dirt, gravel, sand, topsoil, road base — ordered in minutes, delivered same-day to your job site.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/browse" className="btn-primary btn-xl shadow-2xl shadow-emerald-500/30 text-base">
                Browse Materials <ArrowRight size={18} />
              </Link>
              <Link href="/material-match" className="btn bg-white/10 backdrop-blur text-white border border-white/20 hover:bg-white/20 btn-xl text-base">
                <HelpCircle size={16} /> Find My Material →
              </Link>
            </div>

            {/* Trust metrics */}
            <div className="mt-12 flex flex-wrap gap-8">
              <div className="flex items-center gap-2.5 text-sm text-gray-400">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span className="font-medium">{allMarkets.length} markets</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-400">
                <Truck size={16} className="text-emerald-400" />
                <span className="font-medium">Same-day delivery</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-400">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span className="font-medium">Secure checkout</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-400">
                <Clock size={16} className="text-emerald-400" />
                <span className="font-medium">Order in 5 min</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── CATEGORIES ── */}
        <section className="bg-white border-b border-gray-100 sticky top-16 z-30">
          <div className="container-main py-4">
            <CategoryGrid />
          </div>
        </section>

        {/* ── DEALS CAROUSEL ── */}
        {deals.length > 0 && (
          <section className="bg-white border-b border-gray-100">
            <div className="container-main py-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/25">
                  <Zap size={18} className="text-white fill-white" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">Today's Deals</h2>
                  <p className="text-gray-500 text-xs">Limited-time pricing — order before they're gone</p>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
                {deals.map(card => <DealCard key={card.market_material_id} card={card} />)}
              </div>
            </div>
          </section>
        )}

        {/* ── FEATURED ── */}
        {featuredCards.length > 0 && (
          <section className="py-10 md:py-14">
            <div className="container-main">
              <div className="flex items-end justify-between mb-7">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Star size={16} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Top Picks</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
                    Popular in {market?.name}
                  </h2>
                </div>
                <Link href="/browse" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                  View all <ArrowRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {featuredCards.map(card => <MaterialCard key={card.market_material_id} card={card} />)}
              </div>
              <div className="mt-6 sm:hidden">
                <Link href="/browse" className="btn-primary btn-lg w-full">View all materials</Link>
              </div>
            </div>
          </section>
        )}

        {/* ── ALL MATERIALS ── */}
        {nonFeatured.length > 0 && (
          <section className="py-10 md:py-14 bg-white border-y border-gray-100">
            <div className="container-main">
              <div className="mb-7">
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">All materials</h2>
                <p className="text-gray-500 text-sm mt-1">{allCards.length} available in {market?.name}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {nonFeatured.map(card => <MaterialCard key={card.market_material_id} card={card} />)}
              </div>
            </div>
          </section>
        )}

        {/* ── ANIMATED STATS ── */}
        <AnimatedStats />

        {/* ── HOW IT WORKS ── */}
        <section className="py-16 md:py-20">
          <div className="container-main">
            <div className="text-center mb-14">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">How it works</span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-2">Three steps to delivery</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { num: '1', title: 'Choose material', body: 'Browse materials, select quantity and delivery type.', icon: '📦' },
                { num: '2', title: 'Enter your address', body: 'Tell us where to deliver. Choose ASAP or schedule.', icon: '📍' },
                { num: '3', title: 'Pay & track', body: 'Checkout via Stripe. Track your delivery in real-time.', icon: '🚛' },
              ].map(({ num, title, body, icon }) => (
                <div key={num} className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm hover:shadow-lg transition-shadow">
                  <div className="text-4xl mb-4">{icon}</div>
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-sm font-black mb-4">{num}</div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── KNOWLEDGE CENTER ── */}
        <section className="py-14 md:py-20 bg-white border-y border-gray-100">
          <div className="container-main">
            <div className="flex items-end justify-between mb-8">
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Knowledge Center</span>
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-2">Learn before you order</h2>
              </div>
              <Link href="/learn" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                Browse all guides <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { slug: 'driveway-gravel-guide', title: 'The Complete Guide to Driveway Gravel', image: 'https://images.unsplash.com/photo-1558618047-3c37c2d3b4b0?w=600&q=80&fit=crop', tag: 'Popular' },
                { slug: 'spring-project-guide-2025', title: '2025 Spring Project Guide', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&q=80&fit=crop', tag: 'Seasonal' },
                { slug: 'gravel-calculator', title: 'Free Gravel Calculator Tool', image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80&fit=crop', tag: 'Calculator' },
              ].map(a => (
                <Link key={a.slug} href={`/learn/${a.slug}`} className="group block">
                  <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image src={a.image} alt={a.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 33vw" />
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 rounded-full bg-white/90 text-xs font-bold text-gray-700">{a.tag}</span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">{a.title}</h3>
                      <span className="text-xs font-semibold text-emerald-600 mt-3 inline-flex items-center gap-1">Read guide <ArrowRight size={12} /></span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-6 sm:hidden">
              <Link href="/learn" className="btn-secondary btn-md w-full justify-center">Browse all guides</Link>
            </div>
          </div>
        </section>

        {/* ── WHY EARTHMOVE ── */}
        <WhyEarthMove />

        {/* ── REVIEWS ── */}
        <CustomerReviews />

        {/* ── MARKETS ── */}
        {allMarkets.length > 1 && (
          <section className="py-16 bg-gray-900">
            <div className="container-main text-center">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Coverage</span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-2 mb-3">Live in {allMarkets.length} markets</h2>
              <p className="text-gray-500 mb-10 max-w-md mx-auto text-sm">Delivering bulk construction materials across the country. More cities coming soon.</p>
              <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
                {allMarkets.map(m => (
                  <span key={m.id} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.07] text-white text-sm font-medium border border-white/10 hover:bg-white/[0.12] transition-colors">
                    <MapPin size={13} className="text-emerald-400" />
                    {m.name}, {m.state}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── CTA ── */}
        <section className="py-16 md:py-20 bg-gradient-to-br from-emerald-600 to-emerald-700">
          <div className="container-main text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Ready to build?</h2>
            <p className="text-emerald-100 mb-8 max-w-md mx-auto text-lg">Get materials delivered to your job site. No minimums on most products.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="btn bg-white text-emerald-700 hover:bg-emerald-50 btn-xl font-bold shadow-2xl text-base">
                Get Started Free <ArrowRight size={16} />
              </Link>
              <Link href="/browse" className="btn text-white/90 border border-white/30 hover:bg-white/10 btn-xl text-base">
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
