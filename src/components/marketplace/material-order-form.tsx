'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import type { SupplierOffering, Promotion, DeliveryType, DELIVERY_WINDOWS } from '@/types'
import { createOrderAndCheckout } from '@/app/(marketplace)/browse/[slug]/actions'
import {
  Minus, Plus, Truck, Package, CalendarDays,
  Zap, Loader2, AlertCircle, Tag, ChevronDown
} from 'lucide-react'

interface Props {
  marketMaterialId: string
  marketId: string
  materialCatalogId: string
  materialName: string
  offering: SupplierOffering
  displayPrice: number
  promo: Promotion | null
}

const WINDOWS = ['Morning (7am–12pm)', 'Afternoon (12pm–5pm)', 'Anytime'] as const

export function MaterialOrderForm({
  marketMaterialId, marketId, materialCatalogId,
  materialName, offering, displayPrice, promo,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // Step: 'configure' → 'delivery' → 'review'
  const [step, setStep] = useState<'configure' | 'delivery' | 'review'>('configure')
  const [quantity, setQuantity] = useState(offering.minimum_order_quantity)
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('asap')
  const [address, setAddress] = useState({ street: '', city: '', state: 'TX', zip: '', notes: '' })
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryWindow, setDeliveryWindow] = useState<string>('Anytime')
  const [quote, setQuote] = useState<any>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)

  const adjustQty = (delta: number) =>
    setQuantity(q => Math.max(offering.minimum_order_quantity, +(q + delta).toFixed(1)))

  const estimatedSubtotal = displayPrice * quantity

  const fetchQuote = async () => {
    setLoadingQuote(true)
    setQuoteError(null)
    try {
      const res = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_id: marketId,
          material_catalog_id: materialCatalogId,
          quantity,
          fulfillment_method: 'delivery',
          delivery_type: deliveryType,
          distance_miles: 15, // TODO: calculate from geocoded address
        }),
      })
      const data = await res.json()
      if (!data.success) { setQuoteError(data.error); setQuote(null) }
      else setQuote(data.data)
    } catch {
      setQuoteError('Failed to calculate price. Please try again.')
    } finally {
      setLoadingQuote(false)
    }
  }

  const handleContinue = async () => {
    await fetchQuote()
    if (!quoteError) setStep('delivery')
  }

  const handleReview = async () => {
    await fetchQuote()
    if (!quoteError) setStep('review')
  }

  const handleOrder = () => {
    setOrderError(null)
    startTransition(async () => {
      const result = await createOrderAndCheckout({
        market_material_id: marketMaterialId,
        quantity,
        delivery_type: deliveryType,
        fulfillment_method: 'delivery',
        delivery_address: {
          street_line_1: address.street,
          city: address.city,
          state: address.state,
          zip: address.zip,
          delivery_notes: address.notes || undefined,
        },
        requested_delivery_date: deliveryType === 'scheduled' ? deliveryDate : null,
        requested_delivery_window: deliveryType === 'scheduled' ? deliveryWindow : null,
        delivery_notes: address.notes || null,
        distance_miles: 15, // TODO: real geocoding
      })

      if (result.success) {
        window.location.href = result.data.checkout_url
      } else if (result.code === 'AUTH_REQUIRED') {
        router.push(`/login?redirectTo=/browse/${window.location.pathname.split('/').pop()}`)
      } else {
        setOrderError(result.error)
      }
    })
  }

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  return (
    <div className="card p-6 space-y-5">
      {/* Promo badge */}
      {promo && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/8 border border-amber-500/20 rounded-lg">
          <Tag size={13} className="text-amber-400 flex-shrink-0" />
          <span className="text-amber-300 text-xs font-semibold">{promo.badge_label ?? 'PROMOTION'}</span>
          <span className="text-amber-400/70 text-xs truncate">{promo.title}</span>
        </div>
      )}

      {/* ── Step: Configure ── */}
      {step === 'configure' && (
        <>
          <div>
            <label className="input-label">Quantity</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => adjustQty(-1)}
                disabled={quantity <= offering.minimum_order_quantity}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-stone-800 border border-stone-700 text-stone-300 hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              ><Minus size={15} /></button>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(Math.max(offering.minimum_order_quantity, +e.target.value || offering.minimum_order_quantity))}
                className="flex-1 input text-center text-lg font-bold"
                min={offering.minimum_order_quantity}
                step={1}
              />
              <button
                onClick={() => adjustQty(1)}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-stone-800 border border-stone-700 text-stone-300 hover:bg-stone-700 transition-colors"
              ><Plus size={15} /></button>
            </div>
            <p className="text-xs text-stone-600 mt-1.5">
              {unitLabel(offering.unit, quantity)} · Min {offering.minimum_order_quantity} {unitLabel(offering.unit, offering.minimum_order_quantity)}
            </p>
          </div>

          {/* Delivery type */}
          <div>
            <label className="input-label">When do you need it?</label>
            <div className="grid grid-cols-2 gap-2">
              {([['asap', 'ASAP', Zap], ['scheduled', 'Schedule', CalendarDays]] as const).map(([val, label, Icon]) => (
                <button
                  key={val}
                  onClick={() => setDeliveryType(val)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${deliveryType === val ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'}`}
                >
                  <Icon size={15} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Price preview */}
          <div className="border-t border-stone-800 pt-4">
            <div className="flex justify-between items-baseline">
              <span className="text-stone-400 text-sm">Estimated materials</span>
              <span className="price-display text-xl">{formatCurrency(estimatedSubtotal)}</span>
            </div>
            <p className="text-stone-600 text-xs mt-1">+ delivery & service fee at checkout</p>
          </div>

          {quoteError && <ErrorMsg message={quoteError} />}

          <button
            onClick={handleContinue}
            disabled={loadingQuote}
            className="btn-primary btn-lg w-full"
          >
            {loadingQuote ? <><Loader2 size={16} className="animate-spin" />Calculating…</> : 'Continue →'}
          </button>
        </>
      )}

      {/* ── Step: Delivery ── */}
      {step === 'delivery' && (
        <>
          <BackButton onClick={() => setStep('configure')} />
          <h3 className="font-semibold text-stone-200">Delivery Details</h3>

          <div className="space-y-3">
            <div>
              <label className="input-label">Street address</label>
              <input className="input" placeholder="123 Job Site Rd" value={address.street}
                onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="input-label">City</label>
                <input className="input" placeholder="Dallas" value={address.city}
                  onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">ZIP</label>
                <input className="input" placeholder="75201" value={address.zip}
                  onChange={e => setAddress(a => ({ ...a, zip: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="input-label">Access notes <span className="text-stone-600">(optional)</span></label>
              <textarea className="input resize-none" rows={2}
                placeholder="Gate code, truck access, drop location…"
                value={address.notes}
                onChange={e => setAddress(a => ({ ...a, notes: e.target.value }))} />
            </div>
          </div>

          {deliveryType === 'scheduled' && (
            <div className="space-y-3">
              <div>
                <label className="input-label">Delivery date</label>
                <input type="date" className="input" min={minDateStr}
                  value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Preferred window</label>
                <select className="input" value={deliveryWindow} onChange={e => setDeliveryWindow(e.target.value)}>
                  {WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>
          )}

          {quoteError && <ErrorMsg message={quoteError} />}

          <button
            onClick={handleReview}
            disabled={loadingQuote || !address.street || !address.city || !address.zip || (deliveryType === 'scheduled' && !deliveryDate)}
            className="btn-primary btn-lg w-full"
          >
            {loadingQuote ? <><Loader2 size={16} className="animate-spin" />Calculating…</> : 'Review Order →'}
          </button>
        </>
      )}

      {/* ── Step: Review ── */}
      {step === 'review' && quote && (
        <>
          <BackButton onClick={() => setStep('delivery')} />
          <h3 className="font-semibold text-stone-200">Order Summary</h3>

          <div className="space-y-2">
            {quote.line_items.map((li: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className={li.type === 'discount' ? 'text-emerald-400' : 'text-stone-400'}>{li.label}</span>
                <span className={`font-medium ${li.type === 'discount' ? 'text-emerald-400' : 'text-stone-300'}`}>
                  {li.amount < 0 ? `−${formatCurrency(Math.abs(li.amount))}` : formatCurrency(li.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-stone-100 pt-3 border-t border-stone-800 text-lg">
              <span>Total</span>
              <span className="price-display">{formatCurrency(quote.total_amount)}</span>
            </div>
          </div>

          {quote.needs_review && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              Large orders may require confirmation before dispatch. We'll be in touch.
            </div>
          )}

          {orderError && <ErrorMsg message={orderError} />}

          <button onClick={handleOrder} disabled={pending} className="btn-primary btn-xl w-full">
            {pending
              ? <><Loader2 size={16} className="animate-spin" />Processing…</>
              : `Pay ${formatCurrency(quote.total_amount)} →`}
          </button>
          <p className="text-center text-xs text-stone-600">
            Secure checkout via Stripe. You'll be redirected to complete payment.
          </p>
        </>
      )}
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-stone-500 hover:text-stone-300 text-sm transition-colors">
      ← Back
    </button>
  )
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
      <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
      <span className="text-red-400 text-sm">{message}</span>
    </div>
  )
}
