'use client'

import { useState } from 'react'

const DEPTHS = [
  { value: 2,  label: '2″' },
  { value: 4,  label: '4″' },
  { value: 6,  label: '6″' },
  { value: 8,  label: '8″' },
  { value: 12, label: '12″' },
] as const

type TruckKey = 'small' | 'standard' | 'triaxle' | ''

function pickTruck(tons: number): { key: TruckKey; label: string; loads: number; note: string } {
  if (tons === 0)      return { key: '',         label: '—',              loads: 0, note: 'Enter your area to see an estimate.' }
  if (tons <= 5)       return { key: 'small',    label: 'small dump',     loads: 1, note: 'One load, same-day if ordered before 10 AM.' }
  if (tons <= 14)      return { key: 'standard', label: 'standard dump',  loads: 1, note: 'One load, scheduled to your window.' }
  if (tons <= 25)      return { key: 'triaxle',  label: 'tri-axle',       loads: 1, note: 'One load, scheduled to your window.' }
  const loads = Math.ceil(tons / 25)
  return { key: 'triaxle', label: 'tri-axle', loads, note: `Split across ${loads} tri-axle loads.` }
}

export function CoverageCalculator() {
  const [L, setL] = useState(20)
  const [W, setW] = useState(10)
  const [Din, setDin] = useState(4)

  const vol = Math.max(0, L) * Math.max(0, W) * (Din / 12)
  const cu = vol / 27
  const tons = Math.max(0, Math.ceil(cu * 1.4))
  const truck = pickTruck(tons)

  // SVG diagram geometry — matches v6's recompute() block exactly.
  const padX = 80
  const padY = 60
  const maxW = 240
  const maxH = 80
  let rw = maxW
  let rh = L > 0 && W > 0 ? rw / (L / W) : maxH
  if (rh > maxH) { rh = maxH; rw = rh * (L / W) }
  const x = padX + (maxW - rw) / 2
  const y = padY + (maxH - rh) / 2

  return (
    <div className="calc-grid">
      <div className="card" style={{ padding: 24 }}>
        <div className="display" style={{ fontSize: 22 }}>Coverage calculator</div>
        <p className="ink-3" style={{ fontSize: 13.5, marginTop: 4 }}>Enter your area. We size the load and pick the truck.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 20 }}>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Length (ft)</span>
            <input id="lenIn" type="number" min={1} step={1} value={L} className="input" style={{ width: '100%', height: 44, padding: '0 12px' }}
              onChange={e => setL(Math.max(0, parseFloat(e.target.value) || 0))} />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Width (ft)</span>
            <input id="widIn" type="number" min={1} step={1} value={W} className="input" style={{ width: '100%', height: 44, padding: '0 12px' }}
              onChange={e => setW(Math.max(0, parseFloat(e.target.value) || 0))} />
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
            <text id="lLabel" x={x + rw / 2} y={y + rh + 32} textAnchor="middle" fontFamily="Geist, sans-serif" fontSize={12} fill="#4A524C">L = {L} ft</text>
            <line id="wLine" x1={x + rw + 25} y1={y} x2={x + rw + 25} y2={y + rh} stroke="#0F1411" strokeWidth={1} />
            <line x1={x + rw + 21} y1={y} x2={x + rw + 29} y2={y} stroke="#0F1411" strokeWidth={1} />
            <line x1={x + rw + 21} y1={y + rh} x2={x + rw + 29} y2={y + rh} stroke="#0F1411" strokeWidth={1} />
            <text id="wLabel" x={x + rw + 36} y={y + rh / 2 + 4} fontFamily="Geist, sans-serif" fontSize={12} fill="#4A524C">W = {W} ft</text>
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
              {tons === 0 ? (
                'Enter your area to see an estimate.'
              ) : (
                <>That's a <span className="ink" style={{ fontWeight: 500 }}>{truck.label}</span>. {truck.note}</>
              )}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loads</div>
            <div className="num" style={{ fontSize: 36, lineHeight: 1, marginTop: 4 }}><span id="calcLoads">{truck.loads}</span></div>
          </div>
        </div>

        <div id="truckRec" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div data-truck="small" className={`truck-card${truck.key === 'small' && tons > 0 ? ' on' : ''}`}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Small · 5t</div>
            <svg viewBox="0 0 200 60" style={{ marginTop: 8, width: '100%' }}>
              <path d="M58 28 L130 28 L138 48 L48 48 Z" fill="#0F1411" />
              <path d="M62 28 Q 95 14 128 28" fill="#B8472A" />
              <path d="M130 28 L160 28 L160 48 L138 48 Z" fill="#0F1411" />
              <circle cx={70} cy={50} r={6} fill="#0F1411" />
              <circle cx={125} cy={50} r={6} fill="#0F1411" />
              <circle cx={150} cy={50} r={6} fill="#0F1411" />
            </svg>
          </div>
          <div data-truck="standard" className={`truck-card${truck.key === 'standard' && tons > 0 ? ' on' : ''}`}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Standard · 14t</div>
            <svg viewBox="0 0 240 60" style={{ marginTop: 8, width: '100%' }}>
              <path d="M40 22 L160 22 L172 48 L30 48 Z" fill="#0F1411" />
              <path d="M48 22 Q 100 8 158 22" fill="#B8472A" />
              <path d="M160 22 L200 22 L200 48 L172 48 Z" fill="#0F1411" />
              <circle cx={55} cy={50} r={7} fill="#0F1411" />
              <circle cx={115} cy={50} r={7} fill="#0F1411" />
              <circle cx={140} cy={50} r={7} fill="#0F1411" />
              <circle cx={190} cy={50} r={7} fill="#0F1411" />
            </svg>
          </div>
          <div data-truck="triaxle" className={`truck-card${truck.key === 'triaxle' && tons > 0 ? ' on' : ''}`}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Tri-axle · 25t</div>
            <svg viewBox="0 0 280 60" style={{ marginTop: 8, width: '100%' }}>
              <path d="M28 18 L185 18 L200 48 L20 48 Z" fill="#0F1411" />
              <path d="M36 18 Q 110 4 182 18" fill="#B8472A" />
              <path d="M185 18 L240 18 L240 48 L200 48 Z" fill="#0F1411" />
              <circle cx={48} cy={50} r={8} fill="#0F1411" />
              <circle cx={115} cy={50} r={8} fill="#0F1411" />
              <circle cx={140} cy={50} r={8} fill="#0F1411" />
              <circle cx={165} cy={50} r={8} fill="#0F1411" />
              <circle cx={225} cy={50} r={8} fill="#0F1411" />
            </svg>
          </div>
        </div>

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
          <a href="#zipForm" className="btn btn-primary" style={{ height: 44, padding: '0 20px', fontSize: 14.5 }}>
            Quote this load
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
            </svg>
          </a>
          <button id="resetCalc" type="button" className="btn btn-outline" style={{ height: 44, padding: '0 16px', fontSize: 14.5 }}
            onClick={() => { setL(20); setW(10); setDin(4) }}>Reset</button>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)', marginLeft: 'auto' }}>Final tonnage confirmed at quote.</span>
        </div>
      </div>
    </div>
  )
}
