'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const JOB_POLL_MS = 2000

type ActiveJob = {
  id: string
  status: string
  tier?: string
  sources_completed?: number | null
  total_sources_planned?: number | null
  evidence_count?: number | null
  report_id?: string | null
  error_message?: string | null
}

export default function TrustClient({ checkoutEnabled }: { checkoutEnabled: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState('')
  const [stateCode, setStateCode] = useState('CO')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-open job handed back by ?job_id=&auto=1 (from /api/trust/checkout/success redirect)
  useEffect(() => {
    const jobId = params.get('job_id')
    const auto = params.get('auto')
    const checkoutStatus = params.get('checkout')
    if (checkoutStatus === 'cancelled') setToast('Checkout cancelled.')
    if (checkoutStatus === 'invalid')   setToast('Checkout session invalid. Contact support.')
    if (jobId && auto === '1') {
      startPollingJob(jobId)
      router.replace('/dashboard/driver/trust')
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startPollingJob(id: string) {
    setActiveJob({ id, status: 'pending' })
    if (pollRef.current) clearInterval(pollRef.current)
    const poll = async () => {
      try {
        const res = await fetch(`/api/trust/job/${encodeURIComponent(id)}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as ActiveJob
        setActiveJob(data)
        if (data.status === 'completed' || data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch { /* transient; keep polling */ }
    }
    poll()
    pollRef.current = setInterval(poll, JOB_POLL_MS)
  }

  async function run() {
    if (!q.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_name: q.trim(),
          city: '',
          state_code: stateCode,
          tier: 'free',
        }),
      })
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}))
        if (checkoutEnabled && data?.checkout_url) {
          upgradeToTier('standard')
        } else {
          setToast('Paid tiers launching soon.')
        }
      } else if (res.ok) {
        setReport(await res.json())
      } else {
        const data = await res.json().catch(() => ({}))
        setReport({ name: q, score: null, error: data?.error ?? 'Lookup unavailable' })
      }
    } catch {
      setReport({ name: q, score: null, error: 'Offline' })
    } finally {
      setLoading(false)
    }
  }

  async function upgradeToTier(tier: 'standard' | 'plus' | 'deep_dive') {
    if (!checkoutEnabled) { setToast('Paid tiers launching soon.'); return }
    if (!q.trim()) { setToast('Enter a company name first.'); return }
    try {
      const res = await fetch('/api/trust/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          contractor_name: q.trim(),
          state_code: stateCode,
          return_path: '/dashboard/driver/trust',
        }),
      })
      if (res.status === 200) {
        const data = await res.json()
        if (data?.url) { window.location.assign(data.url); return }
        setToast('Checkout unavailable — try again in a moment.')
      } else if (res.status === 422) {
        setToast('We can only run reports on businesses, not individuals.')
      } else if (res.status === 410) {
        setToast('Paid tiers launching soon.')
      } else {
        setToast('Checkout unavailable — try again in a moment.')
      }
    } catch {
      setToast('Checkout unavailable — try again in a moment.')
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
          <button key={name} className="em-trust-chip" onClick={() => { setQ(name) }}>{name}</button>
        ))}
      </div>

      {toast && (
        <div
          role="status"
          style={{
            margin: '0 16px 8px', padding: 10, fontSize: 12,
            border: '.5px dashed var(--clay-600)', borderRadius: 'var(--r-md)',
            color: 'var(--clay-700)',
          }}
        >
          {toast}
        </div>
      )}

      {activeJob && (
        <div
          style={{
            margin: '0 16px 12px', padding: 12, fontSize: 12,
            border: '.5px solid var(--line-200)', borderRadius: 'var(--r-md)',
          }}
        >
          <div style={{ fontWeight: 600 }}>Deep-dive report</div>
          <div style={{ color: 'var(--ink-500)' }}>
            Job {activeJob.id.slice(0, 8)} — {activeJob.status}
            {activeJob.sources_completed != null && activeJob.total_sources_planned != null &&
              ` · ${activeJob.sources_completed}/${activeJob.total_sources_planned} sources`}
          </div>
          {activeJob.status === 'failed' && activeJob.error_message && (
            <div style={{ color: 'var(--clay-700)', marginTop: 4 }}>{activeJob.error_message}</div>
          )}
        </div>
      )}

      {report && !report.error && <TrustCard r={report} />}
      {report?.error && (
        <div style={{ margin: '0 16px', padding: 14, border: '.5px dashed var(--clay-600)',
                      borderRadius: 'var(--r-md)', color: 'var(--clay-700)', fontSize: 13 }}>
          <strong>{report.name}</strong> — {report.error}
        </div>
      )}

      {checkoutEnabled ? (
        <button
          type="button"
          className="em-trust-upgrade"
          onClick={() => upgradeToTier('deep_dive')}
          style={{ cursor: 'pointer', textAlign: 'left', width: '100%' }}
        >
          <div><strong>Deep dive</strong>  ·  court filings, federal litigation, 14 extra sources</div>
          <div style={{ fontFamily: 'var(--font-num)', fontWeight: 700 }}>$2.00</div>
        </button>
      ) : (
        <div className="em-trust-upgrade" style={{ color: 'var(--ink-500)' }}>
          <div><strong>Paid tiers launching soon</strong>  ·  free lookup available above</div>
        </div>
      )}

      {/* State selector for checkout context */}
      {checkoutEnabled && (
        <div style={{ margin: '8px 16px 0', fontSize: 11, color: 'var(--ink-500)' }}>
          Operating state:{' '}
          <select value={stateCode} onChange={e => setStateCode(e.target.value)} style={{ fontSize: 11 }}>
            {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map(s =>
              <option key={s} value={s}>{s}</option>,
            )}
          </select>
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
          <div className="em-trust-head__name">{r.name ?? r.contractor_name}</div>
          <div className="em-trust-head__loc">{r.location ?? ''}</div>
        </div>
        <div className="em-trust-score">
          <div className="em-trust-score__num">{r.score ?? r.trust_score ?? '—'}</div>
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
