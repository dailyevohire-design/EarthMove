import { redirect } from 'next/navigation'
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  ShieldCheck, LayoutDashboard,
  ShoppingCart, LogOut, ChevronRight, ScrollText
} from 'lucide-react'
import { Logo } from '@/components/logo'

// Single shared nav for gc + customer roles. /dashboard/page.tsx redirects
// customer to /dashboard/gc, so both render the same surface tree. The
// previous CUSTOMER_NAV pointed at /dashboard/contractors and /dashboard/orders
// which were never built — clicking them 404'd. Orders live at the marketplace
// /account/orders page (user-facing canonical orders surface).
const GC_NAV = [
  { href: '/dashboard/gc',              icon: <LayoutDashboard size={14} />, label: 'Overview'          },
  { href: '/dashboard/gc/contractors',  icon: <ShieldCheck size={14} />,     label: 'Contractor Check'  },
  ...(process.env.NEXT_PUBLIC_COLLECTIONS_ENABLED === 'true'
    ? [{ href: '/collections/new',       icon: <ScrollText size={14} />,     label: 'Collections Assist' }]
    : []),
  { href: '/account/orders',            icon: <ShoppingCart size={14} />,    label: 'My Orders'         },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? '/dashboard';
  const loginRedirect = `/login?redirectTo=${encodeURIComponent(pathname)}`;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(loginRedirect)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name, company_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect(loginRedirect)

  const role = profile.role ?? 'customer'
  const displayName = profile.company_name ?? profile.first_name ?? user.email?.split('@')[0] ?? 'Account'

  // Suppliers go to their existing /portal
  if (role === 'supplier') redirect('/portal')
  // Admins go to admin panel
  if (role === 'admin') redirect('/admin')

  // Drivers render their own V2 chrome from src/app/dashboard/driver/layout.tsx
  if (role === 'driver') return <>{children}</>

  // gc + customer share the same surface (gc routes); only the portal label
  // differs. Driver/supplier/admin already redirected away above.
  const nav = GC_NAV
  const portalLabel = role === 'gc' ? 'GC Portal' : 'My Account'

  const homeHref = role === 'gc' ? '/dashboard/gc' : '/dashboard'

  return (
    <div className="em-surface min-h-screen md:flex">
      {/* Mobile top bar — visible below md only. Brand row + horizontal nav strip. */}
      <header className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href={homeHref} className="flex items-center gap-2 min-w-0">
            <Logo variant="mark" size={18} />
            <div className="min-w-0">
              <div className="text-xs font-black text-gray-900 leading-tight truncate">
                {displayName}
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold leading-none">{portalLabel}</div>
            </div>
          </Link>
          <Link href="/login" className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
            <LogOut size={13} /> Sign Out
          </Link>
        </div>
        <nav className="flex overflow-x-auto px-3 pb-2 gap-1">
          {nav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg whitespace-nowrap transition-colors"
            >
              <span className="text-gray-400">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Desktop sidebar — visible md+ only. Same content as before. */}
      <aside className="hidden md:flex w-56 flex-shrink-0 border-r border-gray-200 flex-col bg-white sticky top-0 h-screen">
        <div className="h-16 flex items-center px-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Logo variant="mark" size={18} />
            <div>
              <div className="text-xs font-black text-gray-900 leading-tight truncate max-w-[130px]">
                {displayName}
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold">{portalLabel}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          {nav.map(item => (
            <DashLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
          ))}
        </nav>

        <div className="px-2.5 py-4 border-t border-gray-200 space-y-0.5">
          <Link
            href="/browse"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <ChevronRight size={12} /> Back to Marketplace
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={13} /> Sign Out
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  )
}

function DashLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
    >
      <span className="text-gray-400">{icon}</span>
      {label}
    </Link>
  )
}
