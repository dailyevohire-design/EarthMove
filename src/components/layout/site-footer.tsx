import Link from 'next/link'
import { Logo } from './logo'

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-auto">
      <div className="container-main py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          <div>
            <div className="mb-4">
              <Logo />
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
  )
}
