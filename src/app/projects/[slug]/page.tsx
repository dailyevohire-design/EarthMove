import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentMarket } from '@/lib/market'
import { resolveMarketFromZip, LAUNCH_MARKET_SLUGS } from '@/lib/zip-market'
import { getProject } from '@/lib/projects'
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
    title: `${project.name} — Earthmove`,
    description: project.description,
    alternates: { canonical: `/projects/${project.slug}` },
  }
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
  redirect(`/order?project=${slug}`)
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) notFound()

  const market = await getCurrentMarket()
  const action = setMarketCookieAction.bind(null, project.slug)
  const audienceLabel = project.audience === 'homeowner' ? 'For homeowners' : 'For contractors'

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
      <main className="bg-[#FAF7F2] py-16 sm:py-24 min-h-[60vh]">
        <div className="mx-auto max-w-3xl px-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-px w-8 bg-[#1F3D2E]/40" aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1F3D2E]/70">
              {audienceLabel}
            </span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-[1.05] tracking-tight mb-5">
            {project.name}
          </h1>
          <p className="text-lg text-stone-600 leading-relaxed mb-10 max-w-xl">
            {project.description}
          </p>
          <div className="flex flex-wrap gap-x-10 gap-y-4 mb-12">
            <div>
              <div className="font-mono uppercase tracking-wider text-stone-500 text-[11px] mb-1">
                Typical tonnage
              </div>
              <div className="font-semibold text-[#1F3D2E] text-lg">
                {project.typicalTons.min}–{project.typicalTons.max} tons
              </div>
            </div>
            <div>
              <div className="font-mono uppercase tracking-wider text-stone-500 text-[11px] mb-1">
                Truck classes
              </div>
              <div className="font-semibold text-[#1F3D2E] text-lg">
                {project.truckClasses.join(' / ')}
              </div>
            </div>
          </div>

          {market ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-7">
              <p className="text-sm text-stone-600 mb-4">
                Browsing prices for{' '}
                <span className="font-semibold text-[#1F3D2E]">{market.name}</span>.
              </p>
              <Link
                href={`/order?project=${project.slug}`}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1F3D2E] px-5 py-3 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#16302A]"
              >
                Continue to order →
              </Link>
              <Link
                href="/browse"
                className="ml-4 inline-flex items-center text-sm font-semibold text-[#1F3D2E] hover:underline"
              >
                Or browse all materials
              </Link>
            </div>
          ) : (
            <form action={action} className="rounded-2xl border border-stone-200 bg-white p-7">
              <p className="text-sm text-stone-600 mb-3">
                Enter your ZIP to see delivered prices in your market.
              </p>
              <div className="flex gap-2 max-w-md">
                <input
                  name="zip"
                  inputMode="numeric"
                  pattern="\d{5}"
                  maxLength={5}
                  placeholder="ZIP code"
                  required
                  className="flex-1 rounded-lg border border-stone-300 bg-white px-4 py-3 font-mono text-[15px] tracking-wider focus:border-[#1F3D2E] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#1F3D2E] px-5 py-3 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#16302A]"
                >
                  See prices
                </button>
              </div>
            </form>
          )}

          <div className="mt-12 pt-6 border-t border-stone-200">
            <Link
              href="/"
              className="font-mono text-[12px] uppercase tracking-[0.14em] text-stone-500 hover:text-[#1F3D2E]"
            >
              ← Back to homepage
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
