interface Props {
  yardsCount: number
}

export function TrustBand({ yardsCount }: Props) {
  const items = [
    { k: 'DOT', v: 'Verified', sub: 'Carrier compliant' },
    { k: 'INS', v: '$2M', sub: 'Per occurrence' },
    { k: 'TERMS', v: 'NET-30', sub: 'MSA on request' },
    { k: 'OPS', v: 'M–F · 5a–8p', sub: 'Mountain · Central' },
    { k: 'YARDS', v: String(yardsCount), sub: 'Verified · routed' },
    { k: 'TRACKING', v: 'Live', sub: 'GPS · photo on drop' },
  ]
  return (
    <section className="v3-trust">
      <div className="v3-trust-head">
        <span className="e">— Operational standard</span>
      </div>
      <div className="v3-trust-grid">
        {items.map((it) => (
          <div key={it.k} className="v3-trust-cell">
            <div className="tk">{it.k}</div>
            <div className="tv">{it.v}</div>
            <div className="ts">{it.sub}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
