type Props = {
  kicker?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  right?: React.ReactNode
}

export function PageHead({ kicker, title, subtitle, right }: Props) {
  return (
    <header className="ec-pagehead" style={right ? { display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', gap: 20 } : undefined}>
      <div>
        {kicker && <div className="ec-pagehead__kicker">{kicker}</div>}
        <h1 className="ec-pagehead__title">{title}</h1>
        {subtitle && <p className="ec-pagehead__subtitle">{subtitle}</p>}
      </div>
      {right}
    </header>
  )
}
