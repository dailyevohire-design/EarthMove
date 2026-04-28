import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket } from '@/lib/market'
import { deriveDisplayPrice, formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { resolveOffering } from '@/lib/fulfillment-resolver'
import { getMaterialImage } from '@/lib/material-images'
import { productSchema, breadcrumbSchema, faqSchema, jsonLd } from '@/lib/structured-data'
import {
  ChevronRight,
  Car, Truck, Layers, Droplets, Square, Trees, Grid3x3, Cable, Sprout,
  Flower, Mountain, TrendingUp, Waves, Anchor, Boxes, Palette, Leaf, Recycle,
  Circle,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { SectionLabel, DisplayH1, Lozenge } from '@/components/design-system/earthmove-ds.jsx'
import { getCategoryContent, getTimelineSteps, type IconName } from './_content'
import { CalculatorBlock } from './CalculatorBlock'
import { CommerceBlock } from './CommerceBlock'
import { StickyRail } from './StickyRail'

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

const ICON_MAP: Record<IconName, LucideIcon> = {
  driveway: Car, equipment: Truck, subbase: Layers,
  drainage: Droplets, concrete: Square, landscape: Trees,
  paver: Grid3x3, pipe: Cable, lawn: Sprout,
  garden: Flower, grading: Mountain, slope: TrendingUp,
  channel: Waves, shoreline: Anchor, fill: Boxes,
  topdress: Palette, mulch: Leaf, compost: Recycle,
}

function UseCaseIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  const C = ICON_MAP[name] ?? Circle
  return <C size={size} />
}

export default async function MaterialDetailPage({ params }: Props) {
  const { slug } = await params
  const data = await getPageData(slug)
  if (!data) notFound()

  const { material, market, mm, resolvedOffering, promo } = data
  const displayPrice = deriveDisplayPrice(mm.price_display_mode, mm.custom_display_price, resolvedOffering)
  const unit = (resolvedOffering?.unit ?? material.default_unit) as 'ton' | 'cubic_yard'
  const supplierName: string | null = resolvedOffering?.supply_yard?.supplier?.name ?? null
  const yardName: string | null = resolvedOffering?.supply_yard?.name ?? null

  const isStateA = !!resolvedOffering && displayPrice != null
  const categoryContent = getCategoryContent(material.category?.slug)
  const timeline = getTimelineSteps(isStateA ? 'A' : 'B', supplierName)
  const aliases: string[] = Array.isArray(material.aliases) ? material.aliases : []

  return (
    <div className="container-main py-8">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(
        productSchema({
          name: material.name, slug: material.slug, description: material.description,
          category: material.category?.name, price: displayPrice,
          unit, image: getMaterialImage(material.slug),
        })
      ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(
        breadcrumbSchema([
          { name: 'Materials', url: '/browse' },
          { name: material.category?.name ?? 'Category', url: `/browse?category=${material.category?.slug}` },
          { name: material.name, url: `/browse/${material.slug}` },
        ])
      ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(categoryContent.faqs)) }} />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm mb-8" style={{ color: 'var(--em-ink-3)' }}>
        <Link href="/browse" className="hover:opacity-80 transition-opacity">Materials</Link>
        <ChevronRight size={13} />
        <Link href={`/browse?category=${material.category?.slug}`} className="hover:opacity-80 transition-opacity">
          {material.category?.name}
        </Link>
        <ChevronRight size={13} />
        <span style={{ color: 'var(--em-ink)' }}>{material.name}</span>
      </nav>

      {/* Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
        <div className="lg:col-span-3">
          <div className="aspect-[16/10] rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--em-hair)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getMaterialImage(material.slug)}
              alt={`${material.name} — bulk aggregate material available for delivery`}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div className="lg:col-span-2 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <Lozenge>{material.category?.name ?? 'Material'}</Lozenge>
            {isStateA ? (
              <Lozenge variant="solid-emerald" dot>Available now · {market.name}</Lozenge>
            ) : (
              <Lozenge variant="solid-orange" dot>Quote-only · {market.name}</Lozenge>
            )}
          </div>
          <DisplayH1 size="md">{mm.display_name ?? material.name}</DisplayH1>
          <p className="mt-4 text-base leading-relaxed" style={{ color: 'var(--em-ink-2)' }}>
            {mm.display_description ?? material.description ?? `Bulk ${material.name.toLowerCase()} delivered to your site.`}
          </p>
          {aliases.length > 0 && (
            <div className="mt-5 text-xs" style={{ color: 'var(--em-ink-3)' }}>
              <span className="font-semibold uppercase tracking-[0.14em] mr-2">Also known as</span>
              {aliases.join(' · ')}
            </div>
          )}
        </div>
      </section>

      {/* At-a-glance */}
      <AtAGlance
        unit={unit}
        density={material.density_tons_per_cuyd}
        categoryName={material.category?.name ?? null}
        marketName={market.name}
        supplierName={supplierName}
        yardName={yardName}
        minQty={resolvedOffering?.minimum_order_quantity ?? null}
        typicalLoad={resolvedOffering?.typical_load_size ?? null}
        loadSizeLabel={resolvedOffering?.load_size_label ?? null}
        deliveryFeeBase={resolvedOffering?.delivery_fee_base ?? null}
        deliveryFeePerMile={resolvedOffering?.delivery_fee_per_mile ?? null}
        maxDeliveryMiles={resolvedOffering?.max_delivery_miles ?? null}
      />

      {/* Commerce panel */}
      <div className="mt-10">
        {isStateA ? (
          <CommerceBlock
            state="A"
            materialSlug={material.slug}
            unit={unit}
            displayPrice={displayPrice as number}
            overridePrice={promo?.override_price ?? null}
            minQty={resolvedOffering.minimum_order_quantity ?? 1}
            typicalLoadSize={resolvedOffering.typical_load_size ?? null}
            loadSizeLabel={resolvedOffering.load_size_label ?? null}
            deliveryFeeBase={resolvedOffering.delivery_fee_base ?? null}
            deliveryFeePerMile={resolvedOffering.delivery_fee_per_mile ?? null}
            maxDeliveryMiles={resolvedOffering.max_delivery_miles ?? null}
            supplierName={supplierName}
            yardName={yardName}
            marketName={market.name}
          />
        ) : (
          <CommerceBlock
            state="B"
            materialSlug={material.slug}
            unit={unit}
            unavailableReason={mm.unavailable_reason ?? null}
            marketName={market.name}
          />
        )}
      </div>

      {/* Calculator */}
      <div className="mt-10">
        <CalculatorBlock
          density={material.density_tons_per_cuyd ?? null}
          defaultUnit={unit}
          pricePerUnit={displayPrice}
        />
      </div>

      {/* What it's good for */}
      <section className="mt-14">
        <SectionLabel>What it&apos;s good for</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {categoryContent.useCases.map((u) => (
            <div
              key={u.title}
              className="rounded-2xl border p-5"
              style={{ background: 'var(--em-card)', borderColor: 'var(--em-hair)' }}
            >
              <div
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3"
                style={{ background: 'var(--em-card-muted)', color: 'var(--em-emerald)' }}
              >
                <UseCaseIcon name={u.iconName} />
              </div>
              <div className="text-base font-semibold" style={{ color: 'var(--em-ink)' }}>
                {u.title}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--em-ink-2)' }}>
                {u.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* From the yard to your drop */}
      <section className="mt-14">
        <SectionLabel>From the yard to your drop</SectionLabel>
        <ol className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 list-none p-0">
          {timeline.map((t) => (
            <li
              key={t.step}
              className="rounded-2xl border p-5 relative"
              style={{ background: 'var(--em-card)', borderColor: 'var(--em-hair)' }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-2"
                style={{ color: 'var(--em-ink-3)' }}
              >
                Step {t.step}
              </div>
              <div className="text-base font-semibold" style={{ color: 'var(--em-ink)' }}>
                {t.title}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--em-ink-2)' }}>
                {t.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="mt-14 mb-16">
        <SectionLabel>Frequently asked</SectionLabel>
        <div className="space-y-3 mt-4">
          {categoryContent.faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-2xl border overflow-hidden"
              style={{ background: 'var(--em-card)', borderColor: 'var(--em-hair)' }}
            >
              <summary
                className="flex items-center justify-between p-5 cursor-pointer hover:opacity-90 transition-opacity"
                style={{ color: 'var(--em-ink)' }}
              >
                <span className="text-sm font-semibold pr-4">{faq.question}</span>
                <ChevronRight size={16} className="flex-shrink-0 transition-transform group-open:rotate-90" style={{ color: 'var(--em-ink-3)' }} />
              </summary>
              <div className="px-5 pb-5 text-sm leading-relaxed" style={{ color: 'var(--em-ink-2)' }}>
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Sticky rail (State A only) */}
      {isStateA && displayPrice != null && (
        <StickyRail
          materialSlug={material.slug}
          materialName={mm.display_name ?? material.name}
          unit={unit}
          pricePerUnit={displayPrice}
          defaultQty={resolvedOffering.typical_load_size ?? resolvedOffering.minimum_order_quantity ?? 1}
        />
      )}
    </div>
  )
}

interface AtAGlanceProps {
  unit: 'ton' | 'cubic_yard'
  density: number | null
  categoryName: string | null
  marketName: string
  supplierName: string | null
  yardName: string | null
  minQty: number | null
  typicalLoad: number | null
  loadSizeLabel: string | null
  deliveryFeeBase: number | null
  deliveryFeePerMile: number | null
  maxDeliveryMiles: number | null
}

function AtAGlance(p: AtAGlanceProps) {
  const cells: { label: string; value: string }[] = []

  cells.push({ label: 'Sold by', value: unitLabel(p.unit, 2) })
  if (p.density != null) cells.push({ label: 'Density', value: `${p.density.toFixed(2)} t/yd³` })
  if (p.categoryName) cells.push({ label: 'Category', value: p.categoryName })
  cells.push({ label: 'Market', value: p.marketName })

  if (p.supplierName) {
    const tag = p.yardName ? `${p.supplierName} · ${p.yardName}` : p.supplierName
    cells.push({ label: 'Sourced from', value: tag })
  }
  if (p.minQty != null) cells.push({ label: 'Minimum order', value: `${p.minQty} ${unitLabel(p.unit, p.minQty)}` })
  if (p.loadSizeLabel) {
    cells.push({ label: 'Typical load', value: p.loadSizeLabel })
  } else if (p.typicalLoad != null) {
    cells.push({ label: 'Typical load', value: `${p.typicalLoad} ${unitLabel(p.unit, p.typicalLoad)}` })
  }
  if (p.deliveryFeeBase != null) {
    const perMile = p.deliveryFeePerMile != null ? ` + ${formatCurrency(p.deliveryFeePerMile)}/mi` : ''
    cells.push({ label: 'Delivery', value: `${formatCurrency(p.deliveryFeeBase)} base${perMile}` })
  }
  if (p.maxDeliveryMiles != null) {
    cells.push({ label: 'Service radius', value: `${p.maxDeliveryMiles} mi from yard` })
  }

  const visible = cells.slice(0, 8)

  return (
    <div
      className="rounded-2xl border"
      style={{ background: 'var(--em-card)', borderColor: 'var(--em-hair)' }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4">
        {visible.map((c, i) => (
          <div
            key={c.label}
            className="p-5"
            style={{
              borderRight: (i + 1) % 4 === 0 ? 'none' : '1px solid var(--em-hair)',
              borderBottom: i < visible.length - (visible.length % 4 || 4) ? '1px solid var(--em-hair)' : 'none',
            }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5"
              style={{ color: 'var(--em-ink-3)' }}
            >
              {c.label}
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--em-ink)' }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
