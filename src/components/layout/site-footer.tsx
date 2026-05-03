import Link from 'next/link'
import { Logo } from '@/components/logo'

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block ml-1 transition-transform group-hover:translate-x-1">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <>
      {/* ── Pre-footer CTA ── */}
      <section className="bg-emerald-950 text-white">
        <div className="container-main py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Drivers */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-800 p-8 md:p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-emerald-700/20 -translate-y-10 translate-x-10" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <Logo variant="mark" size={20} theme="reverse" />
                  <span className="text-xs font-bold tracking-widest uppercase text-emerald-400">For Drivers</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2 leading-tight">
                  Your truck. Your schedule.<br className="hidden sm:block" />
                  <span className="text-emerald-400">Same-day pay.</span>
                </h3>
                <p className="text-emerald-200/80 text-sm leading-relaxed mb-6 max-w-sm">
                  Haul fill dirt, gravel, sand, and road base across 10 cities. No contracts. No app to download. Free driver dashboard included.
                </p>
                <Link
                  href="/join"
                  className="group inline-flex items-center gap-2 bg-white text-emerald-900 font-bold text-sm px-6 py-3 rounded-xl hover:bg-emerald-50 transition-all shadow-lg shadow-black/10 active:scale-[0.98]"
                >
                  Start hauling
                  <ArrowRight />
                </Link>
              </div>
            </div>

            {/* Contractors */}
            <div className="rounded-2xl bg-gradient-to-br from-stone-800 to-stone-700 p-8 md:p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-stone-600/20 -translate-y-10 translate-x-10" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <Logo variant="mark" size={20} theme="reverse" />
                  <span className="text-xs font-bold tracking-widest uppercase text-emerald-400">For Contractors</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2 leading-tight">
                  Your crew. Your terms.<br className="hidden sm:block" />
                  <span className="text-emerald-400">Better clients.</span>
                </h3>
                <p className="text-stone-300/80 text-sm leading-relaxed mb-6 max-w-sm">
                  Get matched with earthwork projects. Check any contractor's risk score before you work with them — court filings, liens, reviews. Free forever.
                </p>
                <Link
                  href="/join"
                  className="group inline-flex items-center gap-2 bg-white text-stone-900 font-bold text-sm px-6 py-3 rounded-xl hover:bg-stone-50 transition-all shadow-lg shadow-black/10 active:scale-[0.98]"
                >
                  Join the network
                  <ArrowRight />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Existing footer ── */}
      <footer className="border-t border-gray-200 bg-gray-50 mt-auto">
        <div className="container-main py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="mb-4">
                <Link href="/" aria-label="Earthmove home"><Logo variant="wordmark" size={28} /></Link>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                Order bulk construction materials online. Same-day delivery in Dallas-Fort Worth and Denver.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Materials</h4>
              <ul className="space-y-2.5">
                {[
                  ['Fill Dirt', '/browse?category=fill'],
                  ['Gravel', '/browse?category=gravel'],
                  ['Road Base', '/browse?category=aggregate'],
                  ['Topsoil', '/browse?category=fill'],
                  ['Sand', '/browse?category=sand'],
                  ['All Materials', '/browse'],
                ].map(([label, href]) => (
                  <li key={href + label}>
                    <Link href={href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Account</h4>
              <ul className="space-y-2.5">
                {[
                  ['Sign In', '/login'],
                  ['Create Account', '/signup'],
                  ['My Orders', '/account/orders'],
                  ['My Account', '/account'],
                ].map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-400">&copy; {year} EarthMove. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy</Link>
              <Link href="/terms"   className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
