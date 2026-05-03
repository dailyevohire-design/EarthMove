'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'

const DEPTHS = [
  { value: 2,  label: '2″' },
  { value: 4,  label: '4″' },
  { value: 6,  label: '6″' },
  { value: 9,  label: '9″' },
  { value: 12, label: '12″' },
  { value: 18, label: '18″' },
  { value: 24, label: '24″' },
  { value: 36, label: '36″' },
  { value: 48, label: '48″' },
  { value: 60, label: '60″' },
] as const

type TruckKey = 'small' | 'standard' | 'triaxle' | 'enddump' | ''

const TRUCKS: { key: Exclude<TruckKey, ''>; label: string; tons: number; yards: number; image: string }[] = [
  { key: 'small',    label: 'Small · 5t',     tons: 5,  yards: 3.5, image: '/assets/trucks/dump-trailer.png' },
  { key: 'standard', label: 'Standard · 12t', tons: 12, yards: 10,  image: '/assets/trucks/tandem.png' },
  { key: 'triaxle',  label: 'Tri-axle · 18t', tons: 18, yards: 15,  image: '/assets/trucks/triaxle.png' },
  { key: 'enddump',  label: 'End-dump · 24t', tons: 24, yards: 20,  image: '/assets/trucks/end-dump.png' },
]

function autoPickKey(tons: number): Exclude<TruckKey, ''> | '' {
  if (tons === 0)  return ''
  if (tons <= 5)   return 'small'
  if (tons <= 12)  return 'standard'
  if (tons <= 18)  return 'triaxle'
  return 'enddump'
}

function truckMessage(key: Exclude<TruckKey, ''>, loads: number): ReactNode {
  const isOne = loads === 1
  switch (key) {
    case 'small':
      return isOne
        ? <>That&apos;s a <strong>small dump</strong>. 1 load, fits any driveway.</>
        : <>That&apos;s a <strong>small dump</strong> — {loads} loads. Tight access OK, narrow gates fine.</>
    case 'standard':
      return isOne
        ? <>That&apos;s a <strong>standard dump</strong>. 1 load, residential and small commercial fit.</>
        : <>That&apos;s a <strong>standard dump</strong> — {loads} loads. Needs a 14 ft gate.</>
    case 'triaxle':
      return isOne
        ? <>That&apos;s a <strong>tri-axle</strong>. 1 load, sized for large fills and pad prep.</>
        : <>That&apos;s a <strong>tri-axle</strong> — {loads} loads. 14 ft gate, 22 ft overhead clearance.</>
    case 'enddump':
      return isOne
        ? <>That&apos;s an <strong>end-dump</strong>. 1 load, open-site delivery only.</>
        : <>That&apos;s an <strong>end-dump</strong> — {loads} loads. Open lot, ~50 ft turning, 25 ft overhead.</>
  }
}

