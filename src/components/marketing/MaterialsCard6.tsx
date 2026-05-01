export function MaterialsCard6() {
  return (
    <a
      href="#zipForm"
      id="card6"
      style={{ background: 'var(--brand)', color: '#fff', borderRadius: 18, padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>Need help?</div>
        <div id="card6Title" className="display-tight" style={{ color: '#fff', fontSize: 28, lineHeight: 1.05, marginTop: 12 }}>Custom spec? Send the takeoff.</div>
        <p id="card6Sub" style={{ color: 'rgba(255,255,255,.9)', fontSize: 14.5, marginTop: 12, maxWidth: 300 }}>We match the yard, the gradation, and the truck class. One reply, not a sales tour.</p>
      </div>
      <div style={{ marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500 }}>
        <span id="card6Cta">Send a project</span>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
        </svg>
      </div>
    </a>
  )
}
