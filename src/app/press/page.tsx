import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Press Kit | Groundcheck',
  description: 'Press kit for Groundcheck — a free public contractor verification platform from Earth Pro Connect LLC.',
}

export default function PressPage() {
  return (
    <main className="min-h-screen bg-white text-stone-900">
      <article className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Groundcheck Press Kit</h1>
        <p className="text-sm text-stone-500 mt-2">Last updated: May 14, 2026</p>

        <p className="mt-4 text-sm text-stone-500 italic">
          The founder uses &ldquo;J.&rdquo; for public attribution; full identification is
          available to credentialed press on request through{' '}
          <a href="mailto:press@earthmove.io" className="underline">press@earthmove.io</a>.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">About Groundcheck</h2>
        <p className="mt-3 leading-relaxed">
          Groundcheck is a free public contractor verification platform operated
          by Earth Pro Connect LLC, a Denver-based construction technology company.
          Available at <Link href="/trust" className="underline">earthmove.io/trust</Link>,
          Groundcheck compiles publicly available business records into a
          standardized trust report for any contractor, LLC, or supplier.
        </p>
        <p className="mt-3 leading-relaxed">
          The platform launched Monday May 4, 2026, in two markets: Denver,
          Colorado, and Dallas-Fort Worth, Texas. Expansion markets in 2026
          include Portland, Houston, Austin, Phoenix, Las Vegas, Atlanta,
          Orlando, Tampa, and Charlotte.
        </p>
        <p className="mt-3 leading-relaxed">
          Groundcheck&rsquo;s underlying technology is patent-pending across multiple
          U.S. Provisional Applications.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">Mission</h2>
        <p className="mt-3 leading-relaxed">
          Earth Pro Connect LLC has committed to providing 1.5 million meals
          through its partnership with Feeding America&reg; to support neighbors
          facing food insecurity. Every Groundcheck user supports this commitment.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">Origin</h2>
        <p className="mt-3 leading-relaxed">
          Earth Pro Connect LLC was founded after a member of the founder&rsquo;s
          family lost ,000 to a contractor with an expired license, two
          unresolved Better Business Bureau complaints, and a prior court
          judgment from a previous client &mdash; all matters of public record but
          not visible to the family before they signed the contract. Groundcheck
          was built to surface that record before the deposit clears.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">Pre-approved quotes</h2>

        <blockquote className="mt-4 border-l-4 border-emerald-700 pl-5 py-1 italic text-stone-700">
          &ldquo;Every homeowner deserves to know who they&rsquo;re hiring before the
          deposit clears, not after. We&rsquo;ve committed to providing 1.5 million
          meals through our partnership with Feeding America&reg;, and every person
          who uses Groundcheck helps us get there.&rdquo;
          <footer className="mt-2 not-italic text-sm text-stone-500">&mdash; J., founder of Earth Pro Connect LLC</footer>
        </blockquote>

        <blockquote className="mt-4 border-l-4 border-emerald-700 pl-5 py-1 italic text-stone-700">
          &ldquo;Existing contractor verification services are built for enterprise
          procurement. Groundcheck is built for the homeowner who&rsquo;s about to
          write a ,000 check on a kitchen remodel and has no free way to
          check who they&rsquo;re paying.&rdquo;
          <footer className="mt-2 not-italic text-sm text-stone-500">&mdash; J., founder of Earth Pro Connect LLC</footer>
        </blockquote>

        <blockquote className="mt-4 border-l-4 border-emerald-700 pl-5 py-1 italic text-stone-700">
          &ldquo;This isn&rsquo;t a startup launch. It&rsquo;s the launch of the consumer
          protection infrastructure the construction industry should have
          built fifty years ago.&rdquo;
          <footer className="mt-2 not-italic text-sm text-stone-500">&mdash; Earth Pro Connect LLC</footer>
        </blockquote>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">Key facts</h2>
        <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-stone-500">Founded</dt><dd>2026</dd>
          <dt className="text-stone-500">Headquarters</dt><dd>Denver, Colorado</dd>
          <dt className="text-stone-500">Structure</dt><dd>Solo-founder, bootstrapped</dd>
          <dt className="text-stone-500">Patent</dt><dd>Patent-pending &mdash; Multiple U.S. Provisional Applications</dd>
          <dt className="text-stone-500">Launch markets</dt><dd>Denver; Dallas-Fort Worth</dd>
          <dt className="text-stone-500">Mission</dt><dd>1.5 million meals committed through Feeding America&reg; partnership</dd>
          <dt className="text-stone-500">Pricing</dt><dd>Free unlimited searches for signed-in users. Pro tier .99/month.</dd>
        </dl>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">Press kit assets</h2>
        <ul className="mt-3 list-disc pl-5 space-y-1 text-sm">
          <li><a href="/press/press-release.pdf" className="underline">Press release (PDF)</a></li>
          <li><a href="/press/state-of-contractor-trust.pdf" className="underline">State of Contractor Trust data piece (PDF)</a></li>
          <li><a href="/press/groundcheck-wordmark-evergreen.svg" className="underline">Wordmark (SVG, evergreen on cream)</a></li>
          <li><a href="/press/groundcheck-k-mark.svg" className="underline">K mark only (SVG)</a></li>
          <li><a href="/press/product-demo.mp4" className="underline">Product demo (90s MP4)</a></li>
        </ul>
        <p className="text-sm text-stone-500 mt-3">
          Assets are uploaded as the launch window progresses; if a link 404s,
          email <a href="mailto:press@earthmove.io" className="underline">press@earthmove.io</a> and we will send within four hours.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">Media contact</h2>
        <p className="mt-3 leading-relaxed">
          Earth Pro Connect LLC<br/>
          Press inquiries: <a href="mailto:press@earthmove.io" className="underline">press@earthmove.io</a><br/>
          Response time during launch week: within four business hours.
        </p>

        <p className="text-xs text-stone-500 mt-12">
          * helps provide at least 10 meals secured by Feeding America&reg; on
          behalf of local partner food banks.
        </p>
      </article>
    </main>
  )
}
