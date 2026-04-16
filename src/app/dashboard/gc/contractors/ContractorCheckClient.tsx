'use client'
import { useState } from 'react'
import { ShieldCheck, AlertTriangle, Search, Clock, ChevronRight } from 'lucide-react'

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

const RISK: Record<string, { text: string; border: string; bg: string; label: string }> = {
  LOW:      { text: 'text-emerald-400', border: 'border-emerald-900', bg: 'bg-emerald-950/40', label: 'Low Risk' },
  MEDIUM:   { text: 'text-amber-400',   border: 'border-amber-900',   bg: 'bg-amber-950/40',   label: 'Medium Risk' },
  HIGH:     { text: 'text-red-400',     border: 'border-red-900',     bg: 'bg-red-950/40',     label: 'High Risk' },
  CRITICAL: { text: 'text-purple-400',  border: 'border-purple-900',  bg: 'bg-purple-950/40',  label: 'Critical Risk' },
}

// Score decay — scores lose confidence over time
function scoreAge(createdAt: string): 'fresh' | 'aging' | 'stale' {
  const days = (Date.now() - new Date(createdAt).getTime()) / 86400000
  if (days < 30) return 'fresh'
  if (days < 90) return 'aging'
  return 'stale'
}

export default function ContractorCheckClient({ initialHistory }: { initialHistory: any[] }) {
  const [name,     setName]     = useState('')
  const [city,     setCity]     = useState('')
  const [state,    setState]    = useState('CO')
  const [loading,  setLoading]  = useState(false)
  const [searches, setSearches] = useState<string[]>([])
  const [report,   setReport]   = useState<any>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [history,  setHistory]  = useState(initialHistory)

  async function runCheck() {
    if (!name.trim() || !city.trim() || loading) return
    setLoading(true); setSearches([]); setReport(null); setError(null)

    try {
      const res = await fetch('/api/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractor_name: name.trim(), city: city.trim(), state_code: state, tier: 'free' }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? `Error ${res.status}`) }
      const data = await res.json()
      setReport(data)
      if (data.searches?.length) setSearches(data.searches)
      setHistory(prev => [data, ...prev].slice(0, 20))
    } catch (e: any) {
      setError(e.message ?? 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const rs = report ? RISK[report.risk_level] ?? RISK.MEDIUM : null

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck size={22} className="text-emerald-500" />
          <h1 className="text-2xl font-bold text-stone-100">Contractor Check</h1>
        </div>
        <p className="text-stone-500 text-sm">
          Know who you&apos;re doing business with before you sign. AI-powered verification in 30 seconds.
        </p>
      </div>

      {/* Loss framing stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { val: '$47,000', label: 'Average cost per unverified sub incident' },
          { val: '1 in 4',  label: 'GCs burned by unverified subs last year' },
          { val: '30 sec',  label: 'Time to run a full AI verification' },
        ].map(s => (
          <div key={s.label} className="card p-3">
            <div className="text-lg font-bold text-stone-100">{s.val}</div>
            <div className="text-xs text-stone-600 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search form */}
      <div className="card p-5 mb-5">
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Run a check</div>
        <div className="flex gap-2 flex-wrap">
          <input
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runCheck()}
            placeholder="Contractor or company name"
            className="flex-[2] min-w-[180px] bg-stone-900 border border-stone-700 rounded-lg px-3 py-2.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-emerald-700"
          />
          <input
            value={city} onChange={e => setCity(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runCheck()}
            placeholder="City"
            className="flex-1 min-w-[110px] bg-stone-900 border border-stone-700 rounded-lg px-3 py-2.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-emerald-700"
          />
          <select
            value={state} onChange={e => setState(e.target.value)}
            className="min-w-[72px] bg-stone-900 border border-stone-700 rounded-lg px-2 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-emerald-700"
          >
            {US_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
          <button
            onClick={runCheck}
            disabled={loading || !name.trim() || !city.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-800 disabled:text-stone-600 text-white rounded-lg text-sm font-semibold transition-colors min-w-[160px] justify-center"
          >
            <Search size={14} />
            {loading ? 'Investigating...' : 'Run Check'}
          </button>
        </div>
      </div>

      {/* Live search progress */}
      {(loading || (searches.length > 0 && !report)) && (
        <div className="card p-4 mb-5">
          <div className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-3">
            {loading ? '🔍 Live Investigation' : '✓ Complete'}
          </div>
          <div className="space-y-1">
            {searches.map((q, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-stone-500">
                <span className="text-emerald-500">✓</span>
                <span className="font-mono">{q}</span>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-stone-600">
                <span className="animate-spin inline-block">⟳</span>
                <span>Searching...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-5 p-4 bg-red-950/60 border border-red-900 rounded-xl text-sm text-red-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Report */}
      {report && rs && (
        <div className="space-y-4">
          {/* Score card */}
          <div className={`card p-5 border ${rs.border}`}>
            <div className="flex items-start gap-5 flex-wrap">
              <div className={`text-5xl font-black ${rs.text}`}>{report.trust_score}</div>
              <div className="flex-1 min-w-[200px]">
                <div className="text-lg font-bold text-stone-100">{report.contractor_name}</div>
                <div className="text-stone-500 text-sm mb-2">{report.location}</div>
                <span className={`inline-block px-3 py-1 rounded-md text-xs font-semibold ${rs.bg} ${rs.text} border ${rs.border}`}>
                  {rs.label}
                </span>
                <p className="text-stone-400 text-sm mt-3 leading-relaxed">{report.summary}</p>
              </div>
            </div>
          </div>

          {/* Red flags */}
          {report.red_flags?.length > 0 && (
            <div className="p-4 bg-red-950/50 border border-red-900 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                <AlertTriangle size={12} /> Red Flags
              </div>
              {report.red_flags.map((f: string, i: number) => (
                <div key={i} className="text-sm text-red-300 py-0.5">• {f}</div>
              ))}
            </div>
          )}

          {/* Positive indicators */}
          {report.positive_indicators?.length > 0 && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-900 rounded-xl">
              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">✓ Verified</div>
              {report.positive_indicators.map((p: string, i: number) => (
                <div key={i} className="text-sm text-emerald-300 py-0.5">✓ {p}</div>
              ))}
            </div>
          )}

          {/* Data source cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { title: 'Business Registration', rows: [
                { l: 'Status',      v: report.business_registration?.status, badge: true },
                { l: 'Entity',      v: report.business_registration?.entity_type },
                { l: 'Formed',      v: report.business_registration?.formation_date },
              ]},
              { title: 'Licensing', rows: [
                { l: 'Status',      v: report.licensing?.status, badge: true },
                { l: 'License #',   v: report.licensing?.license_number },
                { l: 'Expires',     v: report.licensing?.expiration },
              ]},
              { title: 'BBB Profile', rows: [
                { l: 'Rating',      v: report.bbb_profile?.rating },
                { l: 'Accredited',  v: report.bbb_profile?.accredited != null ? (report.bbb_profile.accredited ? 'Yes' : 'No') : null },
                { l: 'Complaints',  v: report.bbb_profile?.complaint_count != null ? `${report.bbb_profile.complaint_count} on file` : null },
              ]},
              { title: 'Online Reviews', rows: [
                { l: 'Avg Rating',  v: report.reviews?.average_rating != null ? `${report.reviews.average_rating}/5.0` : null },
                { l: 'Reviews',     v: report.reviews?.total_reviews },
                { l: 'Sentiment',   v: report.reviews?.sentiment },
              ]},
              { title: 'Legal Records', rows: [
                { l: 'Status',      v: report.legal_records?.status, badge: true },
                { l: 'Finding',     v: report.legal_records?.findings?.[0] ?? null },
              ]},
              { title: 'OSHA Violations', rows: [
                { l: 'Status',      v: report.osha_violations?.status, badge: true },
                { l: 'Violations',  v: report.osha_violations?.violation_count },
                { l: 'Serious',     v: report.osha_violations?.serious_count },
              ]},
            ].map(card => (
              <div key={card.title} className="card p-4">
                <div className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-3">{card.title}</div>
                {card.rows.map(row => (
                  <div key={row.l} className="flex justify-between items-center py-1">
                    <span className="text-xs text-stone-600">{row.l}</span>
                    {row.badge
                      ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${['VERIFIED','CLEAN'].includes(row.v ?? '') ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>{row.v ?? '—'}</span>
                      : <span className="text-xs font-medium text-stone-300">{row.v ?? '—'}</span>
                    }
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="text-xs text-stone-700 px-1">
            Confidence: {report.confidence_level} · {report.data_sources_searched?.length ?? 0} sources checked · {report.disclaimer}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !report && !error && (
        <div className="text-center py-16 text-stone-700">
          <ShieldCheck size={40} className="mx-auto mb-4 opacity-40" />
          <div className="text-base font-medium text-stone-500 mb-1">Enter a contractor name above</div>
          <div className="text-sm">AI searches 7 sources and returns a full risk report in ~30 seconds</div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-10">
          <div className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-3">
            <Clock size={11} className="inline mr-1.5" />Previous Checks
          </div>
          <div className="space-y-2">
            {history.map((h: any, i: number) => {
              const hr = RISK[h.risk_level] ?? RISK.MEDIUM
              const age = scoreAge(h.created_at)
              return (
                <button
                  key={h.id ?? i}
                  onClick={() => setReport(h)}
                  className="w-full card px-4 py-3 flex items-center justify-between hover:bg-stone-800/60 transition-colors text-left"
                >
                  <div>
                    <span className="text-sm font-medium text-stone-200">{h.contractor_name}</span>
                    <span className="text-xs text-stone-600 ml-2">{h.city}, {h.state_code}</span>
                    {age !== 'fresh' && (
                      <span className="ml-2 text-[10px] text-amber-500">⚡ {age}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${hr.text}`}>{h.trust_score}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${hr.bg} ${hr.text} border ${hr.border}`}>{h.risk_level}</span>
                    <ChevronRight size={12} className="text-stone-600" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
