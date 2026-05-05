import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket } from '@/lib/market'
import { getDeliveredPerUnitPrice } from '@/lib/pricing-engine'
import { resolveDriveMinutes } from '@/lib/eta'
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

  // Customer zip from cookie → drives the all-in delivered price calculation
  // per (zip, yard) via real Mapbox drive time when MAPBOX_TOKEN is set,
  // heuristic otherwise. Without a zip we render base product prices.
  const cookieStore = await cookies()
  const customerZip = cookieStore.get('customer_zip')?.value ?? null
  const hasCustomerZip = !!customerZip && /^\d{5}$/.test(customerZip)

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
      supply_yard:supply_yards!inner(id, market_id, is_active, lat, lng)
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
    supply_yard: { id: string; market_id: string; is_active: boolean; lat: number | null; lng: number | null }
  }
  const offerRows = (offers ?? []) as unknown as OfferRow[]

  // Pre-resolve drive time once per unique yard (not per offering — many
  // offerings share yards). resolveDriveMinutes hits the cache table first
  // and the heuristic last, so this is cheap when the cache is warm.
  type DriveResult = { miles: number; minutes: number } | null
  const yardDriveTime = new Map<string, DriveResult>()
  if (hasCustomerZip && customerZip) {
    const seen = new Set<string>()
    const yards: { id: string; lat: number; lng: number }[] = []
    for (const o of offerRows) {
      const y = o.supply_yard
      if (seen.has(y.id) || y.lat == null || y.lng == null) continue
      seen.add(y.id)
      yards.push({ id: y.id, lat: y.lat, lng: y.lng })
    }
    const resolved = await Promise.all(
      yards.map((y) =>
        resolveDriveMinutes(customerZip, { yard_id: y.id, lat: y.lat, lng: y.lng })
          .then((r) => (r ? { id: y.id, miles: r.miles, minutes: r.minutes } : { id: y.id, miles: null, minutes: null }))
          .catch(() => ({ id: y.id, miles: null, minutes: null }))
      )
    )
    for (const r of resolved) {
      yardDriveTime.set(r.id, r.miles != null && r.minutes != null ? { miles: r.miles, minutes: r.minutes } : null)
    }
  }

  for (const o of offerRows) {
    // Compute delivered ($/unit) when we have a customer zip and yard coords;
    // otherwise fall back to the legacy denormalized base price columns.
    let priceTon: number | null = o.unit === 'ton' ? o.price_per_ton : null
    let priceCuyd: number | null = o.unit === 'cubic_yard' ? o.price_per_cuyd : null

    if (hasCustomerZip) {
      const dt = yardDriveTime.get(o.supply_yard.id)
      if (dt) {
        const delivered = getDeliveredPerUnitPrice(
          {
            price_per_unit: o.price_per_unit,
            delivery_fee_base: o.delivery_fee_base,
            delivery_fee_per_mile: o.delivery_fee_per_mile,
            max_delivery_miles: o.max_delivery_miles,
            typical_load_size: o.typical_load_size,
          },
          dt.miles,
          { driveMinutes: dt.minutes },
        )
        // Outside service area → skip this offering for this customer.
        if (delivered == null) continue
        if (o.unit === 'ton') priceTon = delivered
        if (o.unit === 'cubic_yard') priceCuyd = delivered
      }
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
    return <BrowseListingClient market={{ name: market.name, state: market.state }} categoryGroups={[]} totalMaterials={0} customerZip={hasCustomerZip ? customerZip : null} />
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
        customerZip={hasCustomerZip ? customerZip : null}
      />
    </>
  )
}
