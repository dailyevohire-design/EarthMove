import { getAvailableLoads, type AvailableLoad } from '@/lib/services/earthmove-dispatch.service'

export default async function FindWorkPage() {
  let loads: Awaited<ReturnType<typeof getAvailableLoads>> = []
  try { loads = await getAvailableLoads({ limit: 25 }) } catch {}

  return (
    <>
      <div style={{ padding: '4px 16px 12px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Find work</div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>
          {loads.length} load{loads.length === 1 ? '' : 's'} available
        </div>
      </div>

      <div className="em-findwork__filters">
        <button className="em-filter active">All  ·  {loads.length}</button>
        <button className="em-filter">{'< 5 mi'}</button>
        <button className="em-filter">$300+</button>
        <button className="em-filter">+ backhaul</button>
        <button className="em-filter">Fill dirt</button>
        <button className="em-filter">Base</button>
      </div>

      {loads.length === 0 && (
        <div style={{ padding: '20px 16px', color: 'var(--ink-500)', fontSize: 14 }}>
          No available loads right now. Check back shortly.
        </div>
      )}

      {loads.map((l: AvailableLoad) => {
        const pay = Number(l.driver_pay || 0) + Number(l.driver_bonus || 0)
        const perTon = Number(l.tons) > 0 ? pay / Number(l.tons) : 0
        return (
          <div key={l.id} className="em-job">
            <div>
              <div className="em-job__type">{l.material_type}</div>
              <div className="em-job__route">
                {firstLine(l.pickup_address) ?? '—'} → {firstLine(l.delivery_address) ?? '—'}
              </div>
              <div className="em-job__meta">
                <span>{Number(l.tons).toFixed(0)} tons</span>
                <span>—</span>
              </div>
              {l.is_backhaul && <span className="em-job__backhaul">↻ backhaul</span>}
            </div>
            <div>
              <div className="em-job__pay">${Math.round(pay).toLocaleString()}</div>
              <div className="em-job__per">${perTon.toFixed(2)}/ton</div>
            </div>
          </div>
        )
      })}
    </>
  )
}

function firstLine(addr?: string | null) {
  if (!addr) return null
  return addr.split(/[·,]/)[0]?.trim() || null
}
