'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { DarkPanel } from '@/components/design-system/earthmove-ds.jsx'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { ArrowRight } from 'lucide-react'

interface CommonProps {
  materialSlug: string
  unit: 'ton' | 'cubic_yard'
}

interface StateAProps extends CommonProps {
  state: 'A'
  displayPrice: number
  overridePrice: number | null
  minQty: number
  typicalLoadSize: number | null
  loadSizeLabel: string | null
  deliveryFeeBase: number | null
  deliveryFeePerMile: number | null
  maxDeliveryMiles: number | null
  supplierName: string | null
  yardName: string | null
  marketName: string
}

interface StateBProps extends CommonProps {
  state: 'B'
  unavailableReason: string | null
  marketName: string
}

type Props = StateAProps | StateBProps

export function CommerceBlock(props: Props) {
  return props.state === 'A' ? <StateA {...props} /> : <StateB {...props} />
}

function StateA(p: StateAProps) {
  const initial = Math.max(p.minQty || 1, p.typicalLoadSize ?? p.minQty ?? 1)
  const [qty, setQty] = useState<number>(initial)

  const base = useMemo(() => {
    const has = p.overridePrice != null && p.overridePrice < p.displayPrice
    return {
      effective: has ? (p.overridePrice as number) : p.displayPrice,
      original: has ? p.displayPrice : null,
    }
  }, [p.displayPrice, p.overridePrice])

  const total = base.effective * Math.max(qty, p.minQty || 1)
  const unitWord = p.unit === 'ton' ? 'ton' : 'yd³'
  const unitWordPlural = p.unit === 'ton' ? 'tons' : 'cubic yards'
  const orderHref = `/contact?material=${encodeURIComponent(p.materialSlug)}&qty=${qty}&action=order`

  const yardTag = p.supplierName ? `${p.supplierName}${p.yardName ? ` · ${p.yardName}` : ''}` : null
  const loadCopy =
    p.loadSizeLabel ?? (p.typicalLoadSize != null ? `${p.typicalLoadSize} ${unitLabel(p.unit, p.typicalLoadSize)}` : null)

  const deliveryLine = (() => {
    const parts: string[] = [`Delivered to ${p.marketName}`]
    if (p.deliveryFeeBase != null) {
      const perMile = p.deliveryFeePerMile != null ? ` + ${formatCurrency(p.deliveryFeePerMile)}/mi` : ''
      parts.push(`base ${formatCurrency(p.deliveryFeeBase)}${perMile}`)
    }
    if (p.maxDeliveryMiles != null) parts.push(`max ${p.maxDeliveryMiles} mi from yard`)
    return `${parts.join(' · ')}. Estimate at checkout.`
  })()

  return (
    <DarkPanel className="em-pdp-commerce" eyebrow={undefined} eyebrowNum={undefined} style={undefined}>
      <style jsx>{`
        .em-pdp-commerce :global(.em-pdp-commerce__inner) { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 900px) {
          .em-pdp-commerce :global(.em-pdp-commerce__inner) { grid-template-columns: 1.15fr 1fr; gap: 40px; align-items: stretch; }
        }
        .em-pdp-commerce :global(.em-pdp-commerce__cta) {
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          background: var(--em-orange); color:#fff; font-weight:600; font-size:14px;
          padding: 12px 18px; border-radius: 12px; transition: background 120ms ease;
        }
        .em-pdp-commerce :global(.em-pdp-commerce__cta:hover) { background: var(--em-orange-press); }
        .em-pdp-commerce :global(.em-pdp-commerce__step) {
          width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.92);
          border: 1px solid rgba(255,255,255,0.10); font-size: 16px; line-height: 1;
        }
        .em-pdp-commerce :global(.em-pdp-commerce__step:hover) { background: rgba(255,255,255,0.10); }
        .em-pdp-commerce :global(.em-pdp-commerce__step:disabled) { opacity: .35; cursor: not-allowed; }
        .em-pdp-commerce :global(.em-pdp-commerce__qty) {
          width: 64px; text-align: center; background: transparent; color: #fff;
          border: none; font-size: 22px; font-weight: 600; outline: none; font-variant-numeric: tabular-nums;
        }
      `}</style>

      <div className="em-pdp-commerce__inner">
        {/* Left */}
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.72)' }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--em-emerald)' }} />
            Order this material · same-day or next-day
          </div>

          <h2 className="mt-3 text-3xl font-semibold leading-[1.1]" style={{ color: '#fff', letterSpacing: '-0.01em' }}>
            By the {p.unit === 'ton' ? 'ton' : 'cubic yard'} —{' '}
            <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.92)' }}>delivered to your site</span>
          </h2>

          <div className="mt-5 flex items-baseline gap-3">
            <div className="text-4xl font-semibold tabular-nums" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
              {formatCurrency(base.effective)}
            </div>
            {base.original != null && (
              <div className="text-base line-through tabular-nums" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {formatCurrency(base.original)}
              </div>
            )}
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
              / {unitLabel(p.unit, 1)}
            </div>
          </div>

          <p className="mt-5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 460 }}>
            {yardTag ? <>Sourced from <span style={{ color: 'rgba(255,255,255,0.92)' }}>{yardTag}</span> in {p.marketName}. </> : <>Sourced locally for {p.marketName}. </>}
            {loadCopy ? <>Typical load runs about {loadCopy}. </> : null}
            Card pre-authorized at order; final charge at delivered weight.
          </p>
        </div>

        {/* Right — nested card */}
        <div
          className="rounded-2xl p-5 flex flex-col"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Quantity
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              className="em-pdp-commerce__step"
              aria-label="Decrease quantity"
              onClick={() => setQty((q) => Math.max(p.minQty || 1, q - 1))}
              disabled={qty <= (p.minQty || 1)}
            >−</button>
            <input
              type="number"
              className="em-pdp-commerce__qty"
              min={p.minQty || 1}
              value={qty}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                setQty(Number.isFinite(n) ? Math.max(p.minQty || 1, n) : (p.minQty || 1))
              }}
            />
            <button
              type="button"
              className="em-pdp-commerce__step"
              aria-label="Increase quantity"
              onClick={() => setQty((q) => q + 1)}
            >+</button>
          </div>
          <div className="text-[11px] mt-1 text-center" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {unitWordPlural} (min {p.minQty || 1})
          </div>

          <div className="my-4 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />

          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Subtotal
            </div>
            <div className="text-sm tabular-nums" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {qty} × {formatCurrency(base.effective)}/{unitWord}
            </div>
          </div>
          <div className="text-3xl font-semibold tabular-nums mt-1" style={{ color: '#fff', letterSpacing: '-0.01em' }}>
            {formatCurrency(total)}
          </div>

          <div
            className="mt-3 text-[11px] font-mono leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {deliveryLine}
          </div>

          <Link href={orderHref} className="em-pdp-commerce__cta mt-5">
            Place order <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </DarkPanel>
  )
}

