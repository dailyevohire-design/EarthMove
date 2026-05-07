import type { Metadata } from 'next'
import Link from 'next/link'
import { PROJECTS } from '@/lib/projects'
import { breadcrumbSchema, jsonLd } from '@/lib/structured-data'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Projects — match the material to the job',
  description:
    'Pick the project — driveway, drainage, backfill, garden, concrete — and we match the material to the job and route the cheapest delivered yard in your market.',
  alternates: { canonical: '/projects' },
}

export default function ProjectsIndex() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Projects', url: '/projects' },
            ]),
          ),
        }}
      />
      <main className="marketing-v6 mx-auto max-w-6xl px-6 py-12 md:py-16">
        <header>
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[#1F3D2E]/40" aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1F3D2E]/70">Projects</span>
          </div>
          <h1 className="mt-4 font-serif text-4xl font-medium leading-[1.05] tracking-tight text-[#1F3D2E] md:text-6xl">
            Match the material <em className="italic font-normal">to the job.</em>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#1F3D2E]/75">
            Five families. Every truck class. We route the cheapest delivered yard in your market for the project you&apos;re actually doing.
          </p>
        </header>
        <ol className="mt-12 border-t border-[#1F3D2E]/15 md:mt-16">
          {PROJECTS.map((p, i) => (
            <li key={p.slug} className="border-b border-[#1F3D2E]/15">
              <Link
                href={`/projects/${p.slug}`}
                className="grid grid-cols-12 items-baseline gap-x-6 gap-y-2 py-7 transition hover:bg-[#1F3D2E]/[0.025] md:gap-x-8 md:py-9"
              >
                <span className="col-span-2 font-mono text-sm tracking-wider text-[#1F3D2E] md:col-span-1">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="col-span-10 font-serif text-2xl font-medium text-[#1F3D2E] md:col-span-3 md:text-3xl">
                  {p.name}
                </h3>
                <p className="col-span-12 text-base leading-relaxed text-[#1F3D2E]/75 md:col-span-5 md:text-[17px]">
                  {p.description}
                </p>
                <span className="col-span-12 font-mono text-[11px] uppercase tracking-[0.16em] text-[#1F3D2E]/60 md:col-span-3 md:text-right">
                  Typical {p.typicalTons.min}–{p.typicalTons.max} tons · {p.truckClasses.join(' / ')}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </main>
    </>
  )
}
