import Link from 'next/link'
import { UPL_DISCLAIMER } from '@/lib/collections/disclaimer'

export const metadata = { title: 'Collections Assist — earthmove.io' }

export default function CollectionsLandingPage() {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
          Get Paid for Work You’ve Already Done
        </h1>
        <p className="mt-3 text-sm sm:text-base text-stone-600 max-w-2xl">
          Colorado and Texas (DFW commercial) — $99 flat. Demand letter + pre-lien / intent-to-lien notice + mechanic’s lien. Under 10 minutes.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StateCard
          state="Colorado"
          whoFor="Commercial, industrial, mixed-use, and residential non-homestead properties"
          scope="Homestead properties are excluded."
          bullets={[
            'Demand for payment letter (10-business-day demand)',
            'Notice of Intent to File Mechanic’s Lien (C.R.S. § 38-22-109(3))',
            'Statement of Mechanic’s Lien (C.R.S. § 38-22-109(1))',
            'Supported counties: Denver, Adams, Arapahoe, Boulder, Broomfield, Douglas, El Paso, Jefferson, Larimer, Mesa, Pueblo, Weld, Garfield, Eagle, Summit',
          ]}
        />
        <StateCard
          state="Texas"
          whoFor="Commercial and industrial properties only (DFW counties)"
          scope="Residential and homestead coming in 2026."
          bullets={[
            'Demand for payment letter (10-business-day demand)',
            'Pre-Lien Notice (Tex. Prop. Code § 53.056), role-specific variant',
            'Affidavit of Lien (Tex. Prop. Code § 53.054)',
            'Supported DFW counties: Dallas, Tarrant, Denton, Collin, Rockwall, Kaufman, Ellis, Johnson, Parker, Wise',
          ]}
        />
      </div>

      <div className="mb-10 text-center">
        <Link
          href="/collections/new"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
        >
          Start Your Case →
        </Link>
        <div className="mt-2 text-xs text-stone-500">$99 — pay once, documents generated immediately.</div>
      </div>

      <section
        aria-labelledby="legal-notice-heading"
        className="mb-10 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900"
      >
        <h2 id="legal-notice-heading" className="font-bold mb-2">Legal Notice</h2>
        <p>{UPL_DISCLAIMER}</p>
      </section>

      <section className="mb-10 rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-bold text-stone-900 mb-3">How this is different from a law firm</h2>
        <ul className="space-y-2 text-sm text-stone-700">
          <li>1. We assemble documents from public statutory templates based on information you provide.</li>
          <li>2. We do not give legal advice, review your case merits, or represent you.</li>
          <li>3. For complex cases, fact-specific advice, or disputed facts, you must consult an attorney.</li>
        </ul>
      </section>

      <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500 flex justify-between">
        <div>© Earth Pro Connect LLC</div>
        <Link href="/legal/collections-terms" className="underline hover:text-stone-700">Terms of Service</Link>
      </footer>
    </>
  )
}

function StateCard(props: { state: string; whoFor: string; scope: string; bullets: string[] }) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-extrabold text-stone-900">{props.state}</h3>
      <p className="mt-1 text-xs text-stone-500">{props.whoFor}</p>
      <ul className="mt-4 space-y-1.5 text-sm text-stone-700">
        {props.bullets.map(b => (
          <li key={b} className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-stone-500"><em>{props.scope}</em></p>
    </article>
  )
}
