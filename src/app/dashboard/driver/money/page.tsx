import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEarnings } from '@/lib/services/earthmove-dispatch.service'
import { TopoPattern } from '@/components/driver/TopoPattern'

export default async function MoneyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: driver } = await admin
    .from('drivers').select('id, total_earnings').eq('user_id', user.id).maybeSingle()

  const weekStart = mondayOf(new Date())
  const week = driver?.id ? await safeGetEarnings(driver.id, weekStart) : { total: 0, load_count: 0 }
  const ytd  = Number(driver?.total_earnings ?? 0)

  const days = await weekBars(driver?.id)

  const { data: recent } = driver?.id ? await admin
    .from('dispatches')
    .select('id, material_type, tons, driver_pay, driver_bonus, delivery_address, current_phase, completed_at, created_at')
    .eq('driver_id', driver.id)
    .gte('created_at', weekStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(10) : { data: [] as any[] }

  const todayIdx = (new Date().getDay() + 6) % 7  // Mon=0

  return (
    <>
      <div style={{ padding: '4px 16px 12px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Money</div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>
          YTD  ·  ${ytd.toLocaleString('en-US', { minimumFractionDigits: 0 })}  ·  paid every Tuesday
        </div>
      </div>

      <div className="em-seg">
        <button>Today</button>
        <button className="active">Week</button>
        <button>Month</button>
        <button>All</button>
      </div>

      <div className="em-money-hero">
        <TopoPattern
          className="em-money-hero__topo"
          viewBox="0 0 400 220"
          stroke="#9AC9AE"
          strokeWidth={0.5}
          paths={[
            'M-20 120 Q 80 90 200 110 T 420 120',
            'M-20 150 Q 100 120 220 140 T 420 150',
            'M-20 180 Q 120 150 240 170 T 420 180',
          ]}
        />
        <div className="em-money-hero__label">Week of {formatWeek(weekStart)}</div>
        <div className="em-money-hero__num">
          ${Math.floor(week.total).toLocaleString()}
          <span style={{ fontSize: 28, color: 'var(--earth-300)', letterSpacing: 0 }}>
            .{(week.total.toFixed(2).split('.')[1] ?? '00')}
          </span>
        </div>
        <div className="em-money-hero__grid">
          <div className="em-money-hero__stat"><strong>{week.load_count}</strong><span>Loads</span></div>
          <div className="em-money-hero__stat"><strong>—</strong><span>Hours</span></div>
          <div className="em-money-hero__stat"><strong>—</strong><span>Per hr</span></div>
        </div>
        <div className="em-money-hero__payout">
          <div className="em-money-hero__payout-label">Next payout  ·  ACH</div>
          <div className="em-money-hero__payout-date">Tue 8:00 AM</div>
        </div>
      </div>

      <div className="em-chart">
        <div className="em-chart__head">
          <span className="em-chart__label">Daily  ·  mon → sun</span>
          <span className="em-chart__delta">&nbsp;</span>
        </div>
        <div className="em-chart__bars">
          {days.map((v, i) => (
            <div
              key={i}
              className={`em-chart__bar ${i === todayIdx ? 'today' : ''} ${i > todayIdx ? 'future' : ''}`}
              style={{ height: `${Math.max(4, v.pct)}%` }}
            />
          ))}
        </div>
        <div className="em-chart__days">
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <span key={i} className={i === todayIdx ? 'today-label' : ''}>{d}</span>
          ))}
        </div>
      </div>

      <div className="em-sec-label">Loads this week  ·  {(recent ?? []).length}</div>
      {(recent ?? []).map((r: any) => {
        const amt = Number(r.driver_pay || 0) + Number(r.driver_bonus || 0)
        const pending = r.current_phase !== 'ticket_submitted'
        return (
          <div key={r.id} className="em-earn-row">
            <div>
              <div className="em-earn-row__top">
                {firstLine(r.delivery_address) ?? 'Delivery'}  ·  DSP-{r.id.slice(0, 4).toUpperCase()}
              </div>
              <div className="em-earn-row__sub">
                {r.material_type}  ·  {Number(r.tons).toFixed(0)}t  ·  {formatDay(r.completed_at || r.created_at)}
              </div>
            </div>
            <div className={`em-earn-row__amt ${pending ? 'pending' : ''}`}>
              {pending ? 'pending' : `$${Math.round(amt).toLocaleString()}`}
            </div>
          </div>
        )
      })}
    </>
  )
}

async function safeGetEarnings(driverId: string, since: Date) {
  try { return await getEarnings(driverId, since) } catch { return { total: 0, load_count: 0 } }
}

async function weekBars(driverId: string | undefined): Promise<{ pct: number }[]> {
  if (!driverId) return Array(7).fill({ pct: 0 })
  const admin = createAdminClient()
  const start = mondayOf(new Date())
  const { data } = await admin
    .from('dispatches')
    .select('driver_pay, driver_bonus, completed_at')
    .eq('driver_id', driverId)
    .not('completed_at', 'is', null)
    .gte('completed_at', start.toISOString())
  const daily = Array(7).fill(0)
  for (const r of data ?? []) {
    const d = new Date(r.completed_at!)
    const idx = (d.getDay() + 6) % 7
    daily[idx] += Number(r.driver_pay || 0) + Number(r.driver_bonus || 0)
  }
  const max = Math.max(1, ...daily)
  return daily.map(v => ({ pct: Math.round((v / max) * 100) }))
}

function mondayOf(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  const offset = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - offset)
  return x
}
function formatWeek(d: Date) {
  const end = new Date(d); end.setDate(end.getDate() + 6)
  const f = (x: Date) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()
  return `${f(d)} – ${f(end).split(' ').pop()}`
}
function formatDay(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()
    + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function firstLine(addr?: string | null) {
  if (!addr) return null
  return addr.split(/[·,]/)[0]?.trim() || null
}
