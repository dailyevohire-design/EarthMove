import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket } from '@/lib/market'
import { collectionPageSchema, breadcrumbSchema, jsonLd } from '@/lib/structured-data'
import { BrowseListingClient, type CategoryGroup, type BrowseListItem } from './BrowseListingClient'

export const metadata: Metadata = {
  title: 'Materials',
  description:
    'Every aggregate material we deliver in your market — base, fill, sand, gravel, rock, decorative, recycled. Same-day or next-day to your job site.',
  alternates: { canonical: '/browse' },
}

interface SearchParams {
  category?: string
}
interface Props {
  searchParams: Promise<SearchParams>
}

export default async function BrowsePage({ searchParams }: Props) {
  // Reserved for #BROWSE-FILTER-PREFILL — pre-select a category from ?category=<slug>.
  await searchParams

  const market = await getCurrentMarket()
  if (!market) redirect('/')

  const supabase = await createClient()

  // 1. Active public+available offerings in this market.
  //    Embedded supply_yards filter via !inner so the WHERE clauses on the joined
  //    table run in SQL, not as post-filter in JS.
  const { data: offers } = await supabase
    .from('supplier_offerings')
    .select(`
      material_catalog_id,
      price_per_ton,
      price_per_cuyd,
      minimum_order_quantity,
      image_url,
      supply_yard:supply_yards!inner(market_id, is_active)
    `)
    .eq('is_public', true)
    .eq('is_available', true)
    .eq('supply_yard.is_active', true)
    .eq('supply_yard.market_id', market.id)

  type OfferAgg = {
    min_pton: number | null
    min_pcuyd: number | null
    min_order_qty: number | null
    image_url: string | null
    offering_count: number
  }
  const byMaterial = new Map<string, OfferAgg>()
  for (const o of (offers ?? []) as Array<{
    material_catalog_id: string
    price_per_ton: number | null
    price_per_cuyd: number | null
    minimum_order_quantity: number | null
    image_url: string | null
  }>) {
    const cur: OfferAgg = byMaterial.get(o.material_catalog_id) ?? {
      min_pton: null,
      min_pcuyd: null,
      min_order_qty: null,
      image_url: null,
      offering_count: 0,
    }
    if (o.price_per_ton != null) {
      cur.min_pton = cur.min_pton == null ? o.price_per_ton : Math.min(cur.min_pton, o.price_per_ton)
    }
    if (o.price_per_cuyd != null) {
      cur.min_pcuyd = cur.min_pcuyd == null ? o.price_per_cuyd : Math.min(cur.min_pcuyd, o.price_per_cuyd)
    }
    if (o.minimum_order_quantity != null) {
      cur.min_order_qty =
        cur.min_order_qty == null
          ? o.minimum_order_quantity
          : Math.min(cur.min_order_qty, o.minimum_order_quantity)
    }
    if (cur.image_url == null && o.image_url) cur.image_url = o.image_url
    cur.offering_count += 1
    byMaterial.set(o.material_catalog_id, cur)
  }

  const ids = Array.from(byMaterial.keys())
  if (ids.length === 0) {
    return <BrowseListingClient market={{ name: market.name, state: market.state }} categoryGroups={[]} totalMaterials={0} />
  }

  // 2. Materials + categories for the offer-bearing IDs.
  const { data: mats } = await supabase
    .from('material_catalog')
    .select(`
      id, slug, name, description, default_unit, density_tons_per_cuyd, sort_order,
      category:material_categories!inner(slug, name, sort_order)
    `)
    .in('id', ids)
    .eq('is_active', true)

  type MatRow = {
    id: string
    slug: string
    name: string
    description: string | null
    default_unit: 'ton' | 'cubic_yard'
    density_tons_per_cuyd: number | null
    sort_order: number | null
    category: { slug: string; name: string; sort_order: number | null }
  }
  const items: BrowseListItem[] = ((mats ?? []) as unknown as MatRow[]).map((m) => {
    const agg = byMaterial.get(m.id)!
    return {
      id: m.id,
      slug: m.slug,
      name: m.name,
      description: m.description,
      defaultUnit: m.default_unit,
      densityTonsPerCuyd: m.density_tons_per_cuyd,
      sortOrder: m.sort_order,
      categorySlug: m.category.slug,
      categoryName: m.category.name,
      categorySortOrder: m.category.sort_order,
      minPriceTon: agg.min_pton,
      minPriceCuyd: agg.min_pcuyd,
      minOrderQty: agg.min_order_qty,
      imageUrl: agg.image_url,
      offeringCount: agg.offering_count,
    }
  })

  // 3. Sort by category, then material.
  items.sort((a, b) => {
    const ac = a.categorySortOrder ?? 9999
    const bc = b.categorySortOrder ?? 9999
    if (ac !== bc) return ac - bc
    if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName)
    const am = a.sortOrder ?? 9999
    const bm = b.sortOrder ?? 9999
    if (am !== bm) return am - bm
    return a.name.localeCompare(b.name)
  })

  // 4. Group by category.
  const groupMap = new Map<string, CategoryGroup>()
  for (const m of items) {
    const g = groupMap.get(m.categorySlug)
    if (g) {
      g.materials.push(m)
    } else {
      groupMap.set(m.categorySlug, {
        slug: m.categorySlug,
        name: m.categoryName,
        sortOrder: m.categorySortOrder ?? 9999,
        materials: [m],
      })
    }
  }
  const categoryGroups = Array.from(groupMap.values())

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            collectionPageSchema({
              name: `Materials in ${market.name}`,
              description: `Bulk aggregate materials with same-day or next-day delivery in ${market.name}.`,
              url: '/browse',
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Materials', url: '/browse' },
            ]),
          ),
        }}
      />
      <BrowseListingClient
        market={{ name: market.name, state: market.state }}
        categoryGroups={categoryGroups}
        totalMaterials={items.length}
      />
    </>
  )
}
