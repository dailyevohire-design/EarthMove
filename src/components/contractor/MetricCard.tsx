type Delta = {
  value: string        // "+12%" or "−3"
  direction: 'up' | 'down' | 'flat'
}

type Props = {
  label: string
  value: string        // already-formatted (e.g. "$3,842.50", "11", "4h 22m")
  footer?: React.ReactNode
  delta?: Delta
}

export function MetricCard({ label, value, footer, delta }: Props) {
  return (
    <article className="ec-metric">
      <div className="ec-metric__label">{label}</div>
      <div className="ec-metric__value">{value}</div>
      <div className="ec-metric__footer">
        <span>{footer ?? '\u00A0'}</span>
        {delta && (
          <span className={`ec-metric__delta ec-metric__delta--${delta.direction}`}>
            {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '·'} {delta.value}
          </span>
        )}
      </div>
    </article>
  )
}
