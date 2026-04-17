'use client'

import { useEffect, useRef, useState } from 'react'

export type EarningsDetail = {
  amount: number
  loadLabel?: string      // e.g. "Load 4 delivered"
  tonsActual?: number
  haulMinutes?: number
  onTimePct?: number
  nextLoad?: string
}

export function EarningsMoment() {
  const [active, setActive]   = useState(false)
  const [detail, setDetail]   = useState<EarningsDetail | null>(null)
  const confettiRef           = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onFire(e: Event) {
      const d = (e as CustomEvent<EarningsDetail>).detail
      setDetail(d)
      setActive(true)
      spawnConfetti(confettiRef.current)
      window.setTimeout(() => setActive(false), 3800)
    }
    window.addEventListener('em:earnings', onFire as EventListener)
    return () => window.removeEventListener('em:earnings', onFire as EventListener)
  }, [])

  if (!detail) return null
  return (
    <div className={`em-earn-modal ${active ? 'active' : ''}`} aria-hidden={!active}>
      <svg className="em-earn-modal__topo" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <g stroke="#9AC9AE" strokeWidth="0.6" fill="none">
          <path d="M-20 300 Q 100 240 220 260 T 420 280" />
          <path d="M-20 350 Q 120 290 240 310 T 420 330" />
          <path d="M-20 400 Q 140 340 260 360 T 420 380" />
          <path d="M-20 450 Q 160 390 280 410 T 420 430" />
          <path d="M-20 500 Q 180 440 300 460 T 420 480" />
        </g>
      </svg>
      <div ref={confettiRef} className="em-confetti" />
      <div className="em-earn-modal__check">
        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12 5 5L20 7" />
        </svg>
      </div>
      <div className="em-earn-modal__label">{detail.loadLabel ?? 'Load delivered'}</div>
      <div className="em-earn-modal__amount">
        ${detail.amount.toFixed(2)}
      </div>
      <div className="em-earn-modal__meta">
        {detail.tonsActual != null && <div><strong>{detail.tonsActual.toFixed(2)}t</strong><span>Actual</span></div>}
        {detail.haulMinutes != null && <div><strong>{detail.haulMinutes} min</strong><span>Haul</span></div>}
        {detail.onTimePct != null   && <div><strong>{detail.onTimePct}%</strong><span>On-time</span></div>}
      </div>
      <button className="em-earn-modal__cta" onClick={() => setActive(false)}>
        {detail.nextLoad ? `Next load  ·  ${detail.nextLoad}` : 'Done'}
      </button>
    </div>
  )
}

const CONFETTI = ['#E89318', '#3E8B5E', '#FAF6EC', '#9E5525', '#9AC9AE']

function spawnConfetti(host: HTMLElement | null) {
  if (!host) return
  host.innerHTML = ''
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('i')
    el.style.setProperty('--cx', ((Math.random() - 0.5) * 500) + 'px')
    el.style.setProperty('--cy', ((Math.random() - 0.2) * 600 + 200) + 'px')
    el.style.setProperty('--cr', ((Math.random() - 0.5) * 900) + 'deg')
    el.style.background = CONFETTI[i % CONFETTI.length]
    el.style.left = '50%'
    el.style.top  = '30%'
    el.style.animationDelay = (Math.random() * 0.2) + 's'
    host.appendChild(el)
  }
}
