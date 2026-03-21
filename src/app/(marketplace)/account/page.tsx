import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { ORDER_STATUS_CONFIG } from '@/types'
import Link from 'next/link'
import { Package, ChevronRight, User } from 'lucide-react'

export const metadata = { title: 'My Account' }

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/account')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, company_name, phone')
    .eq('id', user.id)
    .single()

  return (
    <div className="container-main py-10 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">
            {profile?.first_name ? `Hey, ${profile.first_name}` : 'My Account'}
          </h1>
          <p className="text-stone-500 text-sm mt-1">{user.email}</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="card p-5 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <User size={20} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-stone-200">
            {profile?.first_name} {profile?.last_name}
          </div>
          {profile?.company_name && (
            <div className="text-stone-500 text-sm">{profile.company_name}</div>
          )}
          <div className="text-stone-600 text-xs">{user.email}</div>
        </div>
      </div>

      {/* Quick links */}
      <div className="mb-8">
        <Link href="/account/orders" className="card-hover flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Package size={18} className="text-stone-500" />
            <span className="font-medium text-stone-200 text-sm">My Orders</span>
          </div>
          <ChevronRight size={15} className="text-stone-600" />
        </Link>
      </div>
    </div>
  )
}
