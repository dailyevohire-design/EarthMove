import Link from 'next/link'
import { Mountain } from 'lucide-react'

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-stone-800 bg-stone-900/40 mt-auto">
      <div className="container-main py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Mountain size={16} className="text-stone-950" />
              </div>
              <span className="font-extrabold text-stone-100 tracking-tight">
                Aggregate<span className="text-amber-400">Market</span>
              </span>
            </Link>
            <p className="text-stone-500 text-sm leading-relaxed max-w-xs">
              Order bulk construction materials online. Fast delivery across DFW.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Materials</h4>
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
                  <Link href={href} className="text-sm text-stone-500 hover:text-stone-300 transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Account</h4>
            <ul className="space-y-2.5">
              {[
                ['Sign In', '/login'],
                ['Create Account', '/signup'],
                ['My Orders', '/account/orders'],
                ['My Account', '/account'],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-stone-500 hover:text-stone-300 transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-stone-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-stone-600">© {year} AggregateMarket. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-xs text-stone-600 hover:text-stone-400 transition-colors">Privacy</Link>
            <Link href="/terms"   className="text-xs text-stone-600 hover:text-stone-400 transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
