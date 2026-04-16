import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'customer'
  if (role === 'driver')   redirect('/dashboard/driver')
  if (role === 'gc')       redirect('/dashboard/gc')
  if (role === 'supplier') redirect('/portal')
  if (role === 'admin')    redirect('/admin')

  // Default: customer overview (orders + contractor check CTA)
  redirect('/dashboard/gc')
}