function StateB(p: StateBProps) {
  const quoteHref = `/contact?material=${encodeURIComponent(p.materialSlug)}&action=quote`
  return (
    <DarkPanel className="em-pdp-commerce" eyebrow={undefined} eyebrowNum={undefined} style={undefined}>
      <style jsx>{`
        .em-pdp-commerce :global(.em-pdp-commerce__inner) { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 900px) {
          .em-pdp-commerce :global(.em-pdp-commerce__inner) { grid-template-columns: 1.15fr 1fr; gap: 40px; align-items: center; }
        }
        .em-pdp-commerce :global(.em-pdp-commerce__cta) {
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          background: var(--em-orange); color:#fff; font-weight:600; font-size:14px;
          padding: 12px 18px; border-radius: 12px; transition: background 120ms ease;
        }
        .em-pdp-commerce :global(.em-pdp-commerce__cta:hover) { background: var(--em-orange-press); }
      `}</style>

      <div className="em-pdp-commerce__inner">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.72)' }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--em-amber)' }} />
            Quote-only · between contracts
          </div>

          <h2 className="mt-3 text-3xl font-semibold leading-[1.1]" style={{ color: '#fff', letterSpacing: '-0.01em' }}>
            Between contracts <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.92)' }}>right now</span>
          </h2>

          <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 480 }}>
            {p.unavailableReason ?? `We don't have an active supplier contract for this material in ${p.marketName} today.`}{' '}
            Send your spec sheet, quantity, and drop ZIP — we&apos;ll come back with a delivered quote within 24 hours, often same-day.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <Link href={quoteHref} className="em-pdp-commerce__cta">
            Request a quote <ArrowRight size={16} />
          </Link>
          <div className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.55)' }}>
            No obligation · response within 24 hours
          </div>
        </div>
      </div>
    </DarkPanel>
  )
}
