'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2, ArrowRight, AlertCircle, Check } from 'lucide-react'

interface Props {
  material_catalog_id: string
  materialName: string
  tons: number
  zipPrefill: string
  deliveryWindow: string | null
  projectType: string | null
  subType: string | null
  isGuest: boolean
  userEmail: string | null
  userFirstName: string | null
  userLastName: string | null
  userPhone: string | null
  welcome5Eligible: boolean
  pricePerTonCents: number
  subtotalCents: number
  deliveryFeeCents: number
  welcome5DiscountCents: number
  finalTotalCents: number
  cancelled: boolean
}

const DELIVERY_WINDOW_LABEL: Record<string, string> = {
  this_week: 'This week',
  next_2_weeks: 'Next 2 weeks',
  this_month: 'This month',
  researching: 'Just researching',
}

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const FRAUNCES = "var(--font-fraunces), serif"

export function CheckoutClient(props: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [first_name, setFirstName] = useState(props.userFirstName ?? '')
  const [last_name, setLastName] = useState(props.userLastName ?? '')
  const [email, setEmail] = useState(props.userEmail ?? '')
  const [phone, setPhone] = useState(props.userPhone ?? '')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('TX')
  const [zip, setZip] = useState(props.zipPrefill)
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (
      !first_name.trim() || !last_name.trim() ||
      !email.trim() || !phone.trim() ||
      !street.trim() || !city.trim() || !state.trim() || !zip.trim()
    ) {
      setError('Please fill in all required fields.')
      return
    }
    if (!/^\d{5}$/.test(zip.trim())) {
      setError('ZIP must be 5 digits.')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/checkout/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            material_catalog_id: props.material_catalog_id,
            material_name: props.materialName,
            tons: props.tons,
            delivery: {
              street: street.trim(),
              city: city.trim(),
              state: state.trim(),
              zip: zip.trim(),
              notes: notes.trim() || null,
            },
            contact: {
              first_name: first_name.trim(),
              last_name: last_name.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.trim(),
            },
            delivery_window: props.deliveryWindow,
            project_type: props.projectType,
            sub_type: props.subType,
            apply_welcome5: props.welcome5Eligible,
            is_guest: props.isGuest,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.url) {
          setError(data.error ?? 'Failed to start checkout. Please try again.')
          return
        }
        window.location.href = data.url
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error. Please try again.')
      }
    })
  }

  return (
    <main className="em-surface min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Header */}
        <div className="max-w-[760px] mb-8">
          <div className="text-xs font-semibold text-[var(--commerce-trust)] tracking-[0.18em] uppercase mb-3">
            Checkout
          </div>
          <h1
            className="text-4xl md:text-5xl leading-[1.1] font-medium tracking-[-0.02em] text-[var(--commerce-ink)]"
            style={{ fontFamily: FRAUNCES }}
          >
            Where should we deliver?
          </h1>
          <p className="text-[var(--commerce-ink-3)] text-base mt-2">
            One step from sending a truck. Card and payment details on the next page.
          </p>
        </div>

        {props.cancelled && (
          <div className="mb-6 p-4 rounded-xl bg-[#fef3c7] border border-[#f59e0b]/40 flex items-start gap-3 max-w-[760px]">
            <AlertCircle className="w-5 h-5 text-[#a16207] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--commerce-ink-2)]">
              You stepped back from Stripe checkout. No payment was taken. Confirm details and try again when you&apos;re ready.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_400px] gap-8">
          {/* Left column — form cards */}
          <div className="space-y-6">
            {/* CARD 1: Delivery */}
            <article className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-7 h-7 rounded-full bg-[var(--commerce-trust)] text-white text-sm font-semibold flex items-center justify-center">
                  1
                </span>
                <h2
                  className="text-2xl text-[var(--commerce-ink)] font-medium tracking-[-0.015em]"
                  style={{ fontFamily: FRAUNCES }}
                >
                  Delivery address
                </h2>
              </div>

              <div className="grid gap-4">
                <Field label="Street address" required>
                  <input
                    type="text"
                    required
                    autoComplete="address-line1"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="1234 Project Site Rd"
                    className="text-input"
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px] gap-4">
                  <Field label="City" required>
                    <input
                      type="text"
                      required
                      autoComplete="address-level2"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="text-input"
                    />
                  </Field>
                  <Field label="State" required>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      autoComplete="address-level1"
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      className="text-input uppercase"
                    />
                  </Field>
                  <Field label="ZIP" required>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      pattern="\d{5}"
                      maxLength={5}
                      autoComplete="postal-code"
                      value={zip}
                      onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
                      className="text-input"
                    />
                  </Field>
                </div>

                <Field label="Site notes" hint="Truck access, gate codes, where to dump.">
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                    className="text-input resize-none"
                  />
                </Field>

                {props.deliveryWindow && DELIVERY_WINDOW_LABEL[props.deliveryWindow] && (
                  <div className="flex items-center gap-2 text-sm text-[var(--commerce-ink-2)] pt-1">
                    <Check className="w-4 h-4 text-[var(--commerce-trust)]" strokeWidth={3} />
                    <span>
                      Delivery window: <strong>{DELIVERY_WINDOW_LABEL[props.deliveryWindow]}</strong>
                      {' · '}
                      <Link
                        href="/material-match"
                        className="text-[var(--commerce-trust)] hover:text-[var(--commerce-trust)] underline underline-offset-2 transition-colors"
                      >
                        change
                      </Link>
                    </span>
                  </div>
                )}
              </div>
            </article>

            {/* CARD 2: Contact */}
            <article className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-7 h-7 rounded-full bg-[var(--commerce-trust)] text-white text-sm font-semibold flex items-center justify-center">
                  2
                </span>
                <h2
                  className="text-2xl text-[var(--commerce-ink)] font-medium tracking-[-0.015em]"
                  style={{ fontFamily: FRAUNCES }}
                >
                  Your contact details
                </h2>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="First name" required>
                    <input
                      type="text"
                      required
                      autoComplete="given-name"
                      value={first_name}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="text-input"
                    />
                  </Field>
                  <Field label="Last name" required>
                    <input
                      type="text"
                      required
                      autoComplete="family-name"
                      value={last_name}
                      onChange={(e) => setLastName(e.target.value)}
                      className="text-input"
                    />
                  </Field>
                </div>
                <Field label="Email" required>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    readOnly={!props.isGuest && !!props.userEmail}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`text-input ${!props.isGuest && !!props.userEmail ? 'bg-[#fafafa] cursor-not-allowed' : ''}`}
                  />
                </Field>
                <Field label="Phone" required hint="We text driver-on-the-way + delivery photo.">
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 555-1234"
                    className="text-input"
                  />
                </Field>
              </div>
            </article>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Right column — summary (sticky on desktop) */}
          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-6 md:p-7">
              <h2
                className="text-xl text-[var(--commerce-ink)] font-medium tracking-[-0.015em] mb-5"
                style={{ fontFamily: FRAUNCES }}
              >
                Order summary
              </h2>

              {/* Material line */}
              <div className="pb-5 border-b border-[rgba(0,0,0,0.08)]">
                <div className="flex justify-between gap-4 mb-1">
                  <span className="text-[15px] font-semibold text-[var(--commerce-ink)]">{props.materialName}</span>
                  <span className="text-[15px] font-medium text-[var(--commerce-ink)] font-mono">{fmt(props.subtotalCents)}</span>
                </div>
                <div className="text-xs text-[var(--commerce-ink-3)] font-mono">
                  {props.tons} tons × {fmt(props.pricePerTonCents)}/ton
                </div>
              </div>

              {/* Subtotals */}
              <dl className="py-5 space-y-2.5 text-[14px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--commerce-ink-3)]">Subtotal</dt>
                  <dd className="text-[var(--commerce-ink)] font-mono">{fmt(props.subtotalCents)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--commerce-ink-3)]">Delivery</dt>
                  <dd className="text-[var(--commerce-ink)] font-mono">{fmt(props.deliveryFeeCents)}</dd>
                </div>
              </dl>

              {/* WELCOME5 isolation row when eligible */}
              {props.welcome5Eligible && props.welcome5DiscountCents > 0 && (
                <div className="py-3 px-4 -mx-1 mb-1 bg-[#f0f7f3] border border-[var(--commerce-trust)]/20 rounded-lg flex justify-between items-center gap-4">
                  <div>
                    <div className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--commerce-trust)]">
                      WELCOME5 applied
                    </div>
                    <div className="text-[11px] text-[var(--commerce-ink-2)] mt-0.5">5% off your first order</div>
                  </div>
                  <span className="text-[15px] font-medium text-[var(--commerce-trust)] font-mono">
                    −{fmt(props.welcome5DiscountCents)}
                  </span>
                </div>
              )}

              {/* Total */}
              <div className="pt-5 border-t border-[rgba(0,0,0,0.08)] flex justify-between items-baseline gap-4 mb-5">
                <span className="text-[15px] font-semibold text-[var(--commerce-ink)]">Total</span>
                <span
                  className="text-2xl font-medium text-[var(--commerce-ink)]"
                  style={{ fontFamily: FRAUNCES }}
                >
                  {fmt(props.finalTotalCents)}
                </span>
              </div>

              {/* CTA */}
              <button
                type="submit"
                disabled={pending}
                className="w-full inline-flex items-center justify-center bg-[var(--commerce-trust)] hover:bg-[var(--commerce-trust)] disabled:bg-[var(--commerce-trust)]/60 text-white font-semibold text-base h-14 rounded-xl transition-colors"
                style={{ fontFamily: FRAUNCES }}
              >
                {pending ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <>Continue to payment <ArrowRight className="ml-2 w-5 h-5" strokeWidth={2.5} /></>
                )}
              </button>

              <p className="text-[11px] text-[var(--commerce-ink-3)] text-center mt-3 leading-relaxed">
                Secure payment via Stripe. Card details collected on the next screen.
              </p>
            </div>
          </aside>
        </form>
      </div>

      <style>{`
        .text-input {
          display: block;
          width: 100%;
          height: 44px;
          padding: 0 12px;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 8px;
          color: var(--commerce-ink);
          font-size: 14px;
          transition: border-color 120ms;
        }
        textarea.text-input { height: auto; padding: 10px 12px; line-height: 1.5; }
        .text-input::placeholder { color: #9ca3af; }
        .text-input:focus { outline: none; border-color: var(--commerce-trust); box-shadow: 0 0 0 3px rgba(10,110,63,0.1); }
      `}</style>
    </main>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[var(--commerce-ink)] mb-1.5 block">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-[var(--commerce-ink-3)] mt-1 block">{hint}</span>}
    </label>
  )
}
