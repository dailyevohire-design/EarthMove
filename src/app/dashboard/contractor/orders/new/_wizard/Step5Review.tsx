'use client'

type Props = {
  materialName: string
  supplierName: string
  yardName?: string | null
  quantity: number
  unit: 'ton' | 'cuyd'
  pricePerUnit: number
  deliveryFee: number
  subtotal: number
  platformFee: number
  total: number
  deliveryAddress: string
  deliveryDate?: string | null
  deliveryNotes?: string | null
  requiresApproval: boolean
  submitting: boolean
  onSubmit: () => void
}

export function Step5Review(p: Props) {
  const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <div>
      <div className="ec-section" style={{ marginBottom: 20 }}>
        <div className="ec-section__head"><h2 className="ec-section__title">Line <em>items</em></h2></div>
        <div className="ec-section__body">
          <div className="ec-order">
            <span />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.materialName}</div>
              <div className="ec-order__meta">
                {p.supplierName}{p.yardName ? `  ·  ${p.yardName}` : ''}  ·  {p.quantity} {p.unit}
              </div>
            </div>
            <span className="ec-order__amount">{money(p.subtotal)}</span>
            <span />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14, marginBottom: 20, background: '#fff', border: 'var(--edge)', borderRadius: 'var(--r-md)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ink-500)' }}>
          <span>Price per {p.unit}</span>
          <span style={{ fontFamily: 'var(--font-num)', color: 'var(--ink-950)' }}>{money(p.pricePerUnit)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ink-500)' }}>
          <span>Subtotal</span>
          <span style={{ fontFamily: 'var(--font-num)', color: 'var(--ink-950)' }}>{money(p.subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ink-500)' }}>
          <span>Delivery fee</span>
          <span style={{ fontFamily: 'var(--font-num)', color: 'var(--ink-950)' }}>{money(p.deliveryFee)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ink-500)' }}>
          <span>Platform fee</span>
          <span style={{ fontFamily: 'var(--font-num)', color: 'var(--ink-950)' }}>{money(p.platformFee)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: 'var(--edge)' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-500)', fontWeight: 600 }}>Total</span>
          <span style={{ fontFamily: 'var(--font-num)', fontWeight: 600, fontSize: 22, color: 'var(--ink-950)', fontVariantNumeric: 'tabular-nums' }}>
            {money(p.total)}
          </span>
        </div>
      </div>

      <div style={{ background: '#fff', border: 'var(--edge)', borderRadius: 'var(--r-md)', padding: '16px 20px', marginBottom: 20, fontSize: 13.5 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-500)', fontWeight: 600, marginBottom: 8 }}>Delivery</div>
        <div style={{ color: 'var(--ink-950)' }}>{p.deliveryAddress}</div>
        {p.deliveryDate && <div style={{ color: 'var(--ink-500)', marginTop: 4 }}>On {p.deliveryDate}</div>}
        {p.deliveryNotes && <div style={{ color: 'var(--ink-500)', marginTop: 6, fontSize: 12 }}>{p.deliveryNotes}</div>}
      </div>

      {p.requiresApproval && (
        <div style={{ background: 'rgba(158,85,37,0.08)', border: '0.5px solid var(--clay-600)', padding: '12px 16px', borderRadius: 'var(--r-md)', marginBottom: 20, color: 'var(--clay-700)', fontSize: 13 }}>
          This order exceeds your spend limit and will be sent for approval before dispatch.
        </div>
      )}

      <button
        type="button"
        className="ec-btn ec-btn--primary"
        style={{ width: '100%', padding: 16, fontSize: 16 }}
        onClick={p.onSubmit}
        disabled={p.submitting}
      >
        {p.submitting ? 'Placing order…' : p.requiresApproval ? 'Submit for approval' : 'Place order'}
      </button>
    </div>
  )
}
