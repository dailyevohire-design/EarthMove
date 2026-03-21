import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { deriveDisplayPrice, formatCurrency, unitLabel } from '@/lib/pricing-engine'
import type { MarketMaterialCard } from '@/types'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { MaterialCard } from '@/components/marketplace/material-card'
import { DealBanner } from '@/components/marketplace/deal-banner'
import { CategoryGrid } from '@/components/marketplace/category-grid'
import { MapPin, ShieldCheck, Truck, Zap } from 'lucide-react'

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

  // Resolve preferred offering + build display cards
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

  const displayPrice = deriveDisplayPrice(
    row.price_display_mode,
    row.custom_display_price,
    offering
  )
  if (displayPrice == null) return null

  const promo = promos.find(
    (p: any) =>
      p.material_catalog_id === material.id ||
      (offering && p.offering_id === offering.id)
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

async function getDefaultMarketId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('markets')
    .select('id')
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export default async function HomePage() {
  const marketId = await getDefaultMarketId()
  const [featuredCards, dealOfDay] = marketId
    ? await Promise.all([getFeaturedCards(marketId), getDealOfDay(marketId)])
    : [[], null]

  return (
    <>
      <SiteHeader />
      <main>
        {/* ── HERO ── */}
        <section className="relative overflow-hidden bg-stone-950 border-b border-stone-800/50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_-20%,_hsl(38_92%_50%_/_0.10),_transparent_60%)]" />
          <div className="container-main relative py-20 md:py-32">
            <div className="max-w-3xl">
              <div className="badge-amber mb-6 w-fit">
                <MapPin size={11} />
                Now serving Dallas-Fort Worth
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-stone-50 leading-[1.1] tracking-tight mb-6">
                Bulk materials,<br />
                <span className="text-amber-400">delivered</span> to your job site.
              </h1>
              <p className="text-lg md:text-xl text-stone-400 max-w-xl mb-10 leading-relaxed">
                Fill dirt, gravel, road base, topsoil, and more — ordered online in minutes. No phone tag.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/browse" className="btn-primary btn-xl">Browse Materials</Link>
                <Link href="/browse?deals=1" className="btn-secondary btn-xl">View Today's Deals</Link>
              </div>
              <div className="mt-12 flex flex-wrap gap-6 text-sm text-stone-500">
                {[
                  [ShieldCheck, 'Secure checkout'],
                  [Truck, 'Local delivery network'],
                  [Zap, 'Order in under 5 minutes'],
                ].map(([Icon, label]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    <Icon size={15} className="text-amber-500" />
                    {label as string}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── DEAL BANNER ── */}
        {dealOfDay && (
          <section className="bg-amber-500/5 border-b border-stone-800">
            <div className="container-main py-3.5">
              <DealBanner promotion={dealOfDay} />
            </div>
          </section>
        )}

        {/* ── CATEGORY GRID ── */}
        <section className="border-b border-stone-800 bg-stone-900/40">
          <div className="container-main py-6">
            <CategoryGrid />
          </div>
        </section>

        {/* ── FEATURED MATERIALS ── */}
        <section className="section">
          <div className="container-main">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-stone-100">Popular Materials</h2>
                <p className="text-stone-500 mt-1 text-sm">In-stock and ready for delivery in DFW</p>
              </div>
              <Link href="/browse" className="btn-ghost btn-sm hidden sm:flex">View all →</Link>
            </div>

            {featuredCards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {featuredCards.map(card => <MaterialCard key={card.market_material_id} card={card} />)}
              </div>
            ) : (
              <div className="card p-12 text-center text-stone-500">
                Materials coming soon to your area.
              </div>
            )}

            <div className="mt-6 sm:hidden">
              <Link href="/browse" className="btn-secondary btn-md w-full">Browse all materials</Link>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="section bg-stone-900/40 border-y border-stone-800">
          <div className="container-main">
            <h2 className="text-2xl md:text-3xl font-bold text-stone-100 mb-12 text-center">Simple ordering, every time</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-4xl mx-auto">
              {[
                { step: '01', title: 'Choose your material', body: 'Browse the catalog and select the material and quantity for your job.' },
                { step: '02', title: 'Enter delivery details', body: 'Provide your job site address and choose ASAP or a specific delivery date.' },
                { step: '03', title: 'Pay and we deliver', body: 'Secure checkout. We handle dispatch and keep you updated on status.' },
              ].map(({ step, title, body }) => (
                <div key={step} className="flex flex-col gap-4 animate-fade-up">
                  <div className="text-5xl font-black text-amber-500/25 font-mono leading-none">{step}</div>
                  <div>
                    <h3 className="font-bold text-stone-100 text-lg mb-2">{title}</h3>
                    <p className="text-stone-400 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
