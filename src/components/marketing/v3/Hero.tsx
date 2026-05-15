'use client'

import { useState } from 'react'
import Link from 'next/link'
import { startQuoteAction } from './actions'
import type { Project } from '@/lib/projects'

const LIVE_MARKET_PREFIXES = new Set<number>([
  // Denver metro
  ...Array.from({ length: 17 }, (_, i) => 800 + i), // 800-816
  // DFW metro
  ...Array.from({ length: 12 }, (_, i) => 750 + i), // 750-761
])

const NEAREST_MARKET_BY_PREFIX: Record<string, string> = {
  '300': 'Atlanta', '301': 'Atlanta', '302': 'Atlanta', '303': 'Atlanta', '304': 'Atlanta',
  '330': 'Tampa', '331': 'Miami', '335': 'Tampa', '336': 'Tampa', '337': 'Orlando',
  '280': 'Charlotte', '281': 'Charlotte', '282': 'Charlotte',
  '770': 'Houston', '771': 'Houston', '772': 'Houston', '773': 'Houston', '774': 'Houston',
  '787': 'Austin', '786': 'Austin',
  '850': 'Phoenix', '851': 'Phoenix', '852': 'Phoenix', '853': 'Phoenix',
  '891': 'Las Vegas', '890': 'Las Vegas',
  '970': 'Portland', '971': 'Portland', '972': 'Portland',
}

function nearestMarketLabel(zip: string): string {
  const prefix = zip.slice(0, 3)
  return NEAREST_MARKET_BY_PREFIX[prefix] ?? 'your area'
}

function isCoveredZip(zip: string): boolean {
  if (!/^\d{5}$/.test(zip)) return false
  return LIVE_MARKET_PREFIXES.has(Number(zip.slice(0, 3)))
}

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
    <path d="M3 9h12M11 5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TakeoffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M5 3h7l3 3v11H5V3z" stroke="currentColor" strokeWidth="1.4" />
    <path d="M12 3v3h3M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)
const TextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 5h14v9H8l-3 3v-3H3V5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
)
const PriceIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="4" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)
const TrucksIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M2 13V7h10v9H2zM12 9h4l2 3v4H2" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="6" cy="16" r="1.5" fill="currentColor" />
    <circle cx="14" cy="16" r="1.5" fill="currentColor" />
  </svg>
)

const OPS_PHONE = process.env.NEXT_PUBLIC_OPS_PHONE_E164 ?? ''
const SMS_HREF = OPS_PHONE
  ? `sms:${OPS_PHONE}&body=${encodeURIComponent('Earthmove dispatch — [your ZIP] [material] [tons]')}`
  : ''

