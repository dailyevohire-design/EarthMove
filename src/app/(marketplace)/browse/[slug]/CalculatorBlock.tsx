'use client'

import { useMemo, useState } from 'react'

interface Props {
  density: number | null
  defaultUnit: 'ton' | 'cubic_yard'
  pricePerUnit: number | null
}

export function CalculatorBlock({ density, defaultUnit, pricePerUnit }: Props) {
  const [length, setLength] = useState<number>(20)
  const [width, setWidth]   = useState<number>(10)
  const [depthIn, setDepthIn] = useState<number>(4)

  const result = useMemo(() => {
    const sqft = Math.max(0, length) * Math.max(0, width)
    const cuft = sqft * (Math.max(0, depthIn) / 12)
    const yd3  = cuft / 27
    const tons = density ? yd3 * density : null
    const primary = defaultUnit === 'ton' && tons != null ? tons : yd3
    const cost = pricePerUnit != null ? primary * pricePerUnit : null
    return { yd3, tons, cost }
  }, [length, width, depthIn, density, defaultUnit, pricePerUnit])

  const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2)
  const fmtMoney = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        background: 'var(--em-card)',
        borderColor: 'var(--em-hair)',
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1"
        style={{ color: 'var(--em-ink-3)' }}
      >
        Coverage calculator
      </div>
      <div className="text-base font-semibold" style={{ color: 'var(--em-ink)' }}>
        How much do I need?
      </div>
      <p className="text-sm mt-1" style={{ color: 'var(--em-ink-2)' }}>
        Enter your area and depth. We&apos;ll convert to {density ? 'tons and ' : ''}cubic yards.
      </p>

      <div className="grid grid-cols-3 gap-3 mt-5">
        <Field label="Length (ft)" value={length} onChange={setLength} />
        <Field label="Width (ft)"  value={width}  onChange={setWidth}  />
        <Field label="Depth (in)"  value={depthIn} onChange={setDepthIn} />
      </div>

      <div
        className="mt-5 pt-5 border-t flex flex-wrap items-baseline gap-x-8 gap-y-3"
        style={{ borderColor: 'var(--em-hair)' }}
      >
        <Readout label="Cubic yards" value={`${round2(result.yd3)} yd³`} />
        {result.tons != null && (
          <Readout label="Tons" value={`${round2(result.tons)} t`} />
        )}
        {result.cost != null && (
          <Readout
            label="Estimated material cost"
            value={fmtMoney(result.cost)}
            muted
          />
        )}
      </div>

      <p className="text-[11px] mt-4" style={{ color: 'var(--em-ink-3)' }}>
        Estimate only. Card is pre-authorized at order weight, charged at delivered scale ticket.
      </p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="block">
      <span
        className="block text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5"
        style={{ color: 'var(--em-ink-3)' }}
      >
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          onChange(Number.isFinite(n) ? n : 0)
        }}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2"
        style={{
          background: 'var(--em-paper)',
          border: '1px solid var(--em-hair-strong)',
          color: 'var(--em-ink)',
        }}
      />
    </label>
  )
}

function Readout({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: 'var(--em-ink-3)' }}
      >
        {label}
      </div>
      <div
        className={muted ? 'text-base font-mono' : 'text-xl font-semibold'}
        style={{ color: muted ? 'var(--em-ink-2)' : 'var(--em-ink)' }}
      >
        {value}
      </div>
    </div>
  )
}
