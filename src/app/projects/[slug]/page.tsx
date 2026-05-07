import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCurrentMarket } from '@/lib/market'
import { resolveMarketFromZip, LAUNCH_MARKET_SLUGS } from '@/lib/zip-market'
import { pickBestOffering, type BestOfferingInput } from '@/lib/best-offering'
import { getProject, type ProjectIntent } from '@/lib/projects'
import { breadcrumbSchema, jsonLd } from '@/lib/structured-data'
import { SetProjectIntent } from '../SetProjectIntent'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) return { title: 'Project not found' }
  return {
    title: `${project.name} — materials by project`,
    description: project.description,
    alternates: { canonical: `/projects/${project.slug}` },
  }
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) notFound()

  // 1. Try market_id cookie
  let market = await getCurrentMarket()

  // 2. If no cookie market, attempt Vercel edge geo postal code header
  if (!market) {
    const h = await headers()
    const geoZip = h.get('x-vercel-ip-postal-code')?.trim() ?? ''
    if (/^\d{5}$/.test(geoZip)) {
      const match = resolveMarketFromZip(geoZip)
      if (match && (LAUNCH_MARKET_SLUGS as readonly string[]).includes(match.market_slug)) {
        const sb = await createClient()
        const { data: row } = await sb
          .from('markets')
          .select('id, name, slug, state, center_lat, center_lng')
          .eq('slug', match.market_slug)
          .eq('is_active', true)
          .maybeSingle()
        if (row) market = row
      }
    }
  }

  // 3. No market resolvable → render inline zip form
  if (!market) {
    return <ZipPrompt project={project} />
  }

  // 4. If project not available in this market → empty state with notify capture
  if (!project.availableMarkets.includes(market.slug as ProjectIntent['availableMarkets'][number])) {
    return <EmptyState project={project} marketName={market.name} />
  }

  // 5. Resolve material slugs → ids in this catalog
  const supabase = await createClient()
  const { data: catalog } = await supabase
    .from('material_catalog')
    .select('id, slug, name, description, default_unit, density_tons_per_cuyd')
    .in('slug', project.materialSlugs)
    .eq('is_active', true)

  type CatalogRow = {
    id: string
    slug: string
    name: string
    description: string | null
    default_unit: 'ton' | 'cubic_yard'
    density_tons_per_cuyd: number | null
  }
  const catalogRows = (catalog ?? []) as CatalogRow[]
  const catalogById = new Map(catalogRows.map((c) => [c.id, c]))
  const ids = catalogRows.map((c) => c.id)

  if (ids.length === 0) {
    return <EmptyState project={project} marketName={market.name} />
  }

  // 6. Fetch offerings in this market for these materials
  const { data: offers } = await supabase
    .from('supplier_offerings')
    .select(`
      material_catalog_id,
      unit,
      price_per_unit,
      delivery_fee_base,
      delivery_fee_per_mile,
      max_delivery_miles,
      typical_load_size,
      minimum_order_quantity,
      supply_yard:supply_yards!inner(id, market_id, is_active, lat, lng)
    `)
    .in('material_catalog_id', ids)
    .eq('is_public', true)
    .eq('is_available', true)
    .gt('price_per_unit', 0)
    .eq('supply_yard.is_active', true)
    .eq('supply_yard.market_id', market.id)

  type OfferRow = {
    material_catalog_id: string
    unit: 'ton' | 'cubic_yard' | 'load' | 'each'
    price_per_unit: number
    delivery_fee_base: number | null
    delivery_fee_per_mile: number | null
    max_delivery_miles: number | null
    typical_load_size: number | null
    minimum_order_quantity: number | null
    supply_yard: { id: string; market_id: string; is_active: boolean; lat: number | null; lng: number | null }
  }
  const offerRows = (offers ?? []) as unknown as OfferRow[]

  if (offerRows.length === 0) {
    return <EmptyState project={project} marketName={market.name} />
  }

  // 7. Group by material, run pickBestOffering per material
  const byMaterial = new Map<string, OfferRow[]>()
  for (const o of offerRows) {
    const arr = byMaterial.get(o.material_catalog_id) ?? []
    arr.push(o)
    byMaterial.set(o.material_catalog_id, arr)
  }

  const cookieStore = await cookies()
  const customerZip = cookieStore.get('customer_zip')?.value ?? null
  const zipForPicker = customerZip && /^\d{5}$/.test(customerZip) ? customerZip : null

  interface MaterialCardRow {
    slug: string
    name: string
    description: string | null
    unit: 'ton' | 'cubic_yard'
    perTonForSort: number
    perUnitDelivered: number
    minOrderQty: number | null
  }

  const cards: MaterialCardRow[] = []
  await Promise.all(
    Array.from(byMaterial.entries()).map(async ([matId, rows]) => {
      const inputs: BestOfferingInput[] = rows.map((o) => ({
        id: matId,
        yardId: o.supply_yard.id,
        yardLat: o.supply_yard.lat,
        yardLng: o.supply_yard.lng,
        pricePerUnit: o.price_per_unit,
        deliveryFeeBase: o.delivery_fee_base,
        deliveryFeePerMile: o.delivery_fee_per_mile,
        maxDeliveryMiles: o.max_delivery_miles,
        typicalLoadSize: o.typical_load_size,
      }))
      const best = await pickBestOffering(inputs, zipForPicker)
      if (zipForPicker && !best) return
      const winningRow = best
        ? rows.find((r) => r.supply_yard.id === best.offering.yardId) ?? rows[0]
        : rows[0]
      const perUnitDelivered = best ? best.deliveredPerUnit : winningRow.price_per_unit

      const cat = catalogById.get(matId)
      if (!cat) return
      const unit = cat.default_unit
      const density = cat.density_tons_per_cuyd ?? 1.4 // fallback density for sort only

      const perTonForSort =
        unit === 'cubic_yard' && density > 0
          ? perUnitDelivered / density
          : perUnitDelivered

      const minOrderQty = rows.reduce<number | null>((acc, o) => {
        if (o.minimum_order_quantity == null) return acc
        return acc == null ? o.minimum_order_quantity : Math.min(acc, o.minimum_order_quantity)
      }, null)

      cards.push({
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        unit,
        perTonForSort,
        perUnitDelivered,
        minOrderQty,
      })
    }),
  )

  cards.sort((a, b) => a.perTonForSort - b.perTonForSort)

  if (cards.length === 0) {
    return <EmptyState project={project} marketName={market.name} />
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Projects', url: '/projects' },
              { name: project.name, url: `/projects/${project.slug}` },
            ]),
          ),
        }}
      />
      <SetProjectIntent slug={project.slug} />
      <main className="marketing-v6 mx-auto max-w-6xl px-6 py-12 md:py-16">
        <ProjectHeader project={project} marketName={market.name} />
        <ul className="mt-10 grid grid-cols-1 gap-4 md:mt-12 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/browse/${c.slug}`}
                className="group block h-full rounded-xl border border-[#1F3D2E]/15 bg-white p-6 transition hover:border-[#1F3D2E]/35 hover:shadow-[0_18px_40px_-22px_rgba(15,20,17,0.18)]"
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#1F3D2E]/60">
                  {project.name}
                </div>
                <h3 className="mt-3 font-serif text-xl font-medium text-[#1F3D2E] md:text-2xl">{c.name}</h3>
                {c.description && (
                  <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-[#1F3D2E]/70">{c.description}</p>
                )}
                <div className="mt-5 flex items-baseline justify-between border-t border-[#1F3D2E]/10 pt-4">
                  <div className="font-mono text-[12px] uppercase tracking-wider text-[#1F3D2E]/60">
                    {zipForPicker ? 'Delivered' : 'From'}
                  </div>
                  <div className="font-serif text-2xl text-[#1F3D2E]">
                    ${c.perUnitDelivered.toFixed(2)}
                    <span className="ml-1 text-[12px] font-normal tracking-wider text-[#1F3D2E]/60">
                      /{c.unit === 'ton' ? 'ton' : 'cu yd'}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}

