import Link from 'next/link'

export type AttentionItem = {
  kind: string
  message: string
  cta_href?: string | null
  cta_label?: string | null
  severity: 'info' | 'warn' | 'alert'
}

export function AttentionQueue({ items }: { items: AttentionItem[] }) {
  if (!items.length) {
    return (
      <div className="ec-queue">
        <div className="ec-queue__empty">Nothing needs you right now. Nice.</div>
      </div>
    )
  }
  return (
    <div className="ec-queue">
      {items.map((it, i) => {
        const dotCls =
          it.severity === 'alert' ? 'ec-queue__dot--alert' :
          it.severity === 'warn'  ? 'ec-queue__dot--warn'  : ''
        return (
          <div key={`${it.kind}-${i}`} className="ec-queue__row">
            <span className={`ec-queue__dot ${dotCls}`} />
            <span>{it.message}</span>
            {it.cta_href ? (
              <Link className="ec-queue__cta" href={it.cta_href}>
                {it.cta_label ?? 'View'}
              </Link>
            ) : <span />}
          </div>
        )
      })}
    </div>
  )
}
