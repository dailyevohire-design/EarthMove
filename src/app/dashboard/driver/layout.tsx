import './driver.css'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DashShell } from '@/components/driver/dash-v2/DashShell'
import { getEarnings } from '@/lib/services/earthmove-dispatch.service'

export const metadata = { title: 'Driver — earthmove.io' }

// Auth gate hoisted from page.tsx so all 14 driver routes share it. The
// previous mobile DriverShell is replaced by the desktop V2 DashShell —
// followup #36 covers reconciling the truck-cab mobile UX (likely behind
// /dashboard/driver/today or media-query-gated inside DashShell).
export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('first_name, role').eq('id', user.id).single()
  if (profile?.role !== 'driver') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: driver } = await admin
    .from('drivers').select('id, name, user_id, truck_type, capacity_tons')
    .eq('user_id', user.id).maybeSingle()

  const driverName = driver?.name ?? profile?.first_name ?? 'Driver'
  const truckClassLabel = formatTruckLabel(driver?.truck_type, driver?.capacity_tons)

  // Hardcoded for this commit — followup #41 (added inline below) wires to
  // a drivers.dot_number column once we add it. DOT lookup table proposal
  // tracked separately.
  const dotNumber = '3,748,221'

  // Hardcoded WTD context — followup #39 wires real settlement aggregates.
  let weekToDate = 0
  if (driver?.id) {
    try {
      const weekStart = new Date()
      const day = weekStart.getDay()
      weekStart.setDate(weekStart.getDate() - ((day + 6) % 7)) // Monday
      weekStart.setHours(0, 0, 0, 0)
      const e = await getEarnings(driver.id, weekStart)
      weekToDate = Math.round(e.total)
    } catch {}
  }

  return (
    <DashShell
      driverName={driverName}
      truckClassLabel={truckClassLabel}
      dotNumber={dotNumber}
      onDuty={true}
      weekToDate={weekToDate || 2180}
      weekDeltaPct={12}
      settlesLabel="Settles Fri Apr 30"
    >
      {children}
    </DashShell>
  )
}

function formatTruckLabel(truckType?: string | null, capacityTons?: number | null): string {
  const cls = (truckType ?? 'TRI-AXLE').toUpperCase()
  const cap = capacityTons != null ? ` · ${Math.round(capacityTons)}T` : ' · 14T'
  return `${cls}${cap}`
}
