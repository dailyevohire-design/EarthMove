'use client'

type Props = {
  value: { quantity?: number; unit?: 'ton' | 'cuyd' }
  onChange: (v: { quantity: number; unit: 'ton' | 'cuyd' }) => void
  densityTonsPerCuyd: number | null
  minOrderWarning?: string | null
}

export function Step2Quantity({ value, onChange, densityTonsPerCuyd, minOrderWarning }: Props) {
  const qty = value.quantity ?? 0
  const unit = value.unit ?? 'ton'

  function setQty(next: number) { onChange({ quantity: Number.isFinite(next) ? next : 0, unit }) }
  function setUnit(next: 'ton' | 'cuyd') { onChange({ quantity: qty, unit: next }) }

  let convertLine: React.ReactNode = null
  if (qty > 0 && densityTonsPerCuyd) {
    if (unit === 'ton') {
      const cuyd = qty / densityTonsPerCuyd
      convertLine = <>≈ <strong>{cuyd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong> cu yd</>
    } else {
      const tons = qty * densityTonsPerCuyd
      convertLine = <>≈ <strong>{tons.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong> tons</>
    }
  }

  return (
    <div className="ec-qty">
      <div className="ec-qty__input-row">
        <input
          type="number"
          min="0"
          step="0.1"
          className="ec-qty__input"
          value={qty || ''}
          onChange={e => setQty(parseFloat(e.target.value))}
          placeholder="0"
          aria-label="Quantity"
        />
        <div className="ec-qty__unit-toggle" role="radiogroup" aria-label="Unit">
          <button
            type="button"
            role="radio"
            aria-checked={unit === 'ton'}
            className={unit === 'ton' ? 'active' : ''}
            onClick={() => setUnit('ton')}
          >
            Tons
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={unit === 'cuyd'}
            className={unit === 'cuyd' ? 'active' : ''}
            onClick={() => setUnit('cuyd')}
            disabled={!densityTonsPerCuyd}
            title={densityTonsPerCuyd ? '' : 'No density on catalog; pick tons'}
          >
            Cu yd
          </button>
        </div>
      </div>
      {convertLine && <div className="ec-qty__convert">{convertLine}</div>}
      {!densityTonsPerCuyd && (
        <div className="ec-qty__convert" style={{ color: 'var(--clay-700)' }}>
          This material has no density on file. Cu yd conversion unavailable.
        </div>
      )}
      {minOrderWarning && (
        <div className="ec-qty__convert" style={{ color: 'var(--clay-700)' }}>{minOrderWarning}</div>
      )}
    </div>
  )
}
