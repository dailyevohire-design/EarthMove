import './driver.css'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DriverShell } from './_shell/DriverShell'
import { getEarnings, getActiveLoad } from '@/lib/services/earthmove-dispatch.service'

export const metadata = { title: 'Driver — earthmove.io' }

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('first_name, role').eq('id', user.id).single()
  if (profile?.role !== 'driver') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: driver } = await admin
    .from('drivers').select('id, name, user_id')
    .eq('user_id', user.id).maybeSingle()

  // Graceful fallback if a driver row hasn't been provisioned yet.
  const driverId = driver?.id
  const firstName = profile?.first_name
    ?? driver?.name?.split(' ')[0]
    ?? 'Driver'

  let todayEarnings = 0
  let activeLoad: React.ComponentProps<typeof DriverShell>['activeLoad'] = null

  if (driverId) {
    try {
      const since = new Date()
      since.setHours(0, 0, 0, 0)
      const e = await getEarnings(driverId, since)
      todayEarnings = e.total
    } catch {}

    try {
      const active = await getActiveLoad(driverId)
      if (active) {
        activeLoad = {
          id:            active.id,
          destination:   firstLine(active.delivery_address) ?? 'Site',
          distanceMiles: null, // lat/lng join TBD
          payDollars:    Number(active.driver_pay || 0) + Number(active.driver_bonus || 0),
          loadNumber:    null,
        }
      }
    } catch {}
  }

  return (
    <DriverShell
      driverId={driverId ?? ''}
      firstName={firstName}
      todayEarnings={todayEarnings}
      activeLoad={activeLoad}
    >
      {children}
    </DriverShell>
  )
}

function firstLine(addr: string | null | undefined) {
  if (!addr) return null
  const first = addr.split(/[·,]/)[0]?.trim()
  return first || null
}
