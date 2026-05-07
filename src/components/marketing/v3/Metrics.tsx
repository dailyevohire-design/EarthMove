interface Props {
  yardsCount: number
  materialsCount: number
  denverYards: number
  dfwYards: number
}

export function Metrics({ yardsCount, materialsCount, denverYards, dfwYards }: Props) {
  return (
    <section className="v3-metrics">
      <div className="v3-metric">
        <div className="num">{yardsCount}<small>YARDS</small></div>
        <div className="lbl">Verified network</div>
        <div className="delta">{denverYards} DEN · {dfwYards} DFW</div>
      </div>
      <div className="v3-metric">
        <div className="num">{materialsCount}<small>SKUS</small></div>
        <div className="lbl">Materials live</div>
        <div className="delta">Aggregate · fill · soil</div>
      </div>
      <div className="v3-metric">
        <div className="num">$2M<small>INSURED</small></div>
        <div className="lbl">Per occurrence</div>
        <div className="delta">DOT verified</div>
      </div>
      <div className="v3-metric">
        <div className="num">NET-30<small>TERMS</small></div>
        <div className="lbl">Qualified contractors</div>
        <div className="delta">MSA on request</div>
      </div>
    </section>
  )
}
