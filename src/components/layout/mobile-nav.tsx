'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Menu, X, Package, User,
  LogOut, ShieldCheck, Building2, Zap, BookOpen, Search
} from 'lucide-react'
import { Logo } from '@/components/logo'

interface MobileNavProps {
  isLoggedIn: boolean
  role: string | null
}

export function MobileNav({ isLoggedIn, role }: MobileNavProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const close = () => setOpen(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const signOut = async () => {
    await createClient().auth.signOut()
    close()
    router.push('/')
    router.refresh()
  }

  const drawer = open ? (
    <>
      <div
        onClick={close}
        aria-hidden="true"
        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        className="fixed inset-y-0 right-0 z-[100] w-[85vw] max-w-sm bg-[#F5F1E8] border-l border-l-[#0E2A22]/15 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-b-[#0E2A22]/15">
          <Logo variant="wordmark" size={20} theme="positive" color="#1F3D2E" />
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-[var(--commerce-ink-3)] hover:text-[var(--commerce-ink)] hover:bg-[var(--commerce-cream-2)] transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          <NavLink href="/browse" icon={<Package size={15} />} onClick={close}>Materials</NavLink>
          <NavLink href="/deals" icon={<Zap size={15} />} onClick={close} accent>Today's Deals</NavLink>
          <NavLink href="/learn" icon={<BookOpen size={15} />} onClick={close}>Learn</NavLink>
          <NavLink href="/material-match" icon={<Search size={15} />} onClick={close}>Material Match</NavLink>

          {isLoggedIn && (
            <>
              <div className="h-px bg-[var(--commerce-line)] my-3" />
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
        <div className="px-3 py-4 border-t border-t-[#0E2A22]/15">
          {isLoggedIn ? (
            <button
              onClick={signOut}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-[var(--commerce-ink-3)] hover:bg-[var(--commerce-cream-2)] hover:text-red-600 transition-colors"
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
      </aside>
    </>
  ) : null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 rounded-lg text-[#1F3D2E] hover:text-[var(--commerce-ink)] hover:bg-[var(--commerce-cream-2)] transition-colors"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>
      {mounted && drawer && createPortal(drawer, document.body)}
    </>
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
          ? 'text-[var(--commerce-trust)] hover:bg-[var(--commerce-cream-2)]'
          : 'text-[#1F3D2E] hover:bg-[var(--commerce-cream-2)] hover:text-[var(--commerce-ink)]'
      }`}
    >
      {icon && <span className="text-[var(--commerce-ink-3)]">{icon}</span>}
      {children}
    </Link>
  )
}
