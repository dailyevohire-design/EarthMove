import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveLoad, getAvailableLoads, type AvailableLoad } from '@/lib/services/earthmove-dispatch.service'
import { MapPreview } from '@/components/driver/MapPreview'
import { LoadCard } from '@/components/driver/LoadCard'
import { TodayLoadPanel } from './_shell/TodayLoadPanel'
import type { Phase } from '@/lib/driver/phase-machine'

export default async function TodayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: driver } = await admin
    .from('drivers').select('id').eq('user_id', user.id).maybeSingle()

  let active: Awaited<ReturnType<typeof getActiveLoad>> = null
  let upcoming: Awaited<ReturnType<typeof getAvailableLoads>> = []
  if (driver?.id) {
    try { active   = await getActiveLoad(driver.id) } catch {}
    try { upcoming = await getAvailableLoads({ limit: 5 }) } catch {}
  }

  if (!active) {
    return (
      <>
        <div style={{ padding: '32px 20px' }}>
          <div style={{
            fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
            color: 'var(--ink-950)', marginBottom: 6,
          }}>
            No active load
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-500)' }}>
            Head to <strong style={{ color: 'var(--earth-800)' }}>Find work</strong> to claim one.
          </div>
        </div>
      </>
    )
  }

  const pay = Number(active.driver_pay || 0) + Number(active.driver_bonus || 0)
  const perTon = Number(active.tons || 0) > 0 ? pay / Number(active.tons) : 0
  const pickupPlace = firstLine(active.pickup_address) ?? 'Pickup'
  const pickupMeta  = restLine(active.pickup_address)
  const deliverPlace = firstLine(active.delivery_address) ?? 'Deliver'
  const deliverMeta  = restLine(active.delivery_address)
  const phase: Phase = (active.current_phase ?? 'ready') as Phase

  return (
    <>
      <MapPreview
        pickupLabel={acronym(pickupPlace)}
        deliverLabel={deliverPlace}
      />

      <LoadCard
        material={active.material_type}
        tons={Number(active.tons)}
        payDollars={Math.round(pay)}
        perTonDollars={perTon}
        pickupPlace={pickupPlace}
        pickupMeta={pickupMeta || undefined}
        deliverPlace={deliverPlace}
        deliverMeta={deliverMeta || undefined}
        phase={phase}
      />

      {upcoming.length > 0 && (
        <>
          <div className="em-sec-label">
            <span>Next up  ·  {upcoming.length} load{upcoming.length === 1 ? '' : 's'}</span>
            <span style={{ color: 'var(--earth-700)', fontFamily: 'var(--font-num)' }}>
              +${upcoming.reduce((s: number, l: AvailableLoad) => s + Number(l.driver_pay || 0) + Number(l.driver_bonus || 0), 0).toLocaleString()}
            </span>
          </div>
          {upcoming.slice(0, 3).map((u: AvailableLoad) => {
            const up = Number(u.driver_pay || 0) + Number(u.driver_bonus || 0)
            const pt = Number(u.tons || 0) > 0 ? up / Number(u.tons) : 0
            return (
              <div key={u.id} className="em-job">
                <div>
                  <div className="em-job__type">{u.material_type}</div>
                  <div className="em-job__route">
                    {firstLine(u.pickup_address) ?? '—'} → {firstLine(u.delivery_address) ?? '—'}
                  </div>
                  <div className="em-job__meta">
                    <span>{Number(u.tons).toFixed(0)} tons</span>
                    <span>—</span>
                  </div>
                  {u.is_backhaul && <span className="em-job__backhaul">↻ backhaul</span>}
                </div>
                <div>
                  <div className="em-job__pay">${Math.round(up).toLocaleString()}</div>
                  <div className="em-job__per">${pt.toFixed(2)}/ton</div>
                </div>
              </div>
            )
          })}
        </>
      )}

      <TodayLoadPanel
        dispatchId={active.id}
        initialPhase={phase}
        loadLabel={`${active.material_type} delivered`}
        nextLoadLabel={upcoming[0]
          ? `${firstLine(upcoming[0].pickup_address)} → ${firstLine(upcoming[0].delivery_address)}`
          : undefined}
        tonsActual={Number(active.tons)}
      />
    </>
  )
}

function firstLine(addr?: string | null) {
  if (!addr) return null
  return addr.split(/[·,]/)[0]?.trim() || null
}
function restLine(addr?: string | null) {
  if (!addr) return null
  const parts = addr.split(/[·,]/).slice(1).map(s => s.trim()).filter(Boolean)
  return parts.length ? parts.join('  ·  ') : null
}
function acronym(s: string) {
  return s.split(/\s+/).map(w => w[0]).filter(Boolean).join('').slice(0, 6).toUpperCase() || s.slice(0, 6)
}
