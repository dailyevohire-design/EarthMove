import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deriveDisplayPrice } from '@/lib/pricing-engine'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { MaterialCard } from '@/components/marketplace/material-card'
import { localBusinessSchema, breadcrumbSchema, faqSchema, jsonLd } from '@/lib/structured-data'
import Link from 'next/link'
import { MapPin, Truck, ShieldCheck, Clock } from 'lucide-react'
import type { MarketMaterialCard } from '@/types'

interface Props {
  params: Promise<{ city: string }>
}

// Map URL slugs to canonical market slugs. Identity entries for canonical
// slugs ensure /dallas-fort-worth resolves the same as /dallas or /dfw.
const CITY_SLUGS: Record<string, string> = {
  'dallas-fort-worth': 'dallas-fort-worth',
  'dallas': 'dallas-fort-worth', 'dfw': 'dallas-fort-worth', 'fort-worth': 'dallas-fort-worth',
  'houston': 'houston', 'austin': 'austin', 'san-antonio': 'san-antonio',
  'phoenix': 'phoenix', 'denver': 'denver', 'atlanta': 'atlanta',
  'nashville': 'nashville', 'charlotte': 'charlotte', 'tampa': 'tampa',
  'orlando': 'orlando',
  'las-vegas': 'las-vegas', 'vegas': 'las-vegas',
  'raleigh': 'raleigh', 'raleigh-durham': 'raleigh',
  'salt-lake-city': 'salt-lake-city', 'slc': 'salt-lake-city', 'salt-lake': 'salt-lake-city',
  'boise': 'boise',
}

async function getCityData(citySlug: string) {
  const marketSlug = CITY_SLUGS[citySlug]
  if (!marketSlug) return null

  const supabase = await createClient()
  const { data: market } = await supabase
    .from('markets').select('id, name, state, slug')
    .eq('slug', marketSlug).eq('is_active', true).single()
  if (!market) return null

  const { data: rows } = await supabase
    .from('market_materials')
    .select(`
      id, price_display_mode, custom_display_price, is_featured,
      material:material_catalog(id, name, slug, description, default_unit, category:material_categories(name, slug)),
      pool:market_supply_pool(is_preferred, offering:supplier_offerings(price_per_unit, unit, delivery_fee_base, minimum_order_quantity, image_url))
    `)
    .eq('market_id', market.id).eq('is_visible', true).eq('is_available', true)
    .order('sort_order')

  const cards: MarketMaterialCard[] = []
  for (const row of (rows ?? []) as any[]) {
    const material = row.material
    if (!material) continue
    const preferred = row.pool?.find((p: any) => p.is_preferred)
    const offering = preferred?.offering ?? row.pool?.[0]?.offering ?? null
    const displayPrice = deriveDisplayPrice(row.price_display_mode, row.custom_display_price, offering)
    if (displayPrice == null) continue
    cards.push({
      market_material_id: row.id, material_catalog_id: material.id,
      slug: material.slug, name: material.name, description: material.description,
      image_url: offering?.image_url ?? null, category_name: material.category?.name ?? '',
      category_slug: material.category?.slug ?? '', unit: offering?.unit ?? material.default_unit,
      display_price: displayPrice, price_display_mode: row.price_display_mode,
      minimum_order_quantity: offering?.minimum_order_quantity ?? 1,
      delivery_fee_base: offering?.delivery_fee_base ?? null, is_featured: row.is_featured,
      is_deal_of_day: false, badge_label: null, promotion_id: null,
    })
  }
  return { market, cards }
}

export async function generateMetadata({ params }: Props) {
  const { city } = await params
  const data = await getCityData(city)
  if (!data) return { title: 'Not Found' }
  return {
    title: `Bulk Material Delivery in ${data.market.name}, ${data.market.state}`,
    description: `Order fill dirt, gravel, sand, topsoil, road base and more for delivery in ${data.market.name}, ${data.market.state}. Same-day delivery available. ${data.cards.length} materials in stock.`,
    alternates: { canonical: `/${city}` },
    openGraph: {
      title: `Bulk Material Delivery in ${data.market.name} | EarthMove`,
      description: `${data.cards.length} materials available for same-day delivery in ${data.market.name}, ${data.market.state}.`,
    },
  }
}

export default async function CityPage({ params }: Props) {
  const { city } = await params
  const data = await getCityData(city)
  if (!data) notFound()
  const { market, cards } = data

  const cityFaqs = [
    { question: `What materials can I get delivered in ${market.name}?`, answer: `EarthMove delivers ${cards.length} materials in ${market.name}, ${market.state}, including fill dirt, gravel, sand, topsoil, flex base, road base, limestone, crushed concrete, and more. All available for same-day or scheduled delivery.` },
    { question: `How fast can I get materials delivered in ${market.name}?`, answer: `Same-day delivery is available for most materials in ${market.name}. Orders placed before noon are typically delivered the same day. You can also schedule delivery for a future date.` },
    { question: `What area does EarthMove serve around ${market.name}?`, answer: `We deliver within a 50-mile radius of ${market.name}, ${market.state}. Enter your ZIP code to check availability and get an instant delivery quote.` },
  ]

  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(
        localBusinessSchema({ name: market.name, state: market.state, slug: market.slug, materialCount: cards.length })
      ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(
        breadcrumbSchema([{ name: 'Home', url: '/' }, { name: market.name, url: `/${city}` }])
      ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(cityFaqs)) }} />
      <main className="bg-gray-50/30">
        <section className="bg-gray-900 py-16 md:py-20">
          <div className="container-main">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-4">
              <MapPin size={14} />{market.name}, {market.state}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight max-w-3xl">
              Bulk Material Delivery<br />in {market.name}
            </h1>
            <p className="text-gray-400 mt-4 max-w-xl text-lg">
              {cards.length} materials available for same-day or scheduled delivery. Order online in minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-gray-400">
              {[
                { Icon: Truck, label: 'Same-day delivery' },
                { Icon: ShieldCheck, label: 'Secure checkout' },
                { Icon: Clock, label: 'Order in 5 min' },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={14} className="text-emerald-400" />{label}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10 md:py-14">
          <div className="container-main">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Materials available in {market.name}</h2>
            <p className="text-gray-500 text-sm mb-8">{cards.length} materials &middot; Same-day delivery available</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {cards.map(card => (
                <MaterialCard key={card.market_material_id} card={card} />
              ))}
            </div>
          </div>
        </section>

        {/* SEO links to material pages */}
        <section className="py-10 bg-white border-y border-gray-100">
          <div className="container-main">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Browse by material in {market.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {cards.map(card => (
                <Link
                  key={card.slug}
                  href={`/${city}/${card.slug}`}
                  className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-sm font-medium text-gray-700 hover:text-emerald-700"
                >
                  {card.name} in {market.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
        {/* FAQ for AEO */}
        <section className="py-10 md:py-14">
          <div className="container-main">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-3 max-w-3xl">
              {cityFaqs.map((faq, i) => (
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
      </main>
      <SiteFooter />
    </>
  )
}
