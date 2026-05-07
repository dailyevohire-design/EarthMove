interface RailItem {
  k: string
  v: string
  c?: 'up' | 'warn' | ''
}

interface Props {
  yardsCount: number
  materialsCount: number
  denverYards: number
  dfwYards: number
}

export function LiveRail({ yardsCount, materialsCount, denverYards, dfwYards }: Props) {
  const items: RailItem[] = [
    { k: 'NETWORK', v: `${yardsCount} YARDS`, c: 'up' },
    { k: 'DEN-METRO', v: `${denverYards} YARDS`, c: 'up' },
    { k: 'DFW', v: `${dfwYards} YARDS`, c: 'up' },
    { k: 'MATERIALS', v: `${materialsCount} SKUS`, c: '' },
    { k: 'CUTOFF', v: '10:00 LOCAL', c: 'warn' },
    { k: 'DOT', v: 'VERIFIED', c: 'up' },
    { k: 'INS', v: '$2M / OCC', c: '' },
    { k: 'NET-30', v: 'CONTRACTORS', c: '' },
  ]

  return (
    <div className="v3-rail">
      <div className="v3-rail-pulse">
        <span className="dot" />
        <span>NETWORK</span>
      </div>
      <div className="v3-rail-track">
        <div className="v3-rail-tape">
          {[...items, ...items].map((it, i) => (
            <span key={i} className="v3-rail-cell">
              <span className="k">{it.k}</span>
              <span className={'v ' + (it.c || '')}>{it.v}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
