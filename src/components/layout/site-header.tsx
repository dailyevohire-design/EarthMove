import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UserMenu } from './user-menu'
import { MobileNav } from './mobile-nav'
import { Mountain } from 'lucide-react'

export async function SiteHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: { role: string; first_name: string | null } | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, first_name')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-md">
      <div className="container-main">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center group-hover:bg-emerald-700 transition-colors">
              <Mountain size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-gray-900 tracking-tight text-lg leading-none">
              Aggregate<span className="text-emerald-600">Market</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/browse" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
              Materials
            </Link>
            <Link href="/browse?deals=1" className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors font-medium">
              Today's Deals
            </Link>
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3">
            {user && profile ? (
              <>
                {profile.role === 'admin' && (
                  <Link href="/admin" className="hidden md:flex btn-secondary btn-sm">
                    Admin
                  </Link>
                )}
                {profile.role === 'supplier' && (
                  <Link href="/portal" className="hidden md:flex btn-secondary btn-sm">
                    Supplier Portal
                  </Link>
                )}
                <UserMenu firstName={profile.first_name} />
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost btn-sm hidden md:flex">
                  Sign in
                </Link>
                <Link href="/signup" className="btn-primary btn-sm">
                  Get Started
                </Link>
              </>
            )}
            <MobileNav isLoggedIn={!!user} role={profile?.role ?? null} />
          </div>
        </div>
      </div>
    </header>
  )
}
