import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  ShieldCheck, Truck, Package, LayoutDashboard,
  ShoppingCart, LogOut, ChevronRight
} from 'lucide-react'
import { LogoMark } from '@/components/layout/logo'

// Role-to-nav mapping
const GC_NAV = [
  { href: '/dashboard/gc',              icon: <LayoutDashboard size={14} />, label: 'Overview'          },
  { href: '/dashboard/gc/contractors',  icon: <ShieldCheck size={14} />,     label: 'Contractor Check'  },
  { href: '/dashboard/gc/orders',       icon: <ShoppingCart size={14} />,    label: 'My Orders'         },
]

const DRIVER_NAV = [
  { href: '/dashboard/driver',          icon: <LayoutDashboard size={14} />, label: 'Overview'          },
  { href: '/dashboard/driver/loads',    icon: <Package size={14} />,         label: 'Available Loads'   },
  { href: '/dashboard/driver/history',  icon: <Truck size={14} />,           label: 'My Deliveries'     },
]

const CUSTOMER_NAV = [
  { href: '/dashboard',                 icon: <LayoutDashboard size={14} />, label: 'Overview'          },
  { href: '/dashboard/orders',          icon: <ShoppingCart size={14} />,    label: 'My Orders'         },
  { href: '/dashboard/contractors',     icon: <ShieldCheck size={14} />,     label: 'Contractor Check'  },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name, company_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const role = profile.role ?? 'customer'
  const displayName = profile.company_name ?? profile.first_name ?? user.email?.split('@')[0] ?? 'Account'

  // Suppliers go to their existing /portal
  if (role === 'supplier') redirect('/portal')
  // Admins go to admin panel
  if (role === 'admin') redirect('/admin')

  const nav = role === 'driver' ? DRIVER_NAV : role === 'gc' ? GC_NAV : CUSTOMER_NAV
  const portalLabel = role === 'driver' ? 'Driver Portal' : role === 'gc' ? 'GC Portal' : 'My Account'

  return (
    <div className="min-h-screen flex bg-stone-950">
      {/* Sidebar — matches /portal style exactly */}
      <aside className="w-56 flex-shrink-0 border-r border-stone-800 flex flex-col bg-stone-900 sticky top-0 h-screen">
        <div className="h-16 flex items-center px-5 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <LogoMark size={18} />
            <div>
              <div className="text-xs font-black text-stone-100 leading-tight truncate max-w-[130px]">
                {displayName}
              </div>
              <div className="text-[10px] text-emerald-500">{portalLabel}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          {nav.map(item => (
            <DashLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
          ))}
        </nav>

        <div className="px-2.5 py-4 border-t border-stone-800 space-y-0.5">
          <Link
            href="/browse"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-stone-500 hover:bg-stone-800 hover:text-stone-300 transition-colors"
          >
            <ChevronRight size={12} /> Back to Marketplace
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-stone-500 hover:bg-stone-800 hover:text-red-400 transition-colors"
          >
            <LogOut size={13} /> Sign Out
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto bg-stone-950">{children}</main>
    </div>
  )
}

function DashLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-500 hover:bg-stone-800 hover:text-stone-200 transition-all"
    >
      <span className="text-stone-600">{icon}</span>
      {label}
    </Link>
  )
}
