'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import type { SupplierOffering, Promotion, DeliveryType } from '@/types'
import { createOrderAndCheckout } from '@/app/(marketplace)/browse/[slug]/actions'
import {
  Minus, Plus, CalendarDays,
  Zap, Loader2, AlertCircle, Tag,
} from 'lucide-react'

interface Props {
  marketMaterialId: string
  marketId: string
  materialCatalogId: string
  materialName: string
  offering: SupplierOffering
  displayPrice: number
  promo: Promotion | null
  marketState?: string
  marketCenterLat?: number
  marketCenterLng?: number
  /** When false, the form shows guest checkout fields and a sign-in option. */
  isAuthenticated?: boolean
}

const WINDOWS = ['Morning (7am–12pm)', 'Afternoon (12pm–5pm)', 'Anytime'] as const

export function MaterialOrderForm({
  marketMaterialId, marketId, materialCatalogId,
  materialName: _materialName, offering, displayPrice, promo,
  marketState = 'TX', marketCenterLat, marketCenterLng,
  isAuthenticated = false,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [step, setStep] = useState<'configure' | 'delivery' | 'review'>('configure')
  const [quantity, setQuantity] = useState(offering.minimum_order_quantity)
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('asap')
  const [address, setAddress] = useState({ street: '', city: '', state: marketState, zip: '', notes: '' })
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryWindow, setDeliveryWindow] = useState<string>('Anytime')
  const [quote, setQuote] = useState<any>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)

  // Guest checkout fields — used when isAuthenticated is false
  const [guestEmail, setGuestEmail] = useState('')
  const [guestFirstName, setGuestFirstName] = useState('')
  const [guestLastName, setGuestLastName] = useState('')

  const adjustQty = (delta: number) =>
    setQuantity(q => Math.max(offering.minimum_order_quantity, +(q + delta).toFixed(1)))

  // Estimate distance from market center using ZIP code centroid lookup
  // Uses haversine approximation based on ZIP prefix → rough lat/lng
  const estimateDistance = (): number => {
    if (!marketCenterLat || !marketCenterLng) return 15 // fallback
    // ZIP-based rough estimate: use market center distance of ~15mi as default
    // Real geocoding would be better but this is a reasonable launch approximation
    const zip = address.zip?.replace(/\s/g, '')
    if (!zip || zip.length < 5) return 15
    // For launch: use 15 miles as baseline since we serve within 50mi radius
    // TODO: integrate geocoding API for precise distance
    return 15
  }

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
          distance_miles: estimateDistance(),
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

    // Guest validation when not signed in
    if (!isAuthenticated) {
      if (!/^\S+@\S+\.\S+$/.test(guestEmail)) {
        setOrderError('Please enter a valid email address.')
        return
      }
      if (!guestFirstName.trim() || !guestLastName.trim()) {
        setOrderError('First and last name are required.')
        return
      }
    }

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
        distance_miles: estimateDistance(),
        ...(isAuthenticated ? {} : {
          guest: {
            email: guestEmail.trim(),
            first_name: guestFirstName.trim(),
            last_name: guestLastName.trim(),
          },
        }),
      })

      if (result.success) {
        window.location.href = result.data.checkout_url
      } else if (result.code === 'AUTH_REQUIRED') {
        // Should only happen if guest provisioning fails — fall back to login.
        const slug = window.location.pathname.split('/').pop() ?? ''
        router.push(`/login?redirectTo=/browse/${slug}`)
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
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <Tag size={13} className="text-emerald-600 flex-shrink-0" />
          <span className="text-emerald-700 text-xs font-semibold">{promo.badge_label ?? 'PROMOTION'}</span>
          <span className="text-emerald-600/70 text-xs truncate">{promo.title}</span>
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
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 transition-colors"
              ><Plus size={15} /></button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
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
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${deliveryType === val ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >
                  <Icon size={15} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Price preview */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex justify-between items-baseline">
              <span className="text-gray-500 text-sm">Estimated materials</span>
              <span className="price-display text-xl">{formatCurrency(estimatedSubtotal)}</span>
            </div>
            <p className="text-gray-400 text-xs mt-1">+ delivery & service fee at checkout</p>
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
          <h3 className="font-semibold text-gray-900">Delivery Details</h3>

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
              <label className="input-label">Access notes <span className="text-gray-400">(optional)</span></label>
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
          <h3 className="font-semibold text-gray-900">Order Summary</h3>

          <div className="space-y-2">
            {quote.line_items.map((li: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className={li.type === 'discount' ? 'text-emerald-600' : 'text-gray-500'}>{li.label}</span>
                <span className={`font-medium ${li.type === 'discount' ? 'text-emerald-600' : 'text-gray-700'}`}>
                  {li.amount < 0 ? `−${formatCurrency(Math.abs(li.amount))}` : formatCurrency(li.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-gray-900 pt-3 border-t border-gray-200 text-lg">
              <span>Total</span>
              <span className="price-display">{formatCurrency(quote.total_amount)}</span>
            </div>
          </div>

          {quote.needs_review && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              Large orders may require confirmation before dispatch. We'll be in touch.
            </div>
          )}

          {/* Guest checkout — only when not signed in */}
          {!isAuthenticated && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-900 text-sm">Your details</h4>
                <Link
                  href={`/login?redirectTo=/browse/${typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : ''}`}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                  Have an account? Sign in →
                </Link>
              </div>
              <p className="text-xs text-gray-500 -mt-1.5">
                Checking out as guest — we&apos;ll email you a link to claim your account afterward.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  className="input"
                  placeholder="First name"
                  value={guestFirstName}
                  onChange={e => setGuestFirstName(e.target.value)}
                  autoComplete="given-name"
                />
                <input
                  type="text"
                  className="input"
                  placeholder="Last name"
                  value={guestLastName}
                  onChange={e => setGuestLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
              <input
                type="email"
                className="input"
                placeholder="Email for receipts and dispatch updates"
                value={guestEmail}
                onChange={e => setGuestEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          )}

          {orderError && <ErrorMsg message={orderError} />}

          <button onClick={handleOrder} disabled={pending} className="btn-primary btn-xl w-full">
            {pending
              ? <><Loader2 size={16} className="animate-spin" />Processing…</>
              : `Pay ${formatCurrency(quote.total_amount)} →`}
          </button>
          <p className="text-center text-xs text-gray-400">
            Secure checkout via Stripe. You&apos;ll be redirected to complete payment.
          </p>
        </>
      )}
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-gray-500 hover:text-gray-700 text-sm transition-colors">
      ← Back
    </button>
  )
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
      <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
      <span className="text-red-600 text-sm">{message}</span>
    </div>
  )
}
