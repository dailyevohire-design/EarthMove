'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAudience } from './audience-context'

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
  const { audience, setAudience } = useAudience()
  const router = useRouter()
  const [zip, setZip] = useState('')
  const [result, setResult] = useState<ZipResult | null>(null)

  function handleZipSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (audience === 'homeowner') {
      router.push('/material-match')
      return
    }
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
      {/* Status strip — Denver + Dallas–Fort Worth · Launching 2026 */}
      <div className="hv-status">
        <span className="pip" />
        <span className="lbl">Network online</span>
        <span className="rule" />
        <span><span className="y">Denver + Dallas–Fort Worth</span> · Launching 2026</span>
      </div>

      <h1 className="hv-h1" id="headline">
        {audience === 'contractor' ? (
          <>Bulk aggregate,<br />delivered <span className="em">to the hour.</span></>
        ) : (
          <>Homeowners — find <span className="em">your material.</span></>
        )}
      </h1>

      <p className="hv-sub" id="subhead">
        {audience === 'contractor' ? (
          <>Spec-grade base, fill, and stone — quoted from the closest yard, dispatched on your schedule, photo-confirmed at the drop. <b>For contractors</b> who need it on time, and homeowners who need it once.</>
        ) : (
          <>Tell us about your project and we'll match you to the right bulk material. <b>Same yards, same trucks</b> — a simpler flow for one-off jobs.</>
        )}
      </p>

      <form id="zipForm" className="hv-rq" onSubmit={handleZipSubmit} noValidate>
        <div className="hv-rq-top">
          <div className="toggle" role="tablist">
            <button
              id="tab-c"
              type="button"
              className={audience === 'contractor' ? 'active' : ''}
              onClick={() => setAudience('contractor')}
            >Contractor</button>
            <button
              id="tab-h"
              type="button"
              className={audience === 'homeowner' ? 'active' : ''}
              onClick={() => setAudience('homeowner')}
            >Homeowner</button>
          </div>
          <span className="hv-rq-hint">
            <span className="hv-rq-step">01</span>
            <span className="hv-rq-step-sep" />
            Delivery ZIP
          </span>
        </div>
        <div className="hv-rq-form">
          <label className="hv-zip">
            <span className="hv-zip-prefix">ZIP</span>
            <input
              id="zip"
              name="zip"
              inputMode="numeric"
              maxLength={5}
              pattern="\d{5}"
              autoComplete="postal-code"
              placeholder="00000"
              value={zip}
              onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          </label>
          <button type="submit" className="hv-cta" id="ctaBtn">
            <span id="ctaLbl">{audience === 'contractor' ? 'Quote my ZIP' : 'Find my material'}</span>
            <span className="hv-cta-arrow"><ArrowRightIcon /></span>
          </button>
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

      <div className="hv-secondary-links">
        Or{' '}
        <Link href="/browse">browse all materials</Link>
        {' · '}
        <Link href="/material-match">find my material</Link>
        {' · '}
        <Link href="/learn">read project guides</Link>
      </div>

      <div className="hv-marks">
        <span className="mk"><CheckIcon /> Photo-confirmed at drop</span>
        <span className="mk"><CheckIcon /> Net-30 for qualified contractors</span>
        <span className="mk"><CheckIcon /> <b>Yard-verified</b> network</span>
      </div>

      <div className="hv-sig">
        <div className="sig-item">
          <div className="sig-eb">Launching</div>
          <div className="sig-ttl">Denver +<br />Dallas–Fort Worth</div>
          <div className="sig-lbl">More markets in pipeline</div>
        </div>
        <div className="sig-item">
          <div className="sig-eb">Materials</div>
          <div className="sig-ttl">Base, fill,<br />stone, soil</div>
          <div className="sig-lbl">Five outcome families</div>
        </div>
        <div className="sig-item">
          <div className="sig-eb">Every order</div>
          <div className="sig-ttl">Photo<br />+ ticket</div>
          <div className="sig-lbl">Attached to invoice on tip</div>
        </div>
      </div>
    </div>
  )
}
