'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

const SERVICE_REGEXES: ReadonlyArray<RegExp> = [/^80\d{3}$/, /^75\d{3}$/, /^76\d{3}$/]
const inService = (z: string) => SERVICE_REGEXES.some(rx => rx.test(z))

const CheckIcon = ({ size = 13 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const ArrowRightIcon = ({ size = 16, weight = 2.2 }: { size?: number; weight?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m13 5 7 7-7 7" />
  </svg>
)

type ZipResult =
  | { kind: 'invalid' }
  | { kind: 'in-service'; zip: string }
  | { kind: 'out-of-service'; zip: string; notified: boolean }

export function HeroLeftColumn() {
  const [zip, setZip] = useState('')
  const [result, setResult] = useState<ZipResult | null>(null)

  function handleZipSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const z = zip.trim()
    if (!/^\d{5}$/.test(z)) {
      setResult({ kind: 'invalid' })
      return
    }
    setResult(inService(z) ? { kind: 'in-service', zip: z } : { kind: 'out-of-service', zip: z, notified: false })
  }

  function notifyMe(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (result?.kind === 'out-of-service') setResult({ ...result, notified: true })
  }

  return (
    <div>
      <h1 className="hv-h1" id="headline">
        <span className="hv-h1-lead">We move <em>earth</em>.</span>
        <span className="hv-h1-coda">All of it.</span>
      </h1>

      <p className="hv-sub" id="subhead">
        The smartest dispatch in the industry. Lower delivered cost than any broker, platform, or phone call — and a truck that actually shows up.
      </p>

      <form id="zipForm" className="hv-rq" onSubmit={handleZipSubmit} noValidate>
        <div className="hv-rq-eyebrow">
          <span className="hv-rq-pip" aria-hidden="true" />
          <span className="hv-rq-eyebrow-lbl">Instant quote · Free · No signup</span>
        </div>
        <h2 className="hv-rq-title">See your delivered price in 3 seconds.</h2>
        <p className="hv-rq-sub">Drop a ZIP. We quote a real load from the closest verified yard — same-day if before 10 AM.</p>

        <div className="hv-rq-form">
          <label className="hv-zip">
            <span className="hv-zip-prefix">Deliver to</span>
            <input
              id="zip"
              name="zip"
              inputMode="numeric"
              maxLength={5}
              pattern="\d{5}"
              autoComplete="postal-code"
              placeholder="ZIP"
              value={zip}
              onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          </label>
          <button type="submit" className="hv-cta" id="ctaBtn">
            <span id="ctaLbl">Get my price</span>
            <ArrowRightIcon />
          </button>
        </div>

        <div className="hv-rq-marks">
          <span className="hv-rq-mk"><CheckIcon /> Real yard pricing</span>
          <span className="hv-rq-mk"><CheckIcon /> Photo-confirmed drop</span>
          <span className="hv-rq-mk"><CheckIcon /> Net-30 for contractors</span>
        </div>

        <div id="zipResult" style={result ? { marginTop: 14 } : { marginTop: 14, display: 'none' }}>
          {result?.kind === 'invalid' && (
            <div className="card" style={{ padding: 14, fontSize: 14, color: 'var(--ink-2)' }}>
              Please enter a valid 5-digit ZIP code.
            </div>
          )}
          {result?.kind === 'in-service' && (
            <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ marginTop: 2, display: 'inline-flex', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--trust-mark-soft)', color: 'var(--trust-mark)' }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <div>
                  <div className="display" style={{ fontSize: 16, color: 'var(--ink)' }}>We deliver to {result.zip}.</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-2)' }}>Same-day if ordered before 10 AM, next day otherwise.</div>
                </div>
              </div>
              <a href={`/order?zip=${result.zip}`} className="btn btn-primary" style={{ height: 40, padding: '0 16px', fontSize: 14, alignSelf: 'flex-start' }}>
                Get instant quote <ArrowRightIcon weight={2} />
              </a>
            </div>
          )}
          {result?.kind === 'out-of-service' && !result.notified && (
            <div className="card" style={{ padding: 18 }}>
              <div className="display" style={{ fontSize: 16, color: 'var(--ink)' }}>We're not in {result.zip} yet.</div>
              <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4 }}>Launching in Denver and Dallas–Fort Worth in 2026 — drop your email and we'll reach out when we're in your market.</div>
              <form id="oosForm" onSubmit={notifyMe} style={{ marginTop: 12, display: 'flex', gap: 8, maxWidth: 480, flexWrap: 'wrap' }}>
                <input required type="email" placeholder="you@email.com" className="input" style={{ flex: 1, minWidth: 200, height: 44, padding: '0 12px', fontSize: 14 }} />
                <button type="submit" className="btn btn-primary" style={{ height: 44, padding: '0 16px', fontSize: 14 }}>Notify me</button>
              </form>
            </div>
          )}
          {result?.kind === 'out-of-service' && result.notified && (
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 12 }}>
              Thanks — we'll be in touch when we're live in {result.zip}.
            </div>
          )}
        </div>
      </form>

      {/* Mobile-only dispatch demo — desktop has full Control Tower in right column */}
      <aside className="hv-mobile-dispatch" aria-label="Sample dispatch demo">
        <div className="hmd-eyebrow">— Sample dispatch · Denver</div>
        <div className="hmd-row">
          <div className="hmd-id">
            <span className="hmd-pip" />
            <span className="hmd-truck">EM-DEMO</span>
          </div>
          <span className="hmd-eta">arriving 11:42</span>
        </div>
        <div className="hmd-ttl">Road Base · 14 tons</div>
        <div className="hmd-status" role="list">
          <span className="hmd-step" role="listitem">Loaded</span>
          <span className="hmd-step hmd-step-active" role="listitem">In transit</span>
          <span className="hmd-step" role="listitem">Drop confirmed</span>
        </div>
        <div className="hmd-photo">
          <span className="hmd-photo-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <rect x="3" y="6" width="18" height="14" rx="2" />
              <circle cx="12" cy="13" r="4" />
              <path d="M8 6V4h8v2" />
            </svg>
          </span>
          <span className="hmd-photo-chip">Photo on delivery</span>
        </div>
      </aside>

      <div className="hv-secondary-links">
        Or{' '}
        <Link href="/browse">browse all materials</Link>
        {' · '}
        <Link href="/material-match">find my material</Link>
        {' · '}
        <Link href="/learn">read project guides</Link>
      </div>

      <section className="trust-band-section">
        <article className="trust-fact-card">
          <div className="trust-fact-eyebrow">LAUNCHING</div>
          <h3 className="trust-fact-title">Denver + Dallas–Fort Worth</h3>
          <p className="trust-fact-supporting">Houston, Austin, Phoenix in 2026 pipeline.</p>
        </article>
        <article className="trust-fact-card">
          <div className="trust-fact-eyebrow">MATERIALS</div>
          <h3 className="trust-fact-title">Base, fill, stone, soil, decorative</h3>
          <p className="trust-fact-supporting">Five families that match what crews actually build with.</p>
        </article>
        <article className="trust-fact-card">
          <div className="trust-fact-eyebrow">EVERY ORDER</div>
          <h3 className="trust-fact-title">Photo + scale ticket</h3>
          <p className="trust-fact-supporting">Attached to your invoice on every load.</p>
        </article>
      </section>
    </div>
  )
}