export function CoverageCalculator() {
  const [L, setL] = useState<number | ''>('')
  const [W, setW] = useState<number | ''>('')
  const [Din, setDin] = useState(4)
  const [selectedTruck, setSelectedTruck] = useState<Exclude<TruckKey, ''> | null>(null)

  const numL = typeof L === 'number' ? Math.max(0, L) : 0
  const numW = typeof W === 'number' ? Math.max(0, W) : 0
  const hasArea = numL > 0 && numW > 0
  const vol = hasArea ? numL * numW * (Din / 12) : 0
  const cu = vol / 27
  const tons = Math.max(0, Math.ceil(cu * 1.4))

  const autoKey = autoPickKey(tons)
  const effectiveKey = selectedTruck ?? (autoKey || null)
  const effectiveTruck = effectiveKey ? TRUCKS.find(t => t.key === effectiveKey) : null
  const loads = effectiveTruck ? Math.max(1, Math.ceil(tons / effectiveTruck.tons)) : 0
  const isLargeJob = tons > 100

  // SVG diagram geometry — matches v6's recompute() block exactly.
  const padX = 80
  const padY = 60
  const maxW = 240
  const maxH = 80
  const diagL = numL || 20
  const diagW = numW || 10
  let rw = maxW
  let rh = diagL > 0 && diagW > 0 ? rw / (diagL / diagW) : maxH
  if (rh > maxH) { rh = maxH; rw = rh * (diagL / diagW) }
  const x = padX + (maxW - rw) / 2
  const y = padY + (maxH - rh) / 2

  function handleQuoteClick() {
    if (typeof window === 'undefined' || !effectiveKey) return
    const url = new URL(window.location.href)
    url.searchParams.set('truck', effectiveKey)
    window.history.replaceState({}, '', url)
  }

  return (
    <div className="calc-grid">
      <div className="card" style={{ padding: 24 }}>
        <div className="display" style={{ fontSize: 22 }}>Coverage calculator</div>
        <p className="ink-3" style={{ fontSize: 13.5, marginTop: 4 }}>Enter your area. We size the load and pick the truck.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 20 }}>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Length (ft)</span>
            <input id="lenIn" type="number" min={1} step={1} value={L} placeholder="Length (ft)" className="input" style={{ width: '100%', height: 44, padding: '0 12px' }}
              onChange={e => {
                const v = e.target.value
                if (v === '') { setL(''); return }
                const n = parseFloat(v)
                setL(Number.isFinite(n) ? Math.max(0, n) : '')
              }} />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Width (ft)</span>
            <input id="widIn" type="number" min={1} step={1} value={W} placeholder="Width (ft)" className="input" style={{ width: '100%', height: 44, padding: '0 12px' }}
              onChange={e => {
                const v = e.target.value
                if (v === '') { setW(''); return }
                const n = parseFloat(v)
                setW(Number.isFinite(n) ? Math.max(0, n) : '')
              }} />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Depth</span>
            <select id="depIn" className="input" style={{ width: '100%', height: 44, padding: '0 12px' }}
              value={Din} onChange={e => setDin(parseFloat(e.target.value))}>
              {DEPTHS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
        </div>
        <div className="canvas" style={{ marginTop: 24, aspectRatio: '16 / 8' }}>
          <svg viewBox="0 0 400 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
            <rect id="areaRect" x={x} y={y} width={rw} height={rh} fill="#B8472A" fillOpacity={0.20} stroke="#B8472A" strokeWidth={1.5} />
            <line id="lLine" x1={x} y1={y + rh + 15} x2={x + rw} y2={y + rh + 15} stroke="#0F1411" strokeWidth={1} />
            <line x1={x} y1={y + rh + 11} x2={x} y2={y + rh + 19} stroke="#0F1411" strokeWidth={1} />
            <line x1={x + rw} y1={y + rh + 11} x2={x + rw} y2={y + rh + 19} stroke="#0F1411" strokeWidth={1} />
            <text id="lLabel" x={x + rw / 2} y={y + rh + 32} textAnchor="middle" fontFamily="Geist, sans-serif" fontSize={12} fill="#4A524C">L = {diagL} ft</text>
            <line id="wLine" x1={x + rw + 25} y1={y} x2={x + rw + 25} y2={y + rh} stroke="#0F1411" strokeWidth={1} />
            <line x1={x + rw + 21} y1={y} x2={x + rw + 29} y2={y} stroke="#0F1411" strokeWidth={1} />
            <line x1={x + rw + 21} y1={y + rh} x2={x + rw + 29} y2={y + rh} stroke="#0F1411" strokeWidth={1} />
            <text id="wLabel" x={x + rw + 36} y={y + rh / 2 + 4} fontFamily="Geist, sans-serif" fontSize={12} fill="#4A524C">W = {diagW} ft</text>
            <text id="depthLabel" x={x + rw / 2} y={y + rh / 2 + 5} textAnchor="middle" fontFamily="Bricolage Grotesque, serif" fontSize={14} fill="#0F1411" fontWeight={600}>{Din}″ deep</text>
          </svg>
        </div>
      </div>

      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Estimate</div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span id="calcTons" className="num" style={{ fontSize: 88, lineHeight: 0.9 }}>{tons}</span>
              <span className="ink-2" style={{ fontSize: 22 }}>tons</span>
            </div>
            <p id="calcMsg" className="ink-2" style={{ fontSize: 14.5, marginTop: 8, maxWidth: 420 }}>
              {tons === 0 && 'Enter your area to see an estimate.'}
              {tons > 0 && isLargeJob && <>This is a fleet job. Talk to dispatch for volume rates.</>}
              {tons > 0 && !isLargeJob && effectiveKey && truckMessage(effectiveKey, loads)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loads</div>
            <div className="num" style={{ fontSize: 36, lineHeight: 1, marginTop: 4 }}><span id="calcLoads">{loads}</span></div>
          </div>
        </div>

        {isLargeJob ? (
          <div className="calc-large-job" style={{ marginTop: 24, padding: 20, border: '1px solid var(--em-evergreen, #0E2A22)', borderRadius: 12, background: 'rgba(14,42,34,0.04)' }}>
            <div style={{ fontSize: 13, color: 'var(--em-evergreen, #0E2A22)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Large Job</div>
            <p style={{ fontSize: 15, color: 'var(--ink)', margin: 0 }}>
              This is a fleet job. We&apos;ll route it through dispatch — talk to us for volume rates.
            </p>
            <Link href="/contact" className="btn btn-primary" style={{ marginTop: 14, height: 44, padding: '0 16px', fontSize: 14, display: 'inline-flex', alignItems: 'center' }}>
              Contact dispatch
            </Link>
          </div>
        ) : (
          <div id="truckRec" className="calc-truck-grid">
            {TRUCKS.map(t => {
              const isOn = effectiveKey === t.key && tons > 0
              return (
                <button
                  key={t.key}
                  type="button"
                  data-truck={t.key}
                  onClick={() => setSelectedTruck(t.key)}
                  className={`truck-card${isOn ? ' on' : ''}`}
                  style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
                  aria-pressed={isOn}
                >
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t.label}</div>
                  <div style={{ marginTop: 8, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src={t.image} alt="" width={1280} height={520} sizes="(min-width: 768px) 160px, 45vw" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Volume</div>
            <div className="num" style={{ fontSize: 20, marginTop: 2 }}><span id="calcVol">{vol.toFixed(1)}</span> ft³</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Cubic yards</div>
            <div className="num" style={{ fontSize: 20, marginTop: 2 }}><span id="calcCu">{cu.toFixed(1)}</span> yd³</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Density</div>
            <div className="num" style={{ fontSize: 20, marginTop: 2 }}>×1.4</div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <a
            href={effectiveKey ? `?truck=${effectiveKey}#zipForm` : '#zipForm'}
            className="btn btn-primary"
            style={{ height: 44, padding: '0 20px', fontSize: 14.5 }}
            onClick={handleQuoteClick}
          >
            Quote this load
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
            </svg>
          </a>
          <button id="resetCalc" type="button" className="btn btn-outline" style={{ height: 44, padding: '0 16px', fontSize: 14.5 }}
            onClick={() => { setL(''); setW(''); setDin(4); setSelectedTruck(null) }}>Reset</button>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)', marginLeft: 'auto' }}>Final tonnage confirmed at quote.</span>
        </div>
      </div>
    </div>
  )
}
