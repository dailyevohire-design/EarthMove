'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Layers, Package,
  Tag, Truck, Upload, Settings, LogOut, Mountain,
  ChevronRight, Building2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/admin',              label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/admin/orders',       label: 'Orders',       icon: ShoppingCart },
  { href: '/admin/marketplace',  label: 'Marketplace',  icon: Layers },
  { href: '/admin/suppliers',    label: 'Suppliers',    icon: Building2 },
  { href: '/admin/offerings',    label: 'Offerings',    icon: Package },
  { href: '/admin/promotions',   label: 'Promotions',   icon: Tag },
  { href: '/admin/import',       label: 'Import',       icon: Upload },
  { href: '/admin/pricing',      label: 'Pricing',      icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const signOut = async () => {
    await createClient().auth.signOut()
    router.push('/')
  }

  return (
    <aside className="w-56 flex-shrink-0 border-r border-stone-800 flex flex-col bg-stone-900/50 sticky top-0 h-screen">
      <div className="h-16 flex items-center px-5 border-b border-stone-800">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-amber-500 rounded-md flex items-center justify-center">
            <Mountain size={13} className="text-stone-950" />
          </div>
          <div>
            <div className="text-xs font-black text-stone-100 leading-tight">AggregateMarket</div>
            <div className="text-[10px] text-amber-500/70">Admin</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                active
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                  : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
              }`}
            >
              <Icon size={15} className={active ? 'text-amber-400' : 'text-stone-500 group-hover:text-stone-300'} />
              {label}
              {active && <ChevronRight size={12} className="ml-auto text-amber-500/40" />}
            </Link>
          )
        })}
      </nav>

      <div className="px-2.5 py-4 border-t border-stone-800 space-y-0.5">
        <Link href="/" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-stone-500 hover:bg-stone-800 hover:text-stone-300 transition-colors">
          <Truck size={13} /> View site
        </Link>
        <button
          onClick={signOut}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-stone-500 hover:bg-stone-800 hover:text-red-400 transition-colors w-full text-left"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  )
}
