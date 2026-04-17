'use client'

import { MaterialSwatch } from './MaterialSwatch'

type Props = {
  materialSlug?: string | null
  materialName?: string | null
  quantity?: number | null
  unit?: 'ton' | 'cuyd' | null
  supplierName?: string | null
  yardName?: string | null
  pricePerUnit?: number | null
  deliveryFee?: number | null
  deliveryDate?: string | null
  total?: number | null
  autosaveState?: 'idle' | 'saving' | 'saved'
  lastSavedAt?: string | null
}

function fmtMoney(n?: number | null) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtQty(q?: number | null, u?: string | null) {
  if (q == null) return '—'
  return `${q.toLocaleString()} ${u ?? ''}`.trim()
}

export function StickySummary({
  materialSlug, materialName, quantity, unit, supplierName, yardName,
  pricePerUnit, deliveryFee, deliveryDate, total,
  autosaveState = 'idle', lastSavedAt,
}: Props) {
  return (
    <aside className="ec-summary">
      <h3 className="ec-summary__title">Order <em>summary</em></h3>

      <div className="ec-summary__row">
        <span>Material</span>
        {materialName
          ? <span className="ec-summary__row-material"><MaterialSwatch slug={materialSlug} /> {materialName}</span>
          : <strong style={{ color: 'var(--ink-300)' }}>—</strong>}
      </div>

      <div className="ec-summary__row">
        <span>Quantity</span>
        <strong>{fmtQty(quantity, unit)}</strong>
      </div>

      <div className="ec-summary__row">
        <span>Supplier</span>
        <strong style={{ textAlign: 'right' }}>
          {supplierName ?? '—'}
          {yardName && <span style={{ display: 'block', fontWeight: 400, color: 'var(--ink-500)', fontSize: 12 }}>{yardName}</span>}
        </strong>
      </div>

      <div className="ec-summary__row">
        <span>Price / unit</span>
        <strong>{fmtMoney(pricePerUnit)}</strong>
      </div>

      <div className="ec-summary__row">
        <span>Delivery</span>
        <strong>{fmtMoney(deliveryFee)}</strong>
      </div>

      {deliveryDate && (
        <div className="ec-summary__row">
          <span>Delivery date</span>
          <strong>{deliveryDate}</strong>
        </div>
      )}

      <div className="ec-summary__total">
        <span className="ec-summary__total-label">Total</span>
        <span className="ec-summary__total-val">{fmtMoney(total)}</span>
      </div>

      <div className="ec-autosave" aria-live="polite">
        <span className={`ec-autosave__dot ${autosaveState === 'saving' ? 'ec-autosave__dot--saving' : ''}`} />
        {autosaveState === 'saving' ? 'Saving…' : lastSavedAt ? `Saved ${lastSavedAt}` : 'Autosave on'}
      </div>
    </aside>
  )
}
