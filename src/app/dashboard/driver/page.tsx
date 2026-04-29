import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveLoad } from '@/lib/services/earthmove-dispatch.service'
import { TodayLoadPanel } from './_shell/TodayLoadPanel'
import { StatusStrip } from '@/components/driver/dash-v2/StatusStrip'
import { ActiveRunPanel, ActiveRunEmpty } from '@/components/driver/dash-v2/ActiveRunPanel'
import { AvailableLoads } from '@/components/driver/dash-v2/AvailableLoads'
import { WeekRunsTable } from '@/components/driver/dash-v2/WeekRunsTable'
import { ProtectionPanel } from '@/components/driver/dash-v2/ProtectionPanel'
import { DocumentVault } from '@/components/driver/dash-v2/DocumentVault'
import { AccountPanels } from '@/components/driver/dash-v2/AccountPanels'
import type { Phase } from '@/lib/driver/phase-machine'

const FRAUNCES = "'Fraunces', serif"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"

export default async function DriverHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: driver } = await admin
    .from('drivers').select('id').eq('user_id', user.id).maybeSingle()

  let active: Awaited<ReturnType<typeof getActiveLoad>> = null
  if (driver?.id) {
    try { active = await getActiveLoad(driver.id) } catch {}
  }

  const pay = active ? Number(active.driver_pay || 0) + Number(active.driver_bonus || 0) : null
  const pickupYard = active ? firstLine(active.pickup_address) ?? 'Pickup' : ''
  const dropCity = active ? firstLine(active.delivery_address) ?? 'Site' : ''
  const phase: Phase = active ? ((active.current_phase ?? 'ready') as Phase) : 'ready'

  return (
    <>
      <header className="mb-7">
        <span
          className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2A332E]"
          style={{ fontFamily: SANS }}
        >
          <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#2A332E]" />
          Driver dashboard · Friday Apr 24 · Dallas-Fort Worth
        </span>
        <h1
          className="font-semibold text-[42px] sm:text-[52px] leading-[0.96] tracking-[-0.02em] mt-3.5 mb-3 text-[#15201B] max-w-[18ch]"
          style={{ fontFamily: FRAUNCES }}
        >
          Today, <em className="italic font-medium">at a glance</em>.
        </h1>
        <p className="text-[16px] text-[#2A332E] leading-[1.55] max-w-[52ch] m-0">
          Four loads done, one open, settlement Friday.
        </p>
      </header>

      <div className="mb-6">
        <StatusStrip
          onDutySince="06:42"
          loadsToday={4}
          tonsToday={53.2}
          payAccruedToday={487}
        />
      </div>

      {active ? (
        <ActiveRunPanel
          dispatchId={active.id}
          material={active.material_type}
          tons={Number(active.tons) || null}
          pickupYard={pickupYard}
          dropCity={dropCity}
          totalMiles={28.4}
          pickupEta="11:34"
          dropEta="12:08"
          milesToDrop={8.2}
          payThisLoad={pay != null ? Math.round(pay) : null}
          swipeSlot={
            <TodayLoadPanel
              dispatchId={active.id}
              initialPhase={phase}
              loadLabel={`${active.material_type} delivered`}
              tonsActual={Number(active.tons)}
            />
          }
        />
      ) : (
        <ActiveRunEmpty />
      )}

      <AvailableLoads />
      <WeekRunsTable />
      <ProtectionPanel />
      <DocumentVault />
      <AccountPanels />
    </>
  )
}

function firstLine(addr?: string | null) {
  if (!addr) return null
  return addr.split(/[·,]/)[0]?.trim() || null
}
