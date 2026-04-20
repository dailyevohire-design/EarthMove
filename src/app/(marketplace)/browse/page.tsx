import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket } from '@/lib/market'
import { deriveDisplayPrice } from '@/lib/pricing-engine'
import type { MarketMaterialCard } from '@/types'
import { MaterialCard, DealCard } from '@/components/marketplace/material-card'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { collectionPageSchema, itemListSchema, breadcrumbSchema, jsonLd } from '@/lib/structured-data'

interface BrowseProps {
  searchParams: Promise<{ category?: string; deals?: string }>
}

async function getCards(marketId: string, categorySlug?: string, dealsOnly?: boolean) {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: rows } = await supabase
    .from('market_materials')
    .select(`
      id, price_display_mode, custom_display_price, is_featured, sort_order,
      material:material_catalog(
        id, name, slug, description, default_unit,
        category:material_categories(id, name, slug)
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
    .order('is_featured', { ascending: false })
    .order('sort_order')

  if (!rows) return []

  const { data: promos } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .or(`market_id.eq.${marketId},market_id.is.null`)

  const cards: MarketMaterialCard[] = []

  for (const row of rows as any[]) {
    const material = row.material
    if (!material) continue
    if (categorySlug && material.category?.slug !== categorySlug) continue

    const preferred = row.pool?.find((p: any) => p.is_preferred)
    const offering = preferred?.offering ?? row.pool?.[0]?.offering ?? null
    const displayPrice = deriveDisplayPrice(row.price_display_mode, row.custom_display_price, offering)
    if (displayPrice == null) continue

    const promo = (promos ?? []).find(
      (p: any) => p.material_catalog_id === material.id || (offering && p.offering_id === offering.id)
    ) ?? null

    if (dealsOnly && !promo) continue

    cards.push({
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
    })
  }
  return cards
}

async function getCategories() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('material_categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export const metadata = {
  title: 'Browse Bulk Materials for Delivery',
  description: 'Browse fill dirt, gravel, sand, topsoil, road base, crushed concrete and 9 more materials. Filter by category. Same-day delivery available.',
  alternates: { canonical: '/browse' },
  openGraph: {
    title: 'Browse Bulk Materials | EarthMove',
    description: 'Fill dirt, gravel, sand, topsoil, flex base, and more. 15 materials available for same-day delivery.',
  },
}

export default async function BrowsePage({ searchParams }: BrowseProps) {
  const { category, deals } = await searchParams
  const market = await getCurrentMarket()
  const marketId = market?.id ?? null
  const [cards, categories] = await Promise.all([
    marketId ? getCards(marketId, category, deals === '1') : [],
    getCategories(),
  ])

  const activeCategory = categories.find((c: any) => c.slug === category)
  const dealsCards = cards.filter(c => c.badge_label || c.is_deal_of_day)
  const isDealsPage = deals === '1'

  const pageTitle = isDealsPage
    ? "Today's Deals on Bulk Materials"
    : activeCategory
      ? `${activeCategory.name} Materials`
      : 'All Bulk Materials'
  const collectionSchema = collectionPageSchema({
    name: pageTitle,
    description: `${cards.length} bulk materials available for delivery${market ? ` in ${market.name}` : ''}.`,
    url: `/browse${category ? `?category=${category}` : ''}${isDealsPage ? '?deals=1' : ''}`,
    itemCount: cards.length,
  })
  const listSchema = itemListSchema(
    cards.slice(0, 20).map(c => ({
      name: c.name,
      url: `/browse/${c.slug}`,
      image: c.image_url ?? undefined,
      price: c.display_price ?? null,
      unit: c.unit,
    }))
  )
  const crumbs = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Browse', url: '/browse' },
    ...(activeCategory ? [{ name: activeCategory.name, url: `/browse?category=${activeCategory.slug}` }] : []),
    ...(isDealsPage ? [{ name: 'Deals', url: '/browse?deals=1' }] : []),
  ])

  return (
    <div className="bg-gray-50/30 min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(collectionSchema) }} />
      {cards.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(listSchema) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbs) }} />
      {/* Sticky category bar */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-20">
        <div className="container-main py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            <Link
              href="/browse"
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${!category && !isDealsPage ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              All
            </Link>
            <Link
              href="/browse?deals=1"
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${isDealsPage ? 'bg-red-500 text-white shadow-md shadow-red-500/25' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              <Zap size={12} className={isDealsPage ? 'fill-current' : ''} />
              Deals
            </Link>
            {categories.map((c: any) => (
              <Link
                key={c.id}
                href={`/browse?category=${c.slug}`}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${category === c.slug ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="container-main py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">
            {isDealsPage ? "Today's Deals" : activeCategory ? activeCategory.name : 'All Materials'}
          </h1>
          <p className="text-gray-500 text-sm mt-1.5">
            {cards.length} material{cards.length !== 1 ? 's' : ''} available in {market?.name ?? 'your area'}
          </p>
        </div>

        {/* Deals carousel on browse page */}
        {!isDealsPage && dealsCards.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
                <Zap size={14} className="text-white fill-white" />
              </div>
              <h2 className="text-lg font-extrabold text-gray-900">Deals near you</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
              {dealsCards.map(card => <DealCard key={card.market_material_id} card={card} />)}
            </div>
          </div>
        )}

        {/* Grid */}
        {cards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {cards.map(card => <MaterialCard key={card.market_material_id} card={card} />)}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-20 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-gray-600 font-medium mb-1">No materials found</p>
            <p className="text-gray-400 text-sm mb-6">Try a different category or check back later.</p>
            <Link href="/browse" className="btn-primary btn-md">View all materials</Link>
          </div>
        )}
      </div>
    </div>
  )
}
