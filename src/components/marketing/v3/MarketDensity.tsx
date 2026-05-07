'use client'

import { useEffect, useState } from 'react'

interface Metro {
  id: string
  name: string
  x: number
  y: number
  yards: number
  status: 'live' | 'staging' | 'queued'
  core: 0 | 1
}

interface Corridor {
  from: number
  to: number
  intensity: number
}

const METROS: Metro[] = [
  { id: 'DEN', name: 'DENVER', x: 130, y: 96, yards: 0, status: 'live', core: 1 },
  { id: 'DFW', name: 'DFW', x: 198, y: 154, yards: 0, status: 'live', core: 1 },
  { id: 'PDX', name: 'PORTLAND', x: 60, y: 50, yards: 0, status: 'staging', core: 0 },
  { id: 'HOU', name: 'HOUSTON', x: 268, y: 178, yards: 0, status: 'queued', core: 0 },
  { id: 'AUS', name: 'AUSTIN', x: 158, y: 188, yards: 0, status: 'queued', core: 0 },
]

const CORRIDORS: Corridor[] = [
  { from: 0, to: 1, intensity: 0.9 },
  { from: 0, to: 2, intensity: 0.4 },
  { from: 1, to: 3, intensity: 0.5 },
  { from: 1, to: 4, intensity: 0.3 },
]

// Local "trucks" — each lit city spawns these as small green dots that
// drift out from the pin and return, simulating live deliveries within
// the city's coverage area. Different angles/radii/phase offsets so
// they don't move in lockstep.
const LOCAL_TRUCKS = [
  { angle: 0.5, radius: 12, phaseOff: 0.0 },
  { angle: 2.3, radius: 9, phaseOff: 0.27 },
  { angle: 4.0, radius: 13, phaseOff: 0.54 },
  { angle: 5.7, radius: 10, phaseOff: 0.81 },
]

export function MarketDensity({ denverYards, dfwYards }: { denverYards: number; dfwYards: number }) {
  const [t, setT] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 80)
    return () => clearInterval(id)
  }, [])

  const metros = METROS.map((m) =>
    m.id === 'DEN' ? { ...m, yards: denverYards } : m.id === 'DFW' ? { ...m, yards: dfwYards } : m,
  )
  const totalLiveYards = denverYards + dfwYards

  return (
    <section className="v3-md">
      <div className="v3-md-head">
        <div className="v3-md-l">
          <span className="dot" /> Network coverage · Launch
        </div>
        <div className="v3-md-r">{totalLiveYards} YARDS · LIVE</div>
      </div>

      <div className="v3-md-map">
        <svg viewBox="0 0 320 200" preserveAspectRatio="none">
          <defs>
            <pattern id="md-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="md-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(228,115,74,0.5)" />
              <stop offset="60%" stopColor="rgba(228,115,74,0.12)" />
              <stop offset="100%" stopColor="rgba(228,115,74,0)" />
            </radialGradient>
            <radialGradient id="md-queued" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          <rect width="320" height="200" fill="url(#md-grid)" />

          <path
            d="M 30 50 Q 60 40 100 45 L 150 50 Q 200 55 250 60 L 290 70 L 285 130 Q 280 165 240 175 L 180 180 Q 130 175 90 170 L 50 160 Q 30 130 28 95 Z"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.7"
          />

          {CORRIDORS.map((c, i) => {
            const a = metros[c.from]
            const b = metros[c.to]
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={c.intensity > 0.7 ? 'rgba(228,115,74,0.25)' : 'rgba(255,255,255,0.10)'}
                strokeWidth={c.intensity > 0.7 ? 1.2 : 0.8}
                strokeDasharray={c.intensity > 0.7 ? '' : '2 4'}
              />
            )
          })}

          {/* Local trucks — drift out from each lit city and back, like live deliveries */}
          {metros.filter((m) => m.core).flatMap((m) =>
            LOCAL_TRUCKS.map((tk, i) => {
              const cityOffset = m.id === 'DEN' ? 0 : 0.13
              const p = ((t * 0.008) + tk.phaseOff + cityOffset) % 1
              const f = Math.sin(p * Math.PI) // 0 -> 1 -> 0 over phase 0..1
              const cx = m.x + Math.cos(tk.angle) * tk.radius * f
              const cy = m.y + Math.sin(tk.angle) * tk.radius * f
              return (
                <g key={`${m.id}-tk-${i}`}>
                  <circle cx={cx} cy={cy} r={3} fill="#6BBF85" opacity={0.18} />
                  <circle cx={cx} cy={cy} r={1.4} fill="#6BBF85" />
                </g>
              )
            })
          )}

          {metros.map((m) => (
            <g key={m.id}>
              <circle cx={m.x} cy={m.y} r={m.core ? 22 : 14} fill={m.core ? 'url(#md-core)' : 'url(#md-queued)'} />
              {m.core ? (
                <circle cx={m.x} cy={m.y} r="14" fill="none" stroke="rgba(228,115,74,0.3)" strokeDasharray="2 3">
                  <animate attributeName="r" values="14;20;14" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
                </circle>
              ) : null}
              <circle cx={m.x} cy={m.y} r={m.core ? 4 : 2.5} fill={m.core ? '#E4734A' : 'rgba(255,255,255,0.5)'} />
            </g>
          ))}
        </svg>
        {/* HTML overlay so labels render crisp regardless of SVG preserveAspectRatio="none" */}
        <div className="md-labels">
          {metros.map((m) => {
            const left = (m.x / 320) * 100
            const labelTop = ((m.y + (m.core ? -10 : -7)) / 200) * 100
            const yardsTop = ((m.y + 16) / 200) * 100
            return (
              <div key={m.id}>
                <div className="md-lbl" style={{ left: `${left}%`, top: `${labelTop}%` }}>{m.name}</div>
                {m.core && m.yards > 0 ? (
                  <div className="md-yd" style={{ left: `${left}%`, top: `${yardsTop}%` }}>{m.yards} YARDS</div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <div className="v3-md-legend">
        <div className="v3-md-row">
          <span className="md-pip live" />
          <span className="md-rk">DEN-METRO</span>
          <span className="md-rv">{denverYards} yards · launching today</span>
        </div>
        <div className="v3-md-row">
          <span className="md-pip live" />
          <span className="md-rk">DFW</span>
          <span className="md-rv">{dfwYards} yards · launching today</span>
        </div>
        <div className="v3-md-row queued">
          <span className="md-pip stage" />
          <span className="md-rk">PORTLAND</span>
          <span className="md-rv">Expansion · staging</span>
        </div>
        <div className="v3-md-row queued">
          <span className="md-pip queue" />
          <span className="md-rk">HOU · AUS</span>
          <span className="md-rv">Pipeline · 2026</span>
        </div>
      </div>
    </section>
  )
}
