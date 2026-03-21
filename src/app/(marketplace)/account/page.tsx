import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {profile?.first_name ? `Hey, ${profile.first_name}` : 'My Account'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{user.email}</p>
        </div>
      </div>

      <div className="card p-5 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <User size={20} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900">
            {profile?.first_name} {profile?.last_name}
          </div>
          {profile?.company_name && (
            <div className="text-gray-500 text-sm">{profile.company_name}</div>
          )}
          <div className="text-gray-400 text-xs">{user.email}</div>
        </div>
      </div>

      <div className="mb-8">
        <Link href="/account/orders" className="card-hover flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Package size={18} className="text-gray-400" />
            <span className="font-medium text-gray-900 text-sm">My Orders</span>
          </div>
          <ChevronRight size={15} className="text-gray-400" />
        </Link>
      </div>
    </div>
  )
}
