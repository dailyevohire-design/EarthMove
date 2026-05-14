import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { deriveDisplayPrice, formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { QuantityCalculator } from '@/components/marketplace/quantity-calculator'
import Link from 'next/link'
import { productSchema, breadcrumbSchema, faqSchema, getMaterialFAQs, jsonLd } from '@/lib/structured-data'
import { MapPin, CheckCircle2 } from 'lucide-react'

interface Props {
  params: Promise<{ city: string; material: string }>
}

// Map URL slugs to market slugs
const CITY_SLUGS: Record<string, string> = {
  'dallas-fort-worth': 'dallas-fort-worth',
  'dallas': 'dallas-fort-worth',
  'dfw': 'dallas-fort-worth',
  'fort-worth': 'dallas-fort-worth',
  'houston': 'houston',
  'austin': 'austin',
  'san-antonio': 'san-antonio',
  'phoenix': 'phoenix',
  'denver': 'denver',
  'atlanta': 'atlanta',
  'nashville': 'nashville',
  'charlotte': 'charlotte',
  'tampa': 'tampa',
  'orlando': 'orlando',
  'las-vegas': 'las-vegas', 'vegas': 'las-vegas',
  'raleigh': 'raleigh', 'raleigh-durham': 'raleigh',
  'salt-lake-city': 'salt-lake-city', 'slc': 'salt-lake-city', 'salt-lake': 'salt-lake-city',
  'boise': 'boise',
}

const DENSITY: Record<string, number> = {
  'fill-dirt': 1.1, 'select-fill': 1.1, 'topsoil': 1.0,
  'concrete-sand': 1.35, 'masonry-sand': 1.35, 'utility-sand': 1.35,
  'pea-gravel': 1.4, 'base-gravel-57': 1.4,
  'flex-base': 1.5, 'road-base': 1.5,
  'washed-river-rock': 1.35, 'limestone': 1.5, 'rip-rap': 1.5,
  'crushed-concrete': 1.3, 'decomposed-granite': 1.4,
}

async function getData(citySlug: string, materialSlug: string) {
  const marketSlug = CITY_SLUGS[citySlug]
  if (!marketSlug) return null

  const supabase = await createClient()

  const { data: market } = await supabase
    .from('markets')
    .select('id, name, state, slug')
    .eq('slug', marketSlug)
    .eq('is_active', true)
    .single()
  if (!market) return null

  const { data: material } = await supabase
    .from('material_catalog')
    .select('*, category:material_categories(name, slug)')
    .eq('slug', materialSlug)
    .eq('is_active', true)
    .single()
  if (!material) return null

  const { data: mm } = await supabase
    .from('market_materials')
    .select('*')
    .eq('material_catalog_id', material.id)
    .eq('market_id', market.id)
    .eq('is_visible', true)
    .eq('is_available', true)
    .maybeSingle()
  if (!mm) return null

  // Get preferred offering for pricing
  const { data: poolEntry } = await supabase
    .from('market_supply_pool')
    .select('offering:supplier_offerings(price_per_unit, unit, delivery_fee_base, minimum_order_quantity, image_url, typical_load_size, load_size_label)')
    .eq('market_material_id', mm.id)
    .eq('is_preferred', true)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const offering = (poolEntry as any)?.offering ?? null

  return { market, material, mm, offering }
}

export async function generateMetadata({ params }: Props) {
  const { city, material } = await params
  const data = await getData(city, material)
  if (!data) return { title: 'Not Found' }

  const cityName = data.market.name
  const matName = data.material.name
  const displayPrice = deriveDisplayPrice(data.mm.price_display_mode, data.mm.custom_display_price, data.offering)

  return {
    title: `${matName} Delivery in ${cityName}`,
    description: `Order ${matName.toLowerCase()} for delivery in ${cityName}, ${data.market.state}. ${displayPrice ? `Starting at ${formatCurrency(displayPrice)} per ${data.material.default_unit === 'cubic_yard' ? 'cubic yard' : 'ton'}. ` : ''}Same-day delivery available. Order online in minutes.`,
    alternates: { canonical: `/${city}/${material}` },
    openGraph: {
      title: `${matName} Delivery in ${cityName} | EarthMove`,
      description: `Order ${matName.toLowerCase()} for delivery in ${cityName}. ${displayPrice ? `From ${formatCurrency(displayPrice)}/${data.material.default_unit === 'cubic_yard' ? 'yd' : 'ton'}. ` : ''}Same-day delivery.`,
    },
  }
}

export default async function LocationMaterialPage({ params }: Props) {
  const { city, material: materialSlug } = await params
  const data = await getData(city, materialSlug)
  if (!data) notFound()

  const { market, material, mm, offering } = data
  const displayPrice = deriveDisplayPrice(mm.price_display_mode, mm.custom_display_price, offering)
  const unit = offering?.unit ?? material.default_unit
  const density = DENSITY[material.slug] ?? 1.3
  const cityDisplay = market.name

  const faqs = getMaterialFAQs(material.name, cityDisplay, displayPrice ?? undefined, unit)
  const citySlugForUrl = city

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(
        productSchema({
          name: `${material.name} in ${cityDisplay}`, slug: material.slug,
          description: material.description, category: material.category?.name,
          price: displayPrice, unit, image: material.image_url ?? '',
        })
      ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(
        breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: cityDisplay, url: `/${citySlugForUrl}` },
          { name: material.name, url: `/${citySlugForUrl}/${material.slug}` },
        ])
      ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(faqs)) }} />
      <main style={{ background: '#F1ECE2' }}>
        {/* Hero — industrial commerce-panel */}
        <section data-surface="commerce-panel" className="relative overflow-hidden py-16 md:py-24" style={{ background: '#14322A' }}>
          {material.image_url && (
            <Image
              src={material.image_url}
              alt={material.name}
              fill
              priority
              sizes="100vw"
              className="absolute inset-0 object-cover opacity-25"
            />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(120deg, rgba(15,41,32,0.92) 0%, rgba(20,50,42,0.78) 60%, rgba(20,50,42,0.4) 100%)' }} />
          <div className="container-main relative z-10">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] mb-5" style={{ color: '#E5701B', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}>
              <MapPin size={13} />
              {cityDisplay}, {market.state}
            </div>
            <h1 className="font-fraunces text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight max-w-3xl" style={{ color: '#F1ECE2', letterSpacing: '-0.02em' }}>
              {material.name} delivered{' '}
              <em style={{ color: '#E5701B', fontStyle: 'italic' }}>in {cityDisplay}.</em>
            </h1>
            {displayPrice != null && (
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-fraunces text-3xl md:text-4xl font-semibold" style={{ color: '#F1ECE2', letterSpacing: '-0.015em' }}>{formatCurrency(displayPrice)}</span>
                <span className="text-sm uppercase tracking-[0.1em]" style={{ color: 'rgba(241,236,226,0.6)', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}>per {unitLabel(unit, 1)}</span>
              </div>
            )}
            <p className="mt-5 max-w-xl text-base md:text-lg leading-relaxed" style={{ color: 'rgba(241,236,226,0.78)' }}>
              {material.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-9">
              <Link
                href={`/browse/${material.slug}`}
                className="inline-flex items-center justify-center gap-2 font-semibold text-base py-4 px-8 rounded-xl transition-colors"
                style={{ background: '#E5701B', color: '#F1ECE2' }}
              >
                Order now
              </Link>
              <a
                href="#calculator"
                className="inline-flex items-center justify-center gap-2 font-medium text-base py-4 px-8 rounded-xl transition-colors border"
                style={{ background: 'rgba(241,236,226,0.06)', borderColor: 'rgba(241,236,226,0.18)', color: '#F1ECE2' }}
              >
                Calculate amount
              </a>
            </div>
          </div>
        </section>

        {/* Quick facts — dashboard chrome */}
        <section className="border-b" style={{ background: '#F1ECE2', borderColor: 'rgba(21,32,27,0.10)' }}>
          <div className="container-main py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Delivery', value: `From ${offering?.delivery_fee_base ? formatCurrency(offering.delivery_fee_base) : '$85'}` },
                { label: 'Min order', value: `${offering?.minimum_order_quantity ?? 2} ${unitLabel(unit, offering?.minimum_order_quantity ?? 2)}` },
                { label: 'Typical load', value: offering?.load_size_label ?? '14-ton load' },
                { label: 'Availability', value: 'In stock' },
              ].map(({ label, value }) => (
                <div key={label} className="px-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-1" style={{ color: '#5C645F', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}>{label}</div>
                  <div className="font-fraunces text-xl md:text-2xl font-semibold" style={{ color: '#15201B', letterSpacing: '-0.015em' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Calculator */}
        <section id="calculator" className="py-14 md:py-20" style={{ background: '#F1ECE2' }}>
          <div className="container-main max-w-3xl">
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: '#5C645F', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}>Quantity</div>
            <h2 className="font-fraunces text-3xl md:text-4xl font-semibold mb-3" style={{ color: '#15201B', letterSpacing: '-0.02em' }}>
              How much {material.name.toLowerCase()} do you need?
            </h2>
            <p className="text-base md:text-lg mb-10" style={{ color: '#5C645F' }}>Enter your project dimensions and we&rsquo;ll calculate the exact amount.</p>
            {displayPrice != null && (
              <QuantityCalculator
                materialName={material.name}
                unit={unit}
                pricePerUnit={displayPrice}
                densityTonsPerCY={density}
                orderUrl={`/browse/${material.slug}`}
              />
            )}
          </div>
        </section>

        {/* Use cases */}
        <section className="py-14 md:py-20 border-y" style={{ background: '#E9E3D5', borderColor: 'rgba(21,32,27,0.10)' }}>
          <div className="container-main max-w-3xl">
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: '#5C645F', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}>Specification</div>
            <h2 className="font-fraunces text-3xl md:text-4xl font-semibold mb-8" style={{ color: '#15201B', letterSpacing: '-0.02em' }}>
              Common uses for {material.name.toLowerCase()}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {getUseCases(material.slug).map((uc, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl border" style={{ background: '#FFFFFF', borderColor: 'rgba(21,32,27,0.08)' }}>
                  <CheckCircle2 size={18} style={{ color: '#E5701B' }} className="flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-medium" style={{ color: '#2A332E' }}>{uc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ for AEO */}
        <section className="py-14 md:py-20" style={{ background: '#F1ECE2' }}>
          <div className="container-main max-w-3xl">
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: '#5C645F', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}>Questions</div>
            <h2 className="font-fraunces text-3xl md:text-4xl font-semibold mb-7" style={{ color: '#15201B', letterSpacing: '-0.02em' }}>
              {material.name} FAQ
            </h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <details key={i} className="group rounded-xl overflow-hidden border" style={{ background: '#FFFFFF', borderColor: 'rgba(21,32,27,0.10)' }}>
                  <summary className="flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-[#F6F2E8]">
                    <span className="text-sm font-semibold pr-4" style={{ color: '#15201B' }}>{faq.question}</span>
                    <span className="flex-shrink-0 transition-transform group-open:rotate-90" style={{ color: '#5C645F' }}>&#8250;</span>
                  </summary>
                  <div className="px-4 pb-4 text-sm leading-relaxed" style={{ color: '#2A332E' }}>{faq.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Local CTA — dark panel + orange button */}
        <section className="py-14 md:py-20" style={{ background: '#F1ECE2' }}>
          <div className="container-main max-w-3xl">
            <div data-surface="commerce-panel" className="rounded-2xl p-9 md:p-12 text-center relative overflow-hidden" style={{ background: '#14322A' }}>
              <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(229,112,27,0.25) 0%, transparent 60%)' }} />
              <div className="relative">
                <div className="inline-block text-[10px] uppercase tracking-[0.14em] font-semibold mb-4" style={{ color: '#E5701B', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}>Live in {cityDisplay}</div>
                <h2 className="font-fraunces text-3xl md:text-4xl font-semibold mb-3" style={{ color: '#F1ECE2', letterSpacing: '-0.02em' }}>
                  Get {material.name.toLowerCase()} delivered{' '}
                  <em style={{ color: '#E5701B', fontStyle: 'italic' }}>in {cityDisplay}.</em>
                </h2>
                <p className="mb-7 text-base" style={{ color: 'rgba(241,236,226,0.72)' }}>Order online in under 5 minutes. Same-day delivery available.</p>
                <Link
                  href={`/browse/${material.slug}`}
                  className="inline-flex items-center justify-center font-semibold text-base py-4 px-9 rounded-xl transition-colors"
                  style={{ background: '#E5701B', color: '#F1ECE2' }}
                >
                  Order {material.name} now
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

function getUseCases(slug: string): string[] {
  const cases: Record<string, string[]> = {
    'fill-dirt': ['Backfilling foundations and trenches', 'Raising ground elevation', 'Grading and leveling yards', 'Site preparation for construction', 'Filling holes and low spots', 'Base material under driveways'],
    'select-fill': ['Structural backfill behind retaining walls', 'Under concrete slabs and foundations', 'Utility trench backfill', 'Road subgrade material', 'Engineering-specified fill projects', 'Commercial construction fill'],
    'topsoil': ['New lawn installation', 'Garden bed preparation', 'Raised bed filling', 'Landscape grading', 'Sod preparation', 'Tree and shrub planting'],
    'concrete-sand': ['Concrete mixing', 'Mortar preparation', 'Paver base leveling', 'Pipe bedding', 'Under brick and flagstone', 'Stucco application'],
    'masonry-sand': ['Mortar mixing', 'Paver joint filling', 'Stucco finishing', 'Sandbox filling', 'Volleyball courts', 'Decorative landscaping'],
    'utility-sand': ['Trench backfill', 'Pipe bedding', 'General fill', 'Drainage improvement', 'Under-slab cushion', 'Void filling'],
    'pea-gravel': ['Walkways and pathways', 'Patio surfaces', 'French drain fill', 'Playground surfacing', 'Decorative ground cover', 'Dog runs and pet areas'],
    'base-gravel-57': ['Drainage behind retaining walls', 'French drain systems', 'Under concrete slabs', 'Driveway base course', 'Decorative landscape stone', 'Dry well filling'],
    'flex-base': ['Driveway construction', 'Parking area base', 'Ranch road building', 'Building pad preparation', 'Temporary construction roads', 'Equipment staging areas'],
    'road-base': ['Road construction', 'Driveway foundations', 'Parking lot base', 'Trail building', 'Equipment pad bases', 'General foundation work'],
    'washed-river-rock': ['Dry creek beds', 'Water features', 'Garden borders', 'Tree ring decoration', 'Ground cover', 'Drainage channels'],
    'limestone': ['Driveway surfacing', 'Drainage solutions', 'Retaining wall backfill', 'Erosion control', 'Decorative landscaping', 'Path and walkway surfacing'],
    'rip-rap': ['Shoreline stabilization', 'Erosion control', 'Drainage channel lining', 'Slope protection', 'Culvert protection', 'Decorative boulder features'],
    'crushed-concrete': ['Driveway base layer', 'Temporary construction roads', 'Parking lot subbase', 'Fill material', 'Trail construction', 'Eco-friendly alternative to virgin aggregate'],
    'decomposed-granite': ['Natural pathways', 'Patio surfacing', 'Xeriscaping ground cover', 'Rustic walkways', 'Low-water landscaping', 'Between stepping stones'],
  }
  return cases[slug] ?? ['Construction projects', 'Landscaping', 'Driveway work', 'Foundation work', 'Drainage solutions', 'General fill']
}
