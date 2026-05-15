import Link from 'next/link'
import { UPL_DISCLAIMER } from '@/lib/collections/disclaimer'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Contractor Payment Kit — earthmove.io' }

export default function CollectionsLandingPage() {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
          Contractor Payment Kit
        </h1>
        <p className="mt-3 text-sm sm:text-base text-stone-600 max-w-2xl">
          $49 — Colorado and Texas. Demand letter, filing-ready document templates, and a step-by-step guide to collect what you&rsquo;re owed. You stay in control, and you do the filing.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">What you get in 10 minutes of intake</div>
          <ul className="space-y-2 text-sm text-stone-700">
            <li className="flex items-start gap-2"><span className="text-emerald-600 font-bold">1.</span> A 15–25 page instruction packet tailored to your state. Plain English, step-by-step, every statute cross-referenced to the free public statute portal.</li>
            <li className="flex items-start gap-2"><span className="text-emerald-600 font-bold">2.</span> A demand-for-payment letter ready to send by certified mail.</li>
            <li className="flex items-start gap-2"><span className="text-emerald-600 font-bold">3.</span> A pre-lien or intent-to-lien notice for the state you selected.</li>
            <li className="flex items-start gap-2"><span className="text-emerald-600 font-bold">4.</span> The lien document itself, ready to notarize and file at your county recorder.</li>
          </ul>
          <p className="mt-3 text-xs text-stone-500"><em>Four PDFs total for a full kit. Two PDFs for Texas homestead cases without a pre-work contract — we&rsquo;ll tell you which during intake.</em></p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">What you do with the kit</div>
          <ul className="space-y-2 text-sm text-stone-700">
            <li className="flex items-start gap-2"><span className="text-amber-600 font-bold">1.</span> Read the instruction packet first.</li>
            <li className="flex items-start gap-2"><span className="text-amber-600 font-bold">2.</span> Verify the legal language against the statute links we provide.</li>
            <li className="flex items-start gap-2"><span className="text-amber-600 font-bold">3.</span> Sign the lien in front of a notary (UPS Store, bank, AAA — usually $5&ndash;$25).</li>
            <li className="flex items-start gap-2"><span className="text-amber-600 font-bold">4.</span> Send notices by certified mail with return receipt requested.</li>
            <li className="flex items-start gap-2"><span className="text-amber-600 font-bold">5.</span> File at your county recorder or clerk. The packet lists exactly where.</li>
          </ul>
        </div>
      </div>

      <section className="mb-8 rounded-2xl border border-stone-300 bg-white p-5">
        <div className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">What we are and are not</div>
        <p className="text-sm text-stone-700 leading-relaxed">
          Earth Pro Connect LLC is not a law firm. This kit contains document templates and a plain-English guide for contractors who want to pursue payment without an attorney. The templates are intentionally marked with &ldquo;customer verification required&rdquo; callouts where you must check the current state statute. You file the documents; we give you the roadmap.
        </p>
        <p className="mt-3 text-sm text-stone-700 leading-relaxed">
          If your case is complex, contested, or past any statutory deadline, stop and consult an attorney licensed in the property&rsquo;s state.
        </p>
      </section>

      <div className="mb-10 text-center rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Contractor Payment Kit</div>
        <div className="text-4xl font-extrabold text-stone-900">$49</div>
        <div className="mt-1 text-xs text-stone-500">one-time, no subscription, Colorado and Texas</div>
        <Link
          href="/collections/new"
          className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
        >
          Start Your Case — $49 →
        </Link>
      </div>

      <section
        aria-labelledby="legal-notice-heading"
        className="mb-10 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900"
      >
        <h2 id="legal-notice-heading" className="font-bold mb-2">Legal Notice</h2>
        <p>{UPL_DISCLAIMER}</p>
      </section>

      <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500 flex justify-between">
        <div>© Earth Pro Connect LLC</div>
        <Link href="/legal/collections-terms" className="underline hover:text-stone-700">Terms of Service</Link>
      </footer>
    </>
  )
}
