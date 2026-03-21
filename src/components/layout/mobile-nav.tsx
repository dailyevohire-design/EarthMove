'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Menu, X, Mountain, Package, User,
  LogOut, ShieldCheck, Building2
} from 'lucide-react'

interface MobileNavProps {
  isLoggedIn: boolean
  role: string | null
}

export function MobileNav({ isLoggedIn, role }: MobileNavProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const signOut = async () => {
    await createClient().auth.signOut()
    close()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={close}
          />
          <div className="fixed top-0 right-0 bottom-0 w-72 bg-stone-900 border-l border-stone-800 z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-500 rounded-md flex items-center justify-center">
                  <Mountain size={13} className="text-stone-950" />
                </div>
                <span className="font-bold text-stone-100 text-sm">AggregateMarket</span>
              </div>
              <button
                onClick={close}
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
              <NavLink href="/browse" onClick={close}>Materials</NavLink>
              <NavLink href="/browse?deals=1" onClick={close} accent>Today's Deals</NavLink>

              {isLoggedIn && (
                <>
                  <div className="h-px bg-stone-800 my-3" />
                  <NavLink href="/account" icon={<User size={15} />} onClick={close}>My Account</NavLink>
                  <NavLink href="/account/orders" icon={<Package size={15} />} onClick={close}>My Orders</NavLink>
                  {role === 'admin' && (
                    <NavLink href="/admin" icon={<ShieldCheck size={15} />} onClick={close}>Admin Dashboard</NavLink>
                  )}
                  {role === 'supplier' && (
                    <NavLink href="/portal" icon={<Building2 size={15} />} onClick={close}>Supplier Portal</NavLink>
                  )}
                </>
              )}
            </nav>

            {/* Footer */}
            <div className="px-3 py-4 border-t border-stone-800">
              {isLoggedIn ? (
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-stone-400 hover:bg-stone-800 hover:text-red-400 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              ) : (
                <div className="space-y-2">
                  <Link href="/login" onClick={close} className="btn-secondary btn-md w-full">Sign in</Link>
                  <Link href="/signup" onClick={close} className="btn-primary btn-md w-full">Get Started</Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function NavLink({
  href, children, onClick, icon, accent,
}: {
  href: string; children: React.ReactNode; onClick: () => void
  icon?: React.ReactNode; accent?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        accent
          ? 'text-amber-400 hover:bg-amber-500/10'
          : 'text-stone-300 hover:bg-stone-800 hover:text-stone-100'
      }`}
    >
      {icon && <span className="text-stone-500">{icon}</span>}
      {children}
    </Link>
  )
}
