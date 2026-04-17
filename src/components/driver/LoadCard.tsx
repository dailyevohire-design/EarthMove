import type { Phase } from '@/lib/driver/phase-machine'
import { BEAT_FOR_PHASE } from '@/lib/driver/phase-machine'

type Props = {
  material: string
  tons: number
  loadLabel?: string              // e.g. "Load 4 of 9"
  payDollars: number
  perTonDollars: number
  payoutNote?: string             // e.g. "paid Tuesday"
  pickupPlace: string
  pickupMeta?: string
  deliverPlace: string
  deliverMeta?: string
  phase: Phase
}

export function LoadCard({
  material, tons, loadLabel, payDollars, perTonDollars, payoutNote = 'paid Tuesday',
  pickupPlace, pickupMeta, deliverPlace, deliverMeta, phase,
}: Props) {
  const currentBeat = BEAT_FOR_PHASE[phase]
  const order: Array<'pickup' | 'deliver' | 'ticket'> = ['pickup', 'deliver', 'ticket']
  const currentIdx = order.indexOf(currentBeat)

  return (
    <div className="em-load-card">
      <div className="em-load-card__top">
        <div className="em-load-card__badge">
          <span className="em-load-card__badge-icon" />
          <span>{material}  ·  {tons} tons</span>
        </div>
        {loadLabel && <div className="em-load-card__chunk">{loadLabel}</div>}
      </div>
      <div className="em-load-card__pay">${payDollars.toLocaleString()}</div>
      <div className="em-load-card__pay-sub">
        ${perTonDollars.toFixed(2)} / ton  ·  {payoutNote}
      </div>

      <div className="em-route">
        <div className="em-route__col">
          <div className="em-route__dot" />
          <div className="em-route__line" />
          <div className="em-route__dot em-route__dot--end" />
        </div>
        <div>
          <div className="em-route__label">Pickup</div>
          <div className="em-route__place">{pickupPlace}</div>
          {pickupMeta && <div className="em-route__meta">{pickupMeta}</div>}
          <div style={{ height: 14 }} />
          <div className="em-route__label">Deliver</div>
          <div className="em-route__place">{deliverPlace}</div>
          {deliverMeta && <div className="em-route__meta">{deliverMeta}</div>}
        </div>
      </div>

      <div className="em-beats">
        {order.map((b, i) => {
          const cls = i < currentIdx ? 'done' : i === currentIdx ? 'current' : ''
          const label = b === 'pickup' ? 'Pickup' : b === 'deliver' ? 'Deliver' : 'Ticket'
          return (
            <div key={b} className={`em-beat ${cls}`} data-beat={b}>
              <div className="em-beat__icon">{i + 1}</div>
              <div className="em-beat__label">{label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
