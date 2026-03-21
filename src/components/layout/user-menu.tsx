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
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 transition-colors text-sm font-medium text-gray-700 shadow-sm"
      >
        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
          <User size={11} className="text-emerald-700" />
        </div>
        <span className="hidden sm:block">{firstName ?? 'Account'}</span>
        <ChevronDown size={13} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 card border-gray-200 shadow-xl overflow-hidden z-50">
          <div className="py-1">
            {[
              { href: '/account',        icon: User,    label: 'My Account' },
              { href: '/account/orders', icon: Package, label: 'My Orders' },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <Icon size={14} className="text-gray-400" />
                {label}
              </Link>
            ))}
            <div className="h-px bg-gray-100 my-1" />
            <button
              onClick={signOut}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors w-full text-left"
            >
              <LogOut size={14} className="text-gray-400" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
