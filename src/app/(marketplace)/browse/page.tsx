import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket } from '@/lib/market'
import { getDeliveredPerUnitPrice } from '@/lib/pricing-engine'
import { collectionPageSchema, breadcrumbSchema, jsonLd } from '@/lib/structured-data'
import { BrowseListingClient, type CategoryGroup, type BrowseListItem } from './BrowseListingClient'

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.7613
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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

  // Customer zip → lat/lng so we can compute all-in delivered prices per yard.
  // When zip is missing, we fall back to base product prices on the cards.
  const cookieStore = await cookies()
  const customerZip = cookieStore.get('customer_zip')?.value ?? null
  let customer: { zip: string; lat: number; lng: number } | null = null
  if (customerZip && /^\d{5}$/.test(customerZip)) {
    const { data: zc } = await supabase
      .from('zip_centroids')
      .select('lat, lng')
      .eq('zip', customerZip)
      .maybeSingle()
    if (zc && typeof zc.lat === 'number' && typeof zc.lng === 'number') {
      customer = { zip: customerZip, lat: zc.lat, lng: zc.lng }
    }
  }

  // 1. Active public+available offerings in this market.
  //    Embedded supply_yards filter via !inner so the WHERE clauses on the joined
  //    table run in SQL, not as post-filter in JS.
  const { data: offers } = await supabase
    .from('supplier_offerings')
    .select(`
      material_catalog_id,
      unit,
      price_per_unit,
      price_per_ton,
      price_per_cuyd,
      delivery_fee_base,
      delivery_fee_per_mile,
      max_delivery_miles,
      typical_load_size,
      minimum_order_quantity,
      image_url,
      supply_yard:supply_yards!inner(market_id, is_active, lat, lng)
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
  type OfferRow = {
    material_catalog_id: string
    unit: 'ton' | 'cubic_yard' | 'load' | 'each'
    price_per_unit: number
    price_per_ton: number | null
    price_per_cuyd: number | null
    delivery_fee_base: number | null
    delivery_fee_per_mile: number | null
    max_delivery_miles: number | null
    typical_load_size: number | null
    minimum_order_quantity: number | null
    image_url: string | null
    supply_yard: { market_id: string; is_active: boolean; lat: number | null; lng: number | null }
  }
  for (const o of (offers ?? []) as unknown as OfferRow[]) {
    // Compute delivered ($/unit) when we have a customer zip and yard coords;
    // otherwise fall back to the legacy denormalized base price columns.
    let priceTon: number | null = o.unit === 'ton' ? o.price_per_ton : null
    let priceCuyd: number | null = o.unit === 'cubic_yard' ? o.price_per_cuyd : null

    if (customer && o.supply_yard.lat != null && o.supply_yard.lng != null) {
      const miles = haversineMiles(customer.lat, customer.lng, o.supply_yard.lat, o.supply_yard.lng)
      const delivered = getDeliveredPerUnitPrice(
        {
          price_per_unit: o.price_per_unit,
          delivery_fee_base: o.delivery_fee_base,
          delivery_fee_per_mile: o.delivery_fee_per_mile,
          max_delivery_miles: o.max_delivery_miles,
          typical_load_size: o.typical_load_size,
        },
        miles,
      )
      // Outside service area → skip this offering for this customer.
      if (delivered == null) continue
      if (o.unit === 'ton') priceTon = delivered
      if (o.unit === 'cubic_yard') priceCuyd = delivered
    }

    const cur: OfferAgg = byMaterial.get(o.material_catalog_id) ?? {
      min_pton: null,
      min_pcuyd: null,
      min_order_qty: null,
      image_url: null,
      offering_count: 0,
    }
    if (priceTon != null) {
      cur.min_pton = cur.min_pton == null ? priceTon : Math.min(cur.min_pton, priceTon)
    }
    if (priceCuyd != null) {
      cur.min_pcuyd = cur.min_pcuyd == null ? priceCuyd : Math.min(cur.min_pcuyd, priceCuyd)
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
    return <BrowseListingClient market={{ name: market.name, state: market.state }} categoryGroups={[]} totalMaterials={0} customerZip={customer?.zip ?? null} />
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
        customerZip={customer?.zip ?? null}
      />
    </>
  )
}
