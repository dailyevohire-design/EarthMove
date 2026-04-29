import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMarket } from '@/lib/market'
import { deriveDisplayPrice } from '@/lib/pricing-engine'
import type { MarketMaterialCard } from '@/types'
import Link from 'next/link'
import { collectionPageSchema, itemListSchema, breadcrumbSchema, jsonLd } from '@/lib/structured-data'
import { HeroBand } from '@/components/marketplace/browse-v2/HeroBand'
import { DealsCarousel } from '@/components/marketplace/browse-v2/DealsCarousel'
import { BrowseFilterBar } from '@/components/marketplace/browse-v2/BrowseFilterBar'
import { CategoryGroup } from '@/components/marketplace/browse-v2/CategoryGroup'

const FRAUNCES = "'Fraunces', serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"

interface BrowseProps {
  searchParams: Promise<{ category?: string; deals?: string }>
}

async function getCards(marketId: string, categorySlug?: string, dealsOnly?: boolean) {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: rows } = await supabase
    .from('market_materials')
    .select(`
      id, price_display_mode, custom_display_price, is_featured, sort_order,
      material:material_catalog(
        id, name, slug, description, default_unit,
        category:material_categories(id, name, slug)
      ),
      pool:market_supply_pool(
        is_preferred,
        offering:supplier_offerings(
          price_per_unit, unit, delivery_fee_base, minimum_order_quantity, image_url
        )
      )
    `)
    .eq('market_id', marketId)
    .eq('is_visible', true)
    .eq('is_available', true)
    .order('is_featured', { ascending: false })
    .order('sort_order')

  if (!rows) return []

  const { data: promos } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .or(`market_id.eq.${marketId},market_id.is.null`)

  const cards: MarketMaterialCard[] = []

  for (const row of rows as any[]) {
    const material = row.material
    if (!material) continue
    if (categorySlug && material.category?.slug !== categorySlug) continue

    const preferred = row.pool?.find((p: any) => p.is_preferred)
    const offering = preferred?.offering ?? row.pool?.[0]?.offering ?? null
    const displayPrice = deriveDisplayPrice(row.price_display_mode, row.custom_display_price, offering)
    if (displayPrice == null) continue

    const promo = (promos ?? []).find(
      (p: any) => p.material_catalog_id === material.id || (offering && p.offering_id === offering.id)
    ) ?? null

    if (dealsOnly && !promo) continue

    cards.push({
      market_material_id: row.id,
      material_catalog_id: material.id,
      slug: material.slug,
      name: material.name,
      description: material.description,
      image_url: offering?.image_url ?? null,
      category_name: material.category?.name ?? '',
      category_slug: material.category?.slug ?? '',
      unit: offering?.unit ?? material.default_unit,
      display_price: displayPrice,
      price_display_mode: row.price_display_mode,
      minimum_order_quantity: offering?.minimum_order_quantity ?? 1,
      delivery_fee_base: offering?.delivery_fee_base ?? null,
      is_featured: row.is_featured,
      is_deal_of_day: promo?.is_deal_of_day ?? false,
      badge_label: promo?.badge_label ?? null,
      promotion_id: promo?.id ?? null,
    })
  }
  return cards
}

async function getCategories() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('material_categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export const metadata = {
  title: 'Browse Bulk Materials for Delivery',
  description: 'Browse fill dirt, gravel, sand, topsoil, road base, crushed concrete and 9 more materials. Filter by category. Same-day delivery available.',
  alternates: { canonical: '/browse' },
  openGraph: {
    title: 'Browse Bulk Materials | EarthMove',
    description: 'Fill dirt, gravel, sand, topsoil, flex base, and more. 15 materials available for same-day delivery.',
  },
}

