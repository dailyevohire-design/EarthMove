'use client'

import { useEffect, useState } from 'react'

const routes = [
  { y: [38, 168] as [number, number], s: [305, 38] as [number, number], col: '#E4734A', spd: 0.0026, ph: 0 },
  { y: [60, 110] as [number, number], s: [240, 165] as [number, number], col: '#6BBF85', spd: 0.002, ph: 0.3 },
  { y: [112, 60] as [number, number], s: [285, 132] as [number, number], col: '#E4734A', spd: 0.0018, ph: 0.6 },
  { y: [80, 188] as [number, number], s: [220, 78] as [number, number], col: '#6BBF85', spd: 0.0022, ph: 0.85 },
]

export function RouteMap() {
  const [t, setT] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setT((x) => (x + 1) % 1000), 60)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="v3-tele-map">
      <svg viewBox="0 0 320 200" preserveAspectRatio="none">
        <defs>
          <pattern id="rm-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="rm-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(228,115,74,0.4)" />
            <stop offset="100%" stopColor="rgba(228,115,74,0)" />
          </radialGradient>
        </defs>
        <rect width="320" height="200" fill="url(#rm-grid)" />

        <circle cx="160" cy="100" r="78" fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
        <circle cx="160" cy="100" r="50" fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />

        {routes.map((r, i) => (
          <g key={'y' + i}>
            <circle cx={r.y[0]} cy={r.y[1]} r="9" fill="url(#rm-halo)" />
            <circle cx={r.y[0]} cy={r.y[1]} r="3.5" fill="#6BBF85" />
            <text className="node-lbl" x={r.y[0] + 7} y={r.y[1] + 3}>YARD-{20 + i}</text>
          </g>
        ))}

        {routes.map((r, i) => (
          <g key={'s' + i}>
            <rect x={r.s[0] - 3} y={r.s[1] - 3} width="6" height="6" fill="#E4734A" opacity="0.9" />
            <text className="node-lbl" x={r.s[0] - 28} y={r.s[1] - 6}>SITE-{(0xA + i).toString(16).toUpperCase()}</text>
          </g>
        ))}

        {routes.map((r, i) => {
          const cx = (r.y[0] + r.s[0]) / 2
          const cy = Math.min(r.y[1], r.s[1]) - 18
          return (
            <path
              key={'r' + i}
              d={`M ${r.y[0]} ${r.y[1]} Q ${cx} ${cy} ${r.s[0]} ${r.s[1]}`}
              stroke={r.col === '#6BBF85' ? 'rgba(107,191,133,0.18)' : 'rgba(228,115,74,0.18)'}
              strokeWidth="1"
              fill="none"
              strokeDasharray="2 3"
            />
          )
        })}

        {routes.map((r, i) => {
          const p = ((t * r.spd + r.ph) % 1)
          const cx = (r.y[0] + r.s[0]) / 2
          const cy = Math.min(r.y[1], r.s[1]) - 18
          const x = (1 - p) * (1 - p) * r.y[0] + 2 * (1 - p) * p * cx + p * p * r.s[0]
          const y = (1 - p) * (1 - p) * r.y[1] + 2 * (1 - p) * p * cy + p * p * r.s[1]
          return (
            <g key={'t' + i}>
              <circle cx={x} cy={y} r="6" fill={r.col} opacity="0.18" />
              <circle cx={x} cy={y} r="2.6" fill={r.col} />
            </g>
          )
        })}

        <path
          d={`M ${routes[0].y[0]} ${routes[0].y[1]} Q ${(routes[0].y[0] + routes[0].s[0]) / 2} ${Math.min(routes[0].y[1], routes[0].s[1]) - 18} ${routes[0].s[0]} ${routes[0].s[1]}`}
          stroke="rgba(228,115,74,0.6)"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
      <div className="scan" />
    </div>
  )
}
