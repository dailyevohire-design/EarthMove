'use client'

import { useEffect, useState } from 'react'
import type { MatchedSupplier } from '@/lib/services/place-order.service'

type Props = {
  materialId: string
  quantity: number
  unit: 'ton' | 'cuyd'
  zip?: string
  value: { supplier_offering_id?: string }
  onChange: (m: MatchedSupplier) => void
}

function relativeTime(iso?: string | null): string {
  if (!iso) return 'never verified'
  const then = new Date(iso).getTime()
  const now = Date.now()
  const mins = Math.floor((now - then) / 60000)
  if (mins < 60) return `verified ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `verified ${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `verified ${days}d ago`
  const months = Math.floor(days / 30)
  return `verified ${months}mo ago`
}

export function Step3Supplier({ materialId, quantity, unit, zip, value, onChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<MatchedSupplier[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!materialId || !quantity) { setMatches([]); return }
    setLoading(true)
    setErr(null)
    const qs = new URLSearchParams({
      material_catalog_id: materialId,
      qty: String(quantity),
      unit,
    })
    if (zip) qs.set('zip', zip)
    fetch(`/api/contractor/orders/suppliers/match?${qs.toString()}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { if (!cancelled) setMatches(d.matches || []) })
      .catch(e => { if (!cancelled) setErr(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [materialId, quantity, unit, zip])

  if (loading) return <div style={{ color: 'var(--ink-500)' }}>Matching suppliers…</div>
  if (err) return <div style={{ color: 'var(--clay-700)' }}>Couldn't load matches: {err}</div>
  if (!matches.length) return <div style={{ color: 'var(--ink-500)' }}>No suppliers match this material + quantity in your market.</div>

  return (
    <div className="ec-supplier-cards" role="radiogroup" aria-label="Supplier">
      {matches.map(m => {
        const selected = value.supplier_offering_id === m.offering_id
        return (
          <button
            key={m.offering_id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`ec-supplier-card ${selected ? 'selected' : ''}`}
            onClick={() => onChange(m)}
          >
            <span className="ec-supplier-card__radio" />
            <div style={{ textAlign: 'left' }}>
              <div className="ec-supplier-card__name">{m.supplier_name}</div>
              <div className="ec-supplier-card__yard">{m.yard_name}{m.yard_city ? `  ·  ${m.yard_city}` : ''}</div>
              <div className="ec-supplier-card__meta">
                {m.distance_miles != null && <span>{m.distance_miles} mi</span>}
                {m.estimated_delivery_fee != null && <span>• delivery ${m.estimated_delivery_fee.toFixed(0)}</span>}
                {m.max_delivery_miles != null && <span>• max {m.max_delivery_miles} mi</span>}
                {m.minimum_order_quantity > 1 && <span>• min {m.minimum_order_quantity} {m.unit}</span>}
              </div>
              <span className={`ec-supplier-card__verif ec-supplier-card__verif--${m.verification_status === 'verified' ? 'verified' : 'unverified'}`}>
                {relativeTime(m.last_verified_at)}
              </span>
            </div>
            <div className="ec-supplier-card__price">
              <div className="ec-supplier-card__price-val">${m.price_per_unit.toFixed(2)}</div>
              <div className="ec-supplier-card__price-unit">per {m.unit}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
