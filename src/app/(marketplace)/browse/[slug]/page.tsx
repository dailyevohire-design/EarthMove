import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deriveDisplayPrice, formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { resolveOffering } from '@/lib/fulfillment-resolver'
import { MaterialOrderForm } from '@/components/marketplace/material-order-form'
import { Package, ChevronRight, Truck, Shield } from 'lucide-react'
import Link from 'next/link'

interface Props { params: Promise<{ slug: string }> }

async function getPageData(slug: string) {
  const supabase = await createClient()

  // 1. Get canonical material
  const { data: material } = await supabase
    .from('material_catalog')
    .select('*, category:material_categories(*)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!material) return null

  // 2. Get active market
  const { data: market } = await supabase
    .from('markets').select('id, name').eq('is_active', true).limit(1).maybeSingle()
  if (!market) return null

  // 3. Get market material (for display config)
  const { data: mm } = await supabase
    .from('market_materials')
    .select('*')
    .eq('material_catalog_id', material.id)
    .eq('market_id', market.id)
    .eq('is_visible', true)
    .eq('is_available', true)
    .maybeSingle()

  if (!mm) return null

  // 4. Resolve preferred offering for pricing display
  let resolvedOffering: any = null
  try {
    const resolved = await resolveOffering(market.id, material.id)
    resolvedOffering = resolved.offering
  } catch { /* no offering available — still show page with unavailable state */ }

  // 5. Active promotion for this material
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
  return { title: data.name, description: data.description ?? undefined }
}

export default async function MaterialDetailPage({ params }: Props) {
  const { slug } = await params
  const data = await getPageData(slug)
  if (!data) notFound()

  const { material, market, mm, resolvedOffering, promo } = data
  const displayPrice = deriveDisplayPrice(mm.price_display_mode, mm.custom_display_price, resolvedOffering)
  const unit = resolvedOffering?.unit ?? material.default_unit

  return (
    <div className="container-main py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-stone-500 mb-8">
        <Link href="/browse" className="hover:text-stone-300 transition-colors">Materials</Link>
        <ChevronRight size={13} />
        <Link href={`/browse?category=${material.category?.slug}`} className="hover:text-stone-300 transition-colors">
          {material.category?.name}
        </Link>
        <ChevronRight size={13} />
        <span className="text-stone-300">{material.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16">
        {/* ── Left: Info ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Image */}
          <div className="aspect-[16/9] rounded-2xl bg-stone-800 border border-stone-700 overflow-hidden">
            {(mm.display_image_url ?? resolvedOffering?.image_url) ? (
              <img
                src={mm.display_image_url ?? resolvedOffering.image_url}
                alt={material.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={52} className="text-stone-700" />
              </div>
            )}
          </div>

          {/* Title + price */}
          <div>
            <span className="badge-stone text-xs mb-3">{material.category?.name}</span>
            <div className="flex items-start justify-between gap-4 mt-2">
              <h1 className="text-3xl font-bold text-stone-100">
                {mm.display_name ?? material.name}
              </h1>
              {displayPrice != null && (
                <div className="text-right flex-shrink-0">
                  <div className="price-display text-2xl">{formatCurrency(displayPrice)}</div>
                  <div className="text-stone-500 text-sm">per {unitLabel(unit, 1)}</div>
                </div>
              )}
            </div>
            <p className="text-stone-400 mt-3 leading-relaxed text-sm">
              {mm.display_description ?? material.description}
            </p>
          </div>

          {/* Load info */}
          {resolvedOffering?.typical_load_size && displayPrice != null && (
            <div className="card p-4 flex gap-4 items-start">
              <div className="p-2 bg-amber-500/10 rounded-lg flex-shrink-0">
                <Truck size={18} className="text-amber-500" />
              </div>
              <div>
                <div className="font-semibold text-stone-200 text-sm">
                  Typical load: {resolvedOffering.load_size_label ?? `${resolvedOffering.typical_load_size} ${unitLabel(unit, resolvedOffering.typical_load_size)}`}
                </div>
                <div className="text-stone-500 text-xs mt-0.5">
                  Per-load price:{' '}
                  <span className="text-stone-300 font-medium">
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
              <div key={label as string} className="flex items-center gap-2 text-xs text-stone-500">
                <Icon size={13} className="text-stone-600" />
                {label as string}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Order form ── */}
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
              />
            ) : (
              <div className="card p-6 text-center">
                <p className="text-stone-400 font-medium mb-1">
                  {mm.unavailable_reason ?? 'Currently unavailable in your area.'}
                </p>
                <p className="text-stone-600 text-sm">Check back soon or browse other materials.</p>
                <Link href="/browse" className="btn-secondary btn-md mt-4 inline-flex">Browse Materials</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
