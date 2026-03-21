import { createClient } from '@/lib/supabase/server'
import { deriveDisplayPrice } from '@/lib/pricing-engine'
import type { MarketMaterialCard } from '@/types'
import { MaterialCard } from '@/components/marketplace/material-card'
import Link from 'next/link'

interface BrowseProps {
  searchParams: Promise<{ category?: string; deals?: string }>
}

async function getDefaultMarketId() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('markets').select('id').eq('is_active', true).limit(1).maybeSingle()
  return data?.id ?? null
}

async function getCards(marketId: string, categorySlug?: string, dealsOnly?: boolean) {
  const supabase = await createClient()
  const now = new Date().toISOString()

  let query = supabase
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

  const { data: rows } = await query
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

export const metadata = { title: 'Browse Materials' }

export default async function BrowsePage({ searchParams }: BrowseProps) {
  const { category, deals } = await searchParams
  const marketId = await getDefaultMarketId()
  const [cards, categories] = await Promise.all([
    marketId ? getCards(marketId, category, deals === '1') : [],
    getCategories(),
  ])

  const activeCategory = categories.find((c: any) => c.slug === category)

  return (
    <div className="container-main py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {deals === '1' ? "Today's Deals" : activeCategory ? activeCategory.name : 'All Materials'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {cards.length} material{cards.length !== 1 ? 's' : ''} available · Dallas-Fort Worth
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block w-52 flex-shrink-0 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-3">Category</p>
          <Link
            href="/browse"
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${!category && deals !== '1' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            All Materials
          </Link>
          {categories.map((c: any) => (
            <Link
              key={c.id}
              href={`/browse?category=${c.slug}`}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${category === c.slug ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
            >
              {c.name}
            </Link>
          ))}
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {/* Mobile category chips */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-5 -mx-4 px-4 scrollbar-none">
            <Link href="/browse" className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!category ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>All</Link>
            {categories.map((c: any) => (
              <Link key={c.id} href={`/browse?category=${c.slug}`} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${category === c.slug ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{c.name}</Link>
            ))}
          </div>

          {cards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {cards.map(card => <MaterialCard key={card.market_material_id} card={card} />)}
            </div>
          ) : (
            <div className="card p-16 text-center">
              <p className="text-gray-400">No materials found.</p>
              <Link href="/browse" className="btn-ghost btn-sm mt-4 inline-flex">View all materials</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
