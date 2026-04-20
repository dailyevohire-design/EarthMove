import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deriveDisplayPrice, formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { QuantityCalculator } from '@/components/marketplace/quantity-calculator'
import Link from 'next/link'
import { getMaterialImage } from '@/lib/material-images'
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
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(
        productSchema({
          name: `${material.name} in ${cityDisplay}`, slug: material.slug,
          description: material.description, category: material.category?.name,
          price: displayPrice, unit, image: getMaterialImage(material.slug),
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
      <main className="bg-gray-50/30">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gray-900 py-16 md:py-20">
          <div className="absolute inset-0">
              <img src={getMaterialImage(material.slug)} alt={material.name} className="absolute inset-0 w-full h-full object-cover opacity-30" />
              <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 to-gray-900/60" />
          </div>
          <div className="container-main relative z-10">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-4">
              <MapPin size={14} />
              {cityDisplay}, {market.state}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight max-w-3xl">
              {material.name} Delivery<br />in {cityDisplay}
            </h1>
            {displayPrice != null && (
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-400">{formatCurrency(displayPrice)}</span>
                <span className="text-gray-400">per {unitLabel(unit, 1)}</span>
              </div>
            )}
            <p className="text-gray-400 mt-4 max-w-xl text-lg leading-relaxed">
              {material.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href={`/browse/${material.slug}`} className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg py-4 px-8 rounded-2xl transition-all duration-200 shadow-2xl shadow-emerald-500/30">
                Order Now
              </Link>
              <a href="#calculator" className="inline-flex items-center justify-center gap-2 bg-white/10 text-white border border-white/20 hover:bg-white/20 font-bold text-lg py-4 px-8 rounded-2xl transition-all duration-200">
                Calculate Amount Needed
              </a>
            </div>
          </div>
        </section>

        {/* Quick facts */}
        <section className="bg-white border-b border-gray-100 py-6">
          <div className="container-main">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Delivery', value: `From ${offering?.delivery_fee_base ? formatCurrency(offering.delivery_fee_base) : '$85'}` },
                { label: 'Min Order', value: `${offering?.minimum_order_quantity ?? 2} ${unitLabel(unit, offering?.minimum_order_quantity ?? 2)}` },
                { label: 'Typical Load', value: offering?.load_size_label ?? '14-ton load' },
                { label: 'Availability', value: 'In stock' },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-3">
                  <div className="text-lg font-extrabold text-gray-900">{value}</div>
                  <div className="text-xs text-gray-500 font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Calculator */}
        <section id="calculator" className="py-12 md:py-16">
          <div className="container-main max-w-3xl">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">How much {material.name.toLowerCase()} do you need?</h2>
            <p className="text-gray-500 mb-8">Enter your project dimensions and we&apos;ll calculate the exact amount.</p>
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
        <section className="py-12 md:py-16 bg-white border-y border-gray-100">
          <div className="container-main max-w-3xl">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-8">Common uses for {material.name.toLowerCase()}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {getUseCases(material.slug).map((uc, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 text-sm font-medium">{uc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ for AEO */}
        <section className="py-12 md:py-16">
          <div className="container-main max-w-3xl">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6">{material.name} FAQ</h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <details key={i} className="group border border-gray-200 rounded-xl overflow-hidden bg-white">
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                    <span className="text-sm font-semibold text-gray-900 pr-4">{faq.question}</span>
                    <span className="text-gray-400 flex-shrink-0 transition-transform group-open:rotate-90">&#8250;</span>
                  </summary>
                  <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{faq.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Local CTA */}
        <section className="py-12 md:py-16">
          <div className="container-main max-w-3xl">
            <div className="bg-emerald-600 rounded-2xl p-8 md:p-12 text-center">
              <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">
                Get {material.name.toLowerCase()} delivered in {cityDisplay}
              </h2>
              <p className="text-emerald-100 mb-6">Order online in under 5 minutes. Same-day delivery available.</p>
              <Link href={`/browse/${material.slug}`} className="inline-flex items-center justify-center bg-white text-emerald-700 hover:bg-emerald-50 font-bold text-lg py-4 px-8 rounded-2xl shadow-xl transition-all duration-200">
                Order {material.name} Now
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
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
