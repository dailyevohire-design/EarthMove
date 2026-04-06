import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket } from '@/lib/market'
import { deriveDisplayPrice, formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { resolveOffering } from '@/lib/fulfillment-resolver'
import { MaterialOrderForm } from '@/components/marketplace/material-order-form'
import { getMaterialImage } from '@/lib/material-images'
import { productSchema, breadcrumbSchema, faqSchema, getMaterialFAQs } from '@/lib/structured-data'
import { Package, ChevronRight, Truck, Shield } from 'lucide-react'
import Link from 'next/link'

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

  return { material, market, mm, resolvedOffering, promo: promo ?? null }
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

  const { material, market, mm, resolvedOffering, promo } = data
  const displayPrice = deriveDisplayPrice(mm.price_display_mode, mm.custom_display_price, resolvedOffering)
  const unit = resolvedOffering?.unit ?? material.default_unit

  const faqs = getMaterialFAQs(material.name, market.name, displayPrice ?? undefined, unit)

  return (
    <div className="container-main py-8">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(
        productSchema({
          name: material.name, slug: material.slug, description: material.description,
          category: material.category?.name, price: displayPrice,
          unit, image: getMaterialImage(material.slug),
        })
      ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(
        breadcrumbSchema([
          { name: 'Materials', url: '/browse' },
          { name: material.category?.name ?? 'Category', url: `/browse?category=${material.category?.slug}` },
          { name: material.name, url: `/browse/${material.slug}` },
        ])
      ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }} />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-8">
        <Link href="/browse" className="hover:text-gray-700 transition-colors">Materials</Link>
        <ChevronRight size={13} />
        <Link href={`/browse?category=${material.category?.slug}`} className="hover:text-gray-700 transition-colors">
          {material.category?.name}
        </Link>
        <ChevronRight size={13} />
        <span className="text-gray-700">{material.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16">
        {/* Left: Info */}
        <div className="lg:col-span-3 space-y-6">
          {/* Image */}
          <div className="aspect-[16/9] rounded-2xl bg-gray-100 border border-gray-200 overflow-hidden">
            <img
              src={getMaterialImage(material.slug)}
              alt={`${material.name} — bulk aggregate material available for delivery`}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Title + price */}
          <div>
            <span className="badge-stone text-xs mb-3">{material.category?.name}</span>
            <div className="flex items-start justify-between gap-4 mt-2">
              <h1 className="text-3xl font-bold text-gray-900">
                {mm.display_name ?? material.name}
              </h1>
              {displayPrice != null && (
                <div className="text-right flex-shrink-0">
                  <div className="price-display text-2xl">{formatCurrency(displayPrice)}</div>
                  <div className="text-gray-500 text-sm">per {unitLabel(unit, 1)}</div>
                </div>
              )}
            </div>
            <p className="text-gray-500 mt-3 leading-relaxed text-sm">
              {mm.display_description ?? material.description}
            </p>
          </div>

          {/* Load info */}
          {resolvedOffering?.typical_load_size && displayPrice != null && (
            <div className="card p-4 flex gap-4 items-start">
              <div className="p-2 bg-emerald-50 rounded-lg flex-shrink-0">
                <Truck size={18} className="text-emerald-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">
                  Typical load: {resolvedOffering.load_size_label ?? `${resolvedOffering.typical_load_size} ${unitLabel(unit, resolvedOffering.typical_load_size)}`}
                </div>
                <div className="text-gray-500 text-xs mt-0.5">
                  Per-load price:{' '}
                  <span className="text-gray-700 font-medium">
                    {formatCurrency(displayPrice * resolvedOffering.typical_load_size)}
                  </span>
                  {resolvedOffering.delivery_fee_base && (
                    <> · Delivery from {formatCurrency(resolvedOffering.delivery_fee_base)}</>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Trust badges */}
          <div className="flex flex-wrap gap-4">
            {[
              [Shield, 'Secure payment'],
              [Truck, 'Reliable local delivery'],
            ].map(([Icon, label]) => (
              <div key={label as string} className="flex items-center gap-2 text-xs text-gray-500">
                <Icon size={13} className="text-gray-400" />
                {label as string}
              </div>
            ))}
          </div>

          {/* FAQ section for AEO */}
          <div className="border-t border-gray-100 pt-8 mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <details key={i} className="group border border-gray-200 rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between p-4 cursor-pointer bg-white hover:bg-gray-50 transition-colors">
                    <span className="text-sm font-semibold text-gray-900 pr-4">{faq.question}</span>
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{faq.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Order form */}
        <div className="lg:col-span-2">
          <div className="sticky top-24">
            {resolvedOffering && displayPrice != null ? (
              <MaterialOrderForm
                marketMaterialId={mm.id}
                marketId={market.id}
                materialCatalogId={material.id}
                materialName={mm.display_name ?? material.name}
                offering={resolvedOffering}
                displayPrice={displayPrice}
                promo={promo}
                marketState={market.state}
                marketCenterLat={market.center_lat}
                marketCenterLng={market.center_lng}
              />
            ) : (
              <div className="card p-6 text-center">
                <p className="text-gray-500 font-medium mb-1">
                  {mm.unavailable_reason ?? 'Currently unavailable in your area.'}
                </p>
                <p className="text-gray-400 text-sm">Check back soon or browse other materials.</p>
                <Link href="/browse" className="btn-secondary btn-md mt-4 inline-flex">Browse Materials</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
