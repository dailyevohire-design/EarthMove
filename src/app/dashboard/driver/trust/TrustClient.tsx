'use client'

import { useState } from 'react'

export default function TrustClient({ checkoutEnabled }: { checkoutEnabled: boolean }) {
  const [q, setQ] = useState('')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    if (!q.trim()) return
    setLoading(true)
    try {
      // Placeholder: reuse the existing GC trust-engine endpoint shape if available.
      const res = await fetch('/api/trust/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      })
      if (res.ok) setReport(await res.json())
      else setReport({ name: q, score: null, error: 'Lookup unavailable' })
    } catch {
      setReport({ name: q, score: null, error: 'Offline' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div style={{ padding: '4px 16px 12px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Trust lookup</div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>
          Check any broker, contractor, or site before you haul.
        </div>
      </div>

      <div className="em-trust-field">
        <input
          placeholder="Company, EIN, or license #"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') run() }}
        />
        <button onClick={run} disabled={loading}>{loading ? '…' : 'Run'}</button>
      </div>

      <div className="em-trust-chips">
        {['Bemas Construction', 'PCL Denver', 'Weitz Co.', 'I-Kota'].map(name => (
          <button key={name} className="em-trust-chip" onClick={() => { setQ(name); }}>{name}</button>
        ))}
      </div>

      {report && !report.error && <TrustCard r={report} />}
      {report?.error && (
        <div style={{ margin: '0 16px', padding: 14, border: '.5px dashed var(--clay-600)',
                      borderRadius: 'var(--r-md)', color: 'var(--clay-700)', fontSize: 13 }}>
          <strong>{report.name}</strong> — {report.error}
        </div>
      )}

      {checkoutEnabled ? (
        <div className="em-trust-upgrade">
          <div><strong>Deep dive</strong>  ·  court filings, federal litigation, 14 extra sources</div>
          <div style={{ fontFamily: 'var(--font-num)', fontWeight: 700 }}>$2.00</div>
        </div>
      ) : (
        <div className="em-trust-upgrade" style={{ color: 'var(--ink-500)' }}>
          <div><strong>Paid tiers launching soon</strong>  ·  free lookup available above</div>
        </div>
      )}
    </>
  )
}

function TrustCard({ r }: { r: any }) {
  return (
    <div className="em-trust-card">
      <div className="em-trust-head">
        <div>
          <div className="em-trust-head__kicker">Trust report  ·  live</div>
          <div className="em-trust-head__name">{r.name}</div>
          <div className="em-trust-head__loc">{r.location ?? ''}</div>
        </div>
        <div className="em-trust-score">
          <div className="em-trust-score__num">{r.score ?? '—'}</div>
          <div className="em-trust-score__label">Trust score</div>
        </div>
      </div>
      <div className="em-trust-rows">
        {(r.rows ?? []).map((row: any, i: number) => (
          <div key={i} className="em-trust-row">
            <div className={`em-trust-row__dot ${row.warn ? 'warn' : ''}`} />
            <div>{row.label}</div>
            <div className="em-trust-row__val">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
