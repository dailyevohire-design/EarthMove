'use client'

import { useAudience } from './audience-context'

export function MaterialsCard6() {
  const { audience } = useAudience()
  const isHomeowner = audience === 'homeowner'

  const title = isHomeowner ? 'Not sure what you need?' : 'Custom spec? Send the takeoff.'
  const sub = isHomeowner
    ? "Take the 30-second material quiz on FillDirtNearMe.net. We'll recommend a material and the right amount."
    : 'We match the yard, the gradation, and the truck class. One reply, not a sales tour.'
  const cta = isHomeowner ? 'Continue on FillDirtNearMe' : 'Send a project'
  const href = isHomeowner ? 'https://filldirtnearme.net' : '#zipForm'
  const target = isHomeowner ? '_blank' : undefined
  const rel = isHomeowner ? 'noopener' : undefined

  return (
    <a
      href={href}
      id="card6"
      target={target}
      rel={rel}
      style={{ background: 'var(--brand)', color: '#fff', borderRadius: 18, padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>Need help?</div>
        <div id="card6Title" className="display-tight" style={{ color: '#fff', fontSize: 28, lineHeight: 1.05, marginTop: 12 }}>{title}</div>
        <p id="card6Sub" style={{ color: 'rgba(255,255,255,.9)', fontSize: 14.5, marginTop: 12, maxWidth: 300 }}>{sub}</p>
      </div>
      <div style={{ marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500 }}>
        <span id="card6Cta">{cta}</span>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
        </svg>
      </div>
    </a>
  )
}