export default async function BrowsePage({ searchParams }: BrowseProps) {
  // searchParams preserved for API compatibility; V2 renders all categories on one page (anchor nav).
  // followup: scroll-to-anchor for ?category=, deals=1 redirect to /deals.
  await searchParams

  const market = await getCurrentMarket()
  const marketId = market?.id ?? null
  const [cards, categoriesRaw] = await Promise.all([
    marketId ? getCards(marketId) : [],
    getCategories(),
  ])

  const marketName = market?.name ?? 'your market'

  // Empty categories must NEVER render — filter to categories with at least one card in this market.
  const categoriesEnriched = (categoriesRaw as Array<{ id: string; name: string; slug: string }>)
    .map((cat) => {
      const catCards = cards.filter((c) => c.category_slug === cat.slug)
      if (catCards.length === 0) return null
      const prices = catCards.map((c) => c.display_price)
      const allTon = catCards.every((c) => c.unit === 'ton')
      const allYd = catCards.every((c) => c.unit === 'cubic_yard')
      const unit = allTon ? 'ton' : allYd ? 'yd³' : 'unit'
      return {
        slug: cat.slug,
        name: cat.name,
        materialCount: catCards.length,
        priceMin: Math.min(...prices),
        priceMax: Math.max(...prices),
        unit,
        cards: catCards,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const totalCount = cards.length

  const collectionSchema = collectionPageSchema({
    name: 'All Bulk Materials',
    description: `${totalCount} bulk materials available for delivery${market ? ` in ${market.name}` : ''}.`,
    url: '/browse',
    itemCount: totalCount,
  })
  const listSchema = itemListSchema(
    cards.slice(0, 20).map((c) => ({
      name: c.name,
      url: `/browse/${c.slug}`,
      image: c.image_url ?? undefined,
      price: c.display_price ?? null,
      unit: c.unit,
    }))
  )
  const crumbs = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Browse', url: '/browse' },
  ])

  return (
    <div id="cat-top" className="min-h-screen" style={{ background: '#F1ECE2', color: '#15201B' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(collectionSchema) }} />
      {totalCount > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(listSchema) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbs) }} />

      <main className="max-w-[1440px] mx-auto px-10">
        <HeroBand
          marketName={marketName}
          materialCount={totalCount}
          categoryCount={categoriesEnriched.length}
        />

        <DealsCarousel marketName={marketName} />

        <BrowseFilterBar
          categories={categoriesEnriched.map((c) => ({
            slug: c.slug,
            name: c.name,
            materialCount: c.materialCount,
          }))}
          totalCount={totalCount}
        />

        {categoriesEnriched.map((cat) => (
          <CategoryGroup
            key={cat.slug}
            category={{ slug: cat.slug, name: cat.name }}
            priceRange={{ min: cat.priceMin, max: cat.priceMax, unit: cat.unit }}
            cards={cat.cards}
          />
        ))}

        <FooterBand />
      </main>
    </div>
  )
}

function FooterBand() {
  return (
    <section className="mt-16 pt-12 pb-16" style={{ borderTop: '1px solid #D8D2C4' }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <FooterCard
          eyebrow="For drivers"
          title={<>Hauling for EarthMove pays <em className="italic font-medium">weekly</em>, not on net-30.</>}
          body="If you run a tri-axle, tandem, or end-dump in the DFW metro, we have steady runs from 6 yards inside the loop. Settled at end of week. Real dispatch, no chasing checks."
          primary={{ href: '/drivers', label: 'Apply to drive' }}
          link={{ href: '/drivers#requirements', label: 'Requirements →' }}
        />
        <FooterCard
          eyebrow="For contractors"
          title={<>Open a contractor account, <em className="italic font-medium">build a reorder list</em>.</>}
          body="Saved drop sites, billing on PO, FCRA-compliant trust reports for new subs, and one ticketing trail across every load you order. Free to open."
          primary={{ href: '/sign-up?role=contractor', label: 'Open an account' }}
          link={{ href: '/contractors', label: "What's included →" }}
        />
      </div>

      <div
        className="mt-8 pt-[18px] pb-8 flex justify-between items-center gap-3.5 flex-wrap text-[11px] tracking-[0.04em] text-[#5C645F]"
        style={{ borderTop: '1px solid #D8D2C4', fontFamily: MONO }}
      >
        <span>EarthMove, Inc. &middot; 3220 Singleton Blvd, Dallas TX 75212</span>
        <ul className="flex gap-[18px] list-none m-0 p-0">
          <li><Link href="/about" className="hover:text-[#15201B]">About</Link></li>
          <li><Link href="/contact" className="hover:text-[#15201B]">Contact</Link></li>
          <li><Link href="/legal/terms" className="hover:text-[#15201B]">Terms</Link></li>
          <li><Link href="/legal/privacy" className="hover:text-[#15201B]">Privacy</Link></li>
          <li><Link href="/legal/fcra" className="hover:text-[#15201B]">FCRA disclosure</Link></li>
        </ul>
      </div>
    </section>
  )
}

function FooterCard({
  eyebrow,
  title,
  body,
  primary,
  link,
}: {
  eyebrow: string
  title: ReactNode
  body: string
  primary: { href: string; label: string }
  link: { href: string; label: string }
}) {
  return (
    <div
      className="rounded-[24px] p-8 flex flex-col gap-3.5"
      style={{ background: '#F6F2E8', border: '1px solid #D8D2C4' }}
    >
      <span
        className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2A332E] whitespace-nowrap"
        style={{ fontFamily: SANS }}
      >
        <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#2A332E]" />
        {eyebrow}
      </span>
      <h3
        className="text-[24px] sm:text-[28px] lg:text-[32px] font-semibold tracking-[-0.02em] leading-[1.05] text-[#15201B] m-0 max-w-[20ch]"
        style={{ fontFamily: FRAUNCES }}
      >
        {title}
      </h3>
      <p className="text-[14px] text-[#2A332E] leading-[1.55] m-0 max-w-[54ch]" style={{ textWrap: 'pretty' }}>
        {body}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2.5 items-center">
        <Link
          href={primary.href}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[14px] px-[18px] py-3 bg-[#E5701B] text-white border border-transparent hover:bg-[#C95F12] transition-colors"
          style={{ fontFamily: SANS }}
        >
          {primary.label}
        </Link>
        <Link
          href={link.href}
          className="text-[14px] font-medium text-[#2A332E] hover:text-[#15201B]"
          style={{ fontFamily: SANS }}
        >
          {link.label}
        </Link>
      </div>
    </div>
  )
}
