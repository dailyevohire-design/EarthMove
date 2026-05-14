'use client'

import { useState } from 'react'
import Link from 'next/link'
import { startQuoteAction } from './actions'
import type { Project } from '@/lib/projects'

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

export function Hero({ projects }: { projects: Project[] }) {
  const [path, setPath] = useState<'homeowner' | 'contractor'>('homeowner')
  const [zip, setZip] = useState('')
  const [pick, setPick] = useState<string | null>(null)
  const valid = /^\d{5}$/.test(zip)

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
            <span className={'meta ' + (valid ? 'ok' : '')} aria-live="polite">
              <span className="dot" />
              {valid ? 'CHECKING…' : '5-DIGIT ZIP'}
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
          <button type="submit" className="v3-cta" disabled={!valid}>
            Get delivered price
            <ArrowRight />
          </button>
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
            <a href="sms:+1?body=Earthmove%20dispatch" className="v3-pro-tile">
              <TextIcon />
              <span className="tl">Text dispatch</span>
              <span className="ts">SMS · 24/7 ops</span>
            </a>
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
