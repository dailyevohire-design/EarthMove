import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UserMenu } from './user-menu'
import { MobileNav } from './mobile-nav'
import { Logo } from './logo'
import { LocationIndicator } from '@/components/marketplace/location-modal'
import { Zap, HelpCircle, Scale } from 'lucide-react'
import { isCollectionsEnabled } from '@/lib/collections/feature-flag'

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
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="container-main">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Logo />

          {/* Center: location + nav */}
          <div className="hidden md:flex items-center gap-4">
            <LocationIndicator />
            <div className="w-px h-6 bg-gray-200" />
            <nav className="flex items-center gap-1">
              <Link href="/browse" className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all font-medium">
                Materials
              </Link>
              <Link href="/deals" className="px-4 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-all font-semibold flex items-center gap-1.5">
                <Zap size={13} className="fill-current" /> Deals
              </Link>
              <Link href="/learn" className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all font-medium">
                Learn
              </Link>
              <Link href="/material-match" className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all font-medium flex items-center gap-1.5">
                <HelpCircle size={13} /> Material Match
              </Link>
              {isCollectionsEnabled() && profile && ['gc','supplier','driver','admin'].includes(profile.role) && (
                <Link href="/collections" className="px-4 py-2 rounded-xl text-sm text-emerald-700 hover:bg-emerald-50 transition-all font-semibold flex items-center gap-1.5">
                  <Scale size={13} /> Payment Kit
                </Link>
              )}
            </nav>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {user && profile ? (
              <>
                {profile.role === 'admin' && (
                  <Link href="/admin" className="hidden md:flex btn-ghost btn-sm text-xs">
                    Admin
                  </Link>
                )}
                {profile.role === 'supplier' && (
                  <Link href="/portal" className="hidden md:flex btn-ghost btn-sm text-xs">
                    Portal
                  </Link>
                )}
                <UserMenu firstName={profile.first_name} />
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost btn-sm hidden md:flex text-xs">
                  Log in
                </Link>
                <Link href="/signup" className="btn-primary btn-sm text-xs">
                  Sign up
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
