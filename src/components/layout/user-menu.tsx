'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, Package, LogOut, ChevronDown } from 'lucide-react'

export function UserMenu({ firstName }: { firstName: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const signOut = async () => {
    await createClient().auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 transition-colors text-sm font-medium text-stone-200"
      >
        <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
          <User size={11} className="text-amber-400" />
        </div>
        <span className="hidden sm:block">{firstName ?? 'Account'}</span>
        <ChevronDown size={13} className="text-stone-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 card border-stone-700 shadow-xl shadow-black/50 overflow-hidden z-50">
          <div className="py-1">
            {[
              { href: '/account',        icon: User,    label: 'My Account' },
              { href: '/account/orders', icon: Package, label: 'My Orders' },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-300 hover:bg-stone-800 hover:text-stone-100 transition-colors"
              >
                <Icon size={14} className="text-stone-500" />
                {label}
              </Link>
            ))}
            <div className="h-px bg-stone-800 my-1" />
            <button
              onClick={signOut}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-400 hover:bg-stone-800 hover:text-red-400 transition-colors w-full text-left"
            >
              <LogOut size={14} className="text-stone-500" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
