import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Checkout — EarthMove',
  description: 'Sign up to save 5% or continue as guest. Your project is locked in.',
}

interface SearchParams {
  material_catalog_id?: string
  material?: string
  tons?: string
  zip?: string
  project_type?: string
  sub_type?: string
  delivery_window?: string
  source?: string
}

export default async function CheckoutStartPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const tons = params.tons ? parseFloat(params.tons) : 0

  // Guard: missing required context → bounce back to the quiz
  if (!params.material_catalog_id || !Number.isFinite(tons) || tons <= 0) {
    redirect('/material-match')
  }

  // Forward all match params into /checkout (drop control-only `source`).
  const forward = new URLSearchParams()
  forward.set('material_catalog_id', params.material_catalog_id)
  if (params.material) forward.set('material', params.material)
  forward.set('tons', String(tons))
  if (params.zip) forward.set('zip', params.zip)
  if (params.project_type) forward.set('project_type', params.project_type)
  if (params.sub_type) forward.set('sub_type', params.sub_type)
  if (params.delivery_window) forward.set('delivery_window', params.delivery_window)

  const checkoutHref = `/checkout?${forward.toString()}`
  const guestHref    = `/checkout?guest=1&${forward.toString()}`
  const signupHref   = `/signup?redirectTo=${encodeURIComponent(checkoutHref)}&from_order=1`
  const loginHref    = `/login?redirectTo=${encodeURIComponent(checkoutHref)}`

  const materialName   = params.material ?? 'Bulk material'
  const zipDisplay     = params.zip ?? ''
  const deliveryWindow = params.delivery_window?.replace(/_/g, ' ') ?? 'flexible'

  return (
    <main className="em-surface min-h-screen">
      <div className="max-w-[1200px] mx-auto px-8 py-12 md:py-16">

        {/* Page header */}
        <header className="max-w-[720px] mx-auto text-center mb-9">
          <div className="inline-block text-xs font-semibold text-[#0a6e3f] tracking-[0.18em] uppercase mb-4">
            Ready to order
          </div>
          <h1 className="font-fraunces text-5xl md:text-[56px] leading-[1.06] font-medium tracking-[-0.02em] text-[#1a1f1c] mb-3.5 text-pretty">
            Almost there — how do you want to check out?
          </h1>
          <p className="text-lg text-[#6b6e6c] leading-[1.5]">
            Your project is locked in. Pick how you want to handle the rest.
          </p>
        </header>

        <section
          aria-label="Your project"
          className="max-w-[1080px] mx-auto mb-8 bg-[#e8f1ec] border border-[rgba(10,110,63,0.14)] rounded-xl h-20 flex items-center px-6 gap-5"
        >
          <div className="flex items-center gap-3.5 flex-shrink-0">
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-full bg-[#0a6e3f] text-white flex items-center justify-center flex-shrink-0"
            >
              <Check className="w-4 h-4" strokeWidth={3} />
            </span>
            <span className="font-semibold text-[15px] text-[#1a1f1c]">
              Your project
            </span>
          </div>
          <div className="flex-1 font-mono text-[13px] font-medium text-[#3a3f3c] tracking-[0.04em] uppercase text-center px-3 truncate">
            {tons} tons<span className="text-[#6b6e6c] mx-2">·</span>{materialName}{zipDisplay && (<><span className="text-[#6b6e6c] mx-2">·</span>{zipDisplay}</>)}<span className="text-[#6b6e6c] mx-2">·</span>{deliveryWindow}
          </div>
          <Link
            href="/material-match"
            className="text-[#0a6e3f] hover:text-[#084d2c] font-semibold text-sm flex-shrink-0 transition-colors"
          >
            Edit&nbsp;→
          </Link>
        </section>

        {/* Two-card fork */}
        <section
          aria-label="Checkout method"
          className="max-w-[1080px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8"
        >
          {/* Sign-up card (recommended) */}
          <article className="relative rounded-xl px-6 md:px-8 pt-9 pb-8 bg-[#f0f7f3] border-2 border-[#0a6e3f] flex flex-col">
            <span className="absolute -top-[13px] right-6 bg-[#0a6e3f] text-white text-[11px] font-bold tracking-[0.14em] uppercase px-3.5 py-1.5 rounded-full">
              Recommended
            </span>

            <h3 className="font-fraunces text-3xl md:text-[32px] leading-[1.1] font-medium tracking-[-0.015em] text-[#1a1f1c] mb-2">
              Sign up + save 5%
            </h3>
            <p className="text-sm text-[#6b6e6c] mb-6 leading-[1.5]">
              Takes about 30 seconds. WELCOME5 applied automatically.
            </p>

            <hr className="border-0 h-px bg-[rgba(0,0,0,0.08)] mb-6" />

            <ul className="flex flex-col gap-3.5 mb-7">
              {[
                ['5% off this order', 'Applied at checkout, single-use code.'],
                ['Live driver tracking', 'See your truck on the map, ETA, photo on delivery.'],
                ['All your paperwork in one place', 'BOLs, scale tickets, invoices ready for your books.'],
                ['Project continuity', 'Orders grouped by job, spend rolls up automatically.'],
                ['Team invites with spend limits', 'Let your foreman order without owner approval.'],
                ['Reorder in two taps', 'Past order → reorder → confirm.'],
                ['At-risk project alerts', 'Catch when spend outpaces progress.'],
              ].map(([title, desc]) => (
                <li key={title} className="flex gap-3 items-start">
                  <span
                    aria-hidden="true"
                    className="w-5 h-5 rounded-full bg-[#0a6e3f] text-white flex items-center justify-center flex-shrink-0 mt-0.5"
                  >
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                  <div className="flex-1">
                    <b className="block font-semibold text-[15px] text-[#1a1f1c] leading-tight">{title}</b>
                    <span className="block text-[13.5px] text-[#6b6e6c] leading-[1.45] mt-0.5">{desc}</span>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              href={signupHref}
              className="mt-auto inline-flex items-center justify-center bg-[#0a6e3f] hover:bg-[#084d2c] text-white font-fraunces font-semibold text-lg h-14 rounded-xl transition-colors"
            >
              Sign up + save 5% <ArrowRight className="ml-2 w-5 h-5" strokeWidth={2.5} />
            </Link>
            <p className="text-[12px] text-[#6b6e6c] text-center mt-3">
              Free. No credit card needed to sign up.
            </p>
          </article>

          {/* Guest card */}
          <article className="relative rounded-xl px-6 md:px-8 pt-9 pb-8 bg-white border border-[rgba(0,0,0,0.08)] flex flex-col">
            <h3 className="font-fraunces text-3xl md:text-[32px] leading-[1.1] font-medium tracking-[-0.015em] text-[#1a1f1c] mb-2">
              Continue as guest
            </h3>
            <p className="text-sm text-[#6b6e6c] mb-6 leading-[1.5]">
              Order now, decide later if you want an account.
            </p>

            <hr className="border-0 h-px bg-[rgba(0,0,0,0.08)] mb-6" />

            <ul className="flex flex-col gap-3 mb-7">
              {[
                'One-time checkout',
                'Email receipt with order details',
                'No account, no password',
              ].map((line) => (
                <li key={line} className="flex gap-3 items-center text-[14.5px] text-[#3a3f3c]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6b6e6c] flex-shrink-0" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>

            <div className="flex-1" />

            <Link
              href={guestHref}
              className="mt-auto inline-flex items-center justify-center bg-white hover:bg-[#fafafa] text-[#0a6e3f] font-fraunces font-semibold text-lg h-14 rounded-xl border border-[#0a6e3f] transition-colors"
            >
              Continue as guest <ArrowRight className="ml-2 w-5 h-5" strokeWidth={2.5} />
            </Link>
            <p className="text-[12px] text-[#6b6e6c] text-center mt-3">
              We&apos;ll save your order to your email — you can claim it later.
            </p>
          </article>
        </section>

        {/* Login link below cards */}
        <p className="text-center text-sm text-[#6b6e6c] mt-8">
          Already have an account?{' '}
          <Link href={loginHref} className="text-[#0a6e3f] hover:text-[#084d2c] font-semibold transition-colors">
            Log in →
          </Link>
        </p>

        {/* Payment-method strip */}
        <section
          aria-label="Accepted payment methods"
          className="max-w-[1080px] mx-auto mt-12 pt-8 border-t border-[rgba(0,0,0,0.08)] flex flex-col items-center gap-3"
        >
          <div className="text-[11px] font-semibold text-[#6b6e6c] tracking-[0.18em] uppercase">
            Accepting
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-[11.5px] font-medium text-[#6b6e6c] tracking-[0.06em] uppercase">
            <span>Visa</span>
            <span>Mastercard</span>
            <span>Amex</span>
            <span>ACH</span>
            <span>Apple Pay</span>
            <span>Google Pay</span>
            <span>Klarna</span>
            <span>Affirm</span>
          </div>
        </section>

      </div>
    </main>
  )
}