function ProjectHeader({ project, marketName }: { project: ProjectIntent; marketName: string }) {
  return (
    <header>
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-[#1F3D2E]/40" aria-hidden />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1F3D2E]/70">
          Project · {marketName}
        </span>
      </div>
      <h1 className="mt-4 font-serif text-4xl font-medium leading-[1.05] tracking-tight text-[#1F3D2E] md:text-6xl">
        {project.name}
      </h1>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#1F3D2E]/75">{project.description}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {project.tagChips.map((c) => (
          <span
            key={c}
            className="rounded-md border border-[#1F3D2E]/15 bg-[#F5F1E8] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-[#1F3D2E]/70"
          >
            {c}
          </span>
        ))}
      </div>
      <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[#1F3D2E]/60">
        Typical {project.typicalTons.min}–{project.typicalTons.max} tons · Fits{' '}
        <span className="text-[#1F3D2E]/85">{project.truckClasses.join(' / ')}</span>
      </div>
    </header>
  )
}

async function setMarketCookieAction(slug: string, formData: FormData) {
  'use server'
  const zip = String(formData.get('zip') ?? '').trim()
  if (!/^\d{5}$/.test(zip)) {
    redirect(`/projects/${slug}?zip_error=invalid`)
  }
  const match = resolveMarketFromZip(zip)
  if (!match || !(LAUNCH_MARKET_SLUGS as readonly string[]).includes(match.market_slug)) {
    redirect(`/projects/${slug}?zip_error=oos`)
  }
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('markets')
    .select('id')
    .eq('slug', match!.market_slug)
    .eq('is_active', true)
    .maybeSingle()
  if (!row?.id) {
    redirect(`/projects/${slug}?zip_error=db`)
  }
  const cookieStore = await cookies()
  cookieStore.set('market_id', row!.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  cookieStore.set('customer_zip', zip, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  revalidatePath(`/projects/${slug}`)
  redirect(`/projects/${slug}`)
}

function ZipPrompt({ project }: { project: ProjectIntent }) {
  const action = setMarketCookieAction.bind(null, project.slug)
  return (
    <main className="marketing-v6 mx-auto max-w-2xl px-6 py-16 md:py-24">
      <SetProjectIntent slug={project.slug} />
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-[#1F3D2E]/40" aria-hidden />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1F3D2E]/70">Project</span>
      </div>
      <h1 className="mt-4 font-serif text-4xl font-medium leading-[1.05] tracking-tight text-[#1F3D2E] md:text-6xl">
        {project.name}
      </h1>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#1F3D2E]/75">
        Tell us your ZIP and we&apos;ll show delivered prices for {project.name.toLowerCase()} in your market.
      </p>
      <form action={action} className="mt-8 flex max-w-md gap-2">
        <input
          name="zip"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          placeholder="ZIP code"
          required
          className="flex-1 rounded-lg border border-[#1F3D2E]/20 bg-white px-4 py-3 font-mono text-[15px] tracking-wider text-[#1F3D2E] focus:border-[#1F3D2E] focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-[#1F3D2E] px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-[#F5F1E8] hover:bg-[#16302A]"
        >
          See prices
        </button>
      </form>
    </main>
  )
}

async function notifyAction(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim()
  const zip = String(formData.get('zip') ?? '').trim()
  if (!email.includes('@')) {
    return
  }
  const sb = await createClient()
  await sb.from('waitlist').insert({ email, zip: zip || null })
  redirect(`/projects/${String(formData.get('slug') ?? '')}?notified=1`)
}

function EmptyState({ project, marketName }: { project: ProjectIntent; marketName: string }) {
  return (
    <main className="marketing-v6 mx-auto max-w-2xl px-6 py-16 md:py-24">
      <SetProjectIntent slug={project.slug} />
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-[#1F3D2E]/40" aria-hidden />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1F3D2E]/70">
          Coming soon · {marketName}
        </span>
      </div>
      <h1 className="mt-4 font-serif text-4xl font-medium leading-[1.05] tracking-tight text-[#1F3D2E] md:text-6xl">
        {project.name}
      </h1>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#1F3D2E]/75">
        We&apos;re adding suppliers in {marketName} for {project.name.toLowerCase()} — get notified when live.
      </p>
      <form action={notifyAction} className="mt-8 flex max-w-md flex-col gap-2 sm:flex-row">
        <input type="hidden" name="slug" value={project.slug} />
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="flex-1 rounded-lg border border-[#1F3D2E]/20 bg-white px-4 py-3 text-[15px] text-[#1F3D2E] focus:border-[#1F3D2E] focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-[#1F3D2E] px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-[#F5F1E8] hover:bg-[#16302A]"
        >
          Notify me
        </button>
      </form>
      <div className="mt-10 border-t border-[#1F3D2E]/15 pt-6">
        <Link
          href="/projects"
          className="font-mono text-[12px] uppercase tracking-[0.14em] text-[#1F3D2E]/70 hover:text-[#1F3D2E]"
        >
          ← All projects
        </Link>
      </div>
    </main>
  )
}

