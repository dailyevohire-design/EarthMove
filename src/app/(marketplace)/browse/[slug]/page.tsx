import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket } from '@/lib/market'
import { deriveDisplayPrice } from '@/lib/pricing-engine'
import { resolveOffering } from '@/lib/fulfillment-resolver'
import { pickBestOffering, type BestOfferingInput } from '@/lib/best-offering'
import { MaterialGallery } from '@/components/material/material-gallery'
import { productSchema, breadcrumbSchema, jsonLd } from '@/lib/structured-data'
import { BrowseDetailClient, type RelatedMaterial } from './BrowseDetailClient'

interface Props { params: Promise<{ slug: string }> }

async function getPageData(slug: string) {
  const supabase = await createClient()

  const { data: material } = await supabase
    .from('material_catalog')
    .select('*, category:material_categories(*)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!material) return null

  const market = await getCurrentMarket()
  if (!market) return null

  const { data: mm } = await supabase
    .from('market_materials')
    .select('*')
    .eq('material_catalog_id', material.id)
    .eq('market_id', market.id)
    .eq('is_visible', true)
    .eq('is_available', true)
    .maybeSingle()

  if (!mm) return null

  let resolvedOffering: any = null
  try {
    const resolved = await resolveOffering(market.id, material.id)
    resolvedOffering = resolved.offering
  } catch {}

  const now = new Date().toISOString()
  const { data: promo } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .or(`material_catalog_id.eq.${material.id}${resolvedOffering ? `,offering_id.eq.${resolvedOffering.id}` : ''}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Related: 3 same-category materials, excluding current. Sorted by display priority.
  let related: RelatedMaterial[] = []
  if (material.category_id) {
    const { data: rel } = await supabase
      .from('material_catalog')
      .select('slug, name, description, default_unit, image_url, category:material_categories(name)')
      .eq('category_id', material.category_id)
      .eq('is_active', true)
      .neq('id', material.id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
      .limit(3)
    related = (rel ?? []).map((r: any) => ({
      slug: r.slug,
      name: r.name,
      description: r.description,
      default_unit: r.default_unit,
      categoryName: r.category?.name ?? null,
      imageUrl: r.image_url ?? null,
    }))
  }

  return { material, market, mm, resolvedOffering, promo: promo ?? null, related }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('material_catalog').select('name, description').eq('slug', slug).single()
  if (!data) return { title: 'Material Not Found' }
  return {
    title: data.name,
    description: data.description ?? `Order ${data.name.toLowerCase()} for bulk delivery. Same-day delivery available.`,
    alternates: { canonical: `/browse/${slug}` },
    openGraph: {
      title: `${data.name} — Bulk Delivery | EarthMove`,
      description: data.description ?? `Order ${data.name.toLowerCase()} for bulk delivery. Same-day delivery available.`,
    },
  }
}

export default async function MaterialDetailPage({ params }: Props) {
  const { slug } = await params
  const data = await getPageData(slug)
  if (!data) notFound()

  const { material, market, mm, resolvedOffering, promo, related } = data
  const baseDisplayPrice = deriveDisplayPrice(mm.price_display_mode, mm.custom_display_price, resolvedOffering)
  const unit = (resolvedOffering?.unit ?? material.default_unit) as 'ton' | 'cubic_yard'
  const supplierName: string | null = resolvedOffering?.supply_yard?.supplier?.name ?? null
  const yardName: string | null = resolvedOffering?.supply_yard?.name ?? null

  // Customer zip → fetch all qualifying offerings for this material in this
  // market and let pickBestOffering choose the best yard for THIS customer
  // (cheapest delivered, $0.50/unit margin tie-break). The pool resolver's
  // composite-score pick is a market-wide default; this overrides it with a
  // customer-aware pick so the headline price matches checkout.
  const cookieStore = await cookies()
  const customerZip = cookieStore.get('customer_zip')?.value ?? null
  let displayPrice: number | null = baseDisplayPrice
  if (customerZip && /^\d{5}$/.test(customerZip) && resolvedOffering && baseDisplayPrice != null) {
    const supabase = await createClient()
    const { data: alts } = await supabase
      .from('supplier_offerings')
      .select(`
        id,
        price_per_unit,
        delivery_fee_base,
        delivery_fee_per_mile,
        max_delivery_miles,
        typical_load_size,
        supply_yard:supply_yards!inner(id, market_id, is_active, lat, lng)
      `)
      .eq('material_catalog_id', material.id)
      .eq('is_public', true)
      .eq('is_available', true)
      .eq('supply_yard.is_active', true)
      .eq('supply_yard.market_id', market.id)

    type AltRow = {
      id: string
      price_per_unit: number
      delivery_fee_base: number | null
      delivery_fee_per_mile: number | null
      max_delivery_miles: number | null
      typical_load_size: number | null
      supply_yard: { id: string; market_id: string; is_active: boolean; lat: number | null; lng: number | null }
    }
    const altRows = (alts ?? []) as unknown as AltRow[]
    const inputs: BestOfferingInput[] = altRows.map((a) => ({
      id: a.id,
      yardId: a.supply_yard.id,
      yardLat: a.supply_yard.lat,
      yardLng: a.supply_yard.lng,
      pricePerUnit: a.price_per_unit,
      deliveryFeeBase: a.delivery_fee_base,
      deliveryFeePerMile: a.delivery_fee_per_mile,
      maxDeliveryMiles: a.max_delivery_miles,
      typicalLoadSize: a.typical_load_size,
    }))
    const best = await pickBestOffering(inputs, customerZip)
    if (best) displayPrice = best.deliveredPerUnit
  }

  const isStateA = !!resolvedOffering && displayPrice != null
  const aliases: string[] = Array.isArray(material.aliases) ? material.aliases : []
  const offeringImageUrl: string | null = resolvedOffering?.image_url ?? null
  const offeringImageAlt: string | null = resolvedOffering?.supplier_material_name ?? null
  const heroImageForSchema: string = offeringImageUrl ?? material.image_url ?? ''

  const gallery = (
    <MaterialGallery
      slug={material.slug}
      size="detail"
      priorityFirst
      priorityImageUrl={offeringImageUrl}
      priorityImageAlt={offeringImageAlt}
    />
  )

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(
        productSchema({
          name: material.name, slug: material.slug, description: material.description,
          category: material.category?.name, price: displayPrice,
          unit, image: heroImageForSchema,
        })
      ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(
        breadcrumbSchema([
          { name: 'Materials', url: '/browse' },
          { name: material.category?.name ?? 'Category', url: `/browse?category=${material.category?.slug}` },
          { name: material.name, url: `/browse/${material.slug}` },
        ])
      ) }} />

      <BrowseDetailClient
        state={isStateA ? 'A' : 'B'}
        material={{
          id: material.id,
          slug: material.slug,
          name: material.name,
          description: material.description ?? null,
          density_tons_per_cuyd: material.density_tons_per_cuyd ?? null,
          aliases,
          category: material.category
            ? { slug: material.category.slug, name: material.category.name }
            : null,
        }}
        market={{ name: market.name }}
        displayName={mm.display_name ?? material.name}
        displayDescription={mm.display_description ?? material.description ?? null}
        unit={unit}
        gallery={gallery}
        displayPrice={displayPrice}
        overridePrice={promo?.override_price ?? null}
        minQty={resolvedOffering?.minimum_order_quantity ?? null}
        typicalLoad={resolvedOffering?.typical_load_size ?? null}
        loadSizeLabel={resolvedOffering?.load_size_label ?? null}
        deliveryFeeBase={resolvedOffering?.delivery_fee_base ?? null}
        deliveryFeePerMile={resolvedOffering?.delivery_fee_per_mile ?? null}
        maxDeliveryMiles={resolvedOffering?.max_delivery_miles ?? null}
        supplierName={supplierName}
        yardName={yardName}
        unavailableReason={mm.unavailable_reason ?? null}
        relatedMaterials={related}
      />
    </>
  )
}