export function Hero({ projects }: { projects: Project[] }) {
  const [path, setPath] = useState<'homeowner' | 'contractor'>('homeowner')
  const [zip, setZip] = useState('')
  const [pick, setPick] = useState<string | null>(null)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistState, setWaitlistState] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle')
  const valid = /^\d{5}$/.test(zip)
  const covered = isCoveredZip(zip)
  const outOfCoverage = valid && !covered

  async function submitWaitlist(e: React.FormEvent) {
    e.preventDefault()
    if (!waitlistEmail.includes('@')) {
      setWaitlistState('error')
      return
    }
    setWaitlistState('submitting')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail, zip }),
      })
      setWaitlistState(res.ok ? 'sent' : 'error')
    } catch {
      setWaitlistState('error')
    }
  }

  return (
    <section className="v3-hero">
      <div className="v3-hero-l">
        <div className="v3-hero-eyebrow">
          <span className="dot" />
          Live routing · DEN · DFW · Launching today
        </div>

        <h1 className="v3-hero-h">
          Delivered price.<br />
          {' '}<em>In seconds.</em>
        </h1>
        <p className="v3-hero-sub">
          Aggregate routing infrastructure. ZIP, project, or takeoff in — verified yard, truck class, and dispatch sequence out.
        </p>
        <div className="v3-hero-credentials">
          <span className="ck">DOT verified</span>
          <span className="ck">$2M insured</span>
          <span className="ck">Same-day · 10AM cutoff</span>
          <span className="ck">NET-30 · MSA on request</span>
        </div>
      </div>

      <div className="v3-hero-r">
        <div className="v3-path-toggle">
        <button
          type="button"
          aria-pressed={path === 'homeowner'}
          className={path === 'homeowner' ? 'on' : ''}
          onClick={() => setPath('homeowner')}
        >
          <span className="pt-k">01 · FAST PATH</span>
          <span className="pt-l">Homeowner</span>
          <span className="pt-s">ZIP + project</span>
        </button>
        <button
          type="button"
          aria-pressed={path === 'contractor'}
          className={path === 'contractor' ? 'on' : ''}
          onClick={() => setPath('contractor')}
        >
          <span className="pt-k">02 · OPS PATH</span>
          <span className="pt-l">Contractor</span>
          <span className="pt-s">Takeoff · text dispatch</span>
        </button>
      </div>

      {path === 'homeowner' ? (
        <form action={startQuoteAction} className="v3-entry">
          <div className="v3-entry-row">
            <label htmlFor="v3-hero-zip" className="lbl">DELIVER TO</label>
            <input
              id="v3-hero-zip"
              name="zip"
              inputMode="numeric"
              pattern="\d{5}"
              placeholder="ZIP"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              autoComplete="postal-code"
              aria-label="ZIP code for delivery"
            />
            <span className={'meta ' + (covered ? 'ok' : '')} aria-live="polite">
              <span className="dot" />
              {!valid ? '5-DIGIT ZIP' : covered ? 'CHECKING…' : 'OUT OF COVERAGE'}
            </span>
          </div>
          <input type="hidden" name="project" value={pick ?? ''} />
          <div className="v3-entry-chips">
            {projects.slice(0, 5).map((p) => (
              <button
                type="button"
                key={p.slug}
                aria-pressed={pick === p.slug}
                className={'v3-entry-chip' + (pick === p.slug ? ' on' : '')}
                onClick={() => setPick(pick === p.slug ? null : p.slug)}
              >
                {p.name}
              </button>
            ))}
          </div>
          {outOfCoverage ? null : (
            <button type="submit" className="v3-cta" disabled={!covered}>
              Get delivered price
              <ArrowRight />
            </button>
          )}
          {outOfCoverage && (
            <div
              role="alert"
              style={{
                marginTop: 12,
                padding: '14px 16px',
                borderRadius: 8,
                background: 'rgba(229, 112, 27, 0.08)',
                border: '1px solid rgba(229, 112, 27, 0.35)',
                color: '#15201B',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {waitlistState === 'sent' ? (
                <span>
                  Thanks — we&rsquo;ll text you the moment {nearestMarketLabel(zip)} goes live.
                </span>
              ) : (
                <>
                  <div style={{ marginBottom: 10 }}>
                    We don&rsquo;t deliver to {zip} yet. Drop your email and we&rsquo;ll notify you when{' '}
                    {nearestMarketLabel(zip)} launches.
                  </div>
                  <form
                    onSubmit={submitWaitlist}
                    style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
                  >
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      aria-label="Email for waitlist"
                      style={{
                        flex: '1 1 200px',
                        padding: '10px 12px',
                        border: '1px solid #D8D2C4',
                        borderRadius: 6,
                        fontSize: 14,
                        background: '#fff',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={waitlistState === 'submitting'}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 6,
                        background: '#E5701B',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 14,
                        border: 'none',
                        cursor: waitlistState === 'submitting' ? 'wait' : 'pointer',
                      }}
                    >
                      {waitlistState === 'submitting' ? 'Saving…' : 'Notify me'}
                    </button>
                  </form>
                  {waitlistState === 'error' && (
                    <div style={{ marginTop: 8, color: '#B7410E', fontSize: 13 }}>
                      Something went wrong. Try again.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div className="v3-entry-foot">
            <span className="ck">● DOT verified</span>
            <span className="ck">● $2M insured</span>
            <span className="ck">● Same-day · 10AM cutoff</span>
          </div>
        </form>
      ) : (
        <div className="v3-entry-pro">
          <div className="v3-pro-grid">
            <a href="mailto:ops@earthmove.io?subject=Takeoff" className="v3-pro-tile">
              <TakeoffIcon />
              <span className="tl">Send takeoff</span>
              <span className="ts">PDF · plans · CSV</span>
            </a>
            {OPS_PHONE ? (
              <a href={SMS_HREF} className="v3-pro-tile">
                <TextIcon />
                <span className="tl">Text dispatch</span>
                <span className="ts">SMS · 24/7 ops</span>
              </a>
            ) : (
              <div className="v3-pro-tile" aria-disabled="true" style={{ opacity: 0.55, cursor: 'not-allowed' }}>
                <TextIcon />
                <span className="tl">Text dispatch</span>
                <span className="ts">Phone provisioning in progress</span>
              </div>
            )}
            <a href="mailto:ops@earthmove.io?subject=Project%20pricing%20inquiry&body=Project%3A%20%0ALocation%20%2F%20ZIP%3A%20%0AMaterial%20%2B%20gradation%3A%20%0AEstimated%20tonnage%3A%20%0ATarget%20delivery%20window%3A%20" className="v3-pro-tile">
              <PriceIcon />
              <span className="tl">Project pricing</span>
              <span className="ts">Multi-load · PO</span>
            </a>
            <a href="mailto:ops@earthmove.io?subject=Bulk%20%2B%20recurring%20delivery&body=Lane%20%2F%20site%3A%20%0AMaterial%20%2B%20gradation%3A%20%0AFrequency%20%2F%20cadence%3A%20%0ATypical%20load%20size%3A%20%0AStart%20date%3A%20" className="v3-pro-tile">
              <TrucksIcon />
              <span className="tl">Bulk + recurring</span>
              <span className="ts">Lanes · standing</span>
            </a>
          </div>
          <div className="v3-pro-foot">
            <span>NET-30 · MSA on request</span>
            <Link className="lk" href="/order">Open dispatch →</Link>
          </div>
        </div>
      )}
      </div>
    </section>
  )
}
