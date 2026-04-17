import { TopoPattern } from '@/components/shared/TopoPattern'

type Props = {
  pickupLabel: string
  deliverLabel: string
  distanceMiles?: number | null
  etaMinutes?: number | null
  speedMph?: number | null
}

export function MapPreview({ pickupLabel, deliverLabel, distanceMiles, etaMinutes, speedMph }: Props) {
  return (
    <div className="em-map">
      <TopoPattern className="em-map__topo" />
      <svg className="em-map__line" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden>
        <path d="M20 30 Q 200 70 380 100"
              stroke="#E89318" strokeWidth="3" fill="none" strokeDasharray="6 4" opacity="0.85" />
      </svg>
      <div className="em-map__pin em-map__pin--pickup">
        <div className="em-map__pin-dot" />
        <div className="em-map__pin-label">{pickupLabel}</div>
      </div>
      <div className="em-map__pin em-map__pin--drop">
        <div className="em-map__pin-dot" />
        <div className="em-map__pin-label">{deliverLabel}</div>
      </div>
      <div className="em-map__truck"><div className="em-map__truck-dot" /></div>
      {(distanceMiles != null || etaMinutes != null) && (
        <div className="em-map__stat">
          {distanceMiles != null && <><strong>{distanceMiles} mi</strong>  ·  </>}
          {etaMinutes != null && <>{etaMinutes} min  ·  </>}
          {speedMph != null && <>{speedMph} mph</>}
        </div>
      )}
      <button className="em-map__recenter" aria-label="Recenter">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
    </div>
  )
}
