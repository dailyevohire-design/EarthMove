'use client'
import { useState } from 'react'
import { ShieldCheck, AlertTriangle, Search, Clock, ChevronRight, CheckCircle2, XCircle, Lock } from 'lucide-react'

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

const RISK: Record<string, { text: string; bg: string; border: string; label: string; scoreBg: string }> = {
  LOW:      { text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'Low Risk',      scoreBg: 'bg-emerald-600' },
  MEDIUM:   { text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   label: 'Medium Risk',   scoreBg: 'bg-amber-500' },
  HIGH:     { text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     label: 'High Risk',     scoreBg: 'bg-red-600' },
  CRITICAL: { text: 'text-red-800',     bg: 'bg-red-100',     border: 'border-red-300',     label: 'Critical Risk', scoreBg: 'bg-red-700' },
}

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* Hero section — matches /join stat bar style */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4 border border-emerald-200">
            <ShieldCheck size={13} />
            AI-Powered Verification — Free Forever
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Know who you&apos;re doing business with
          </h1>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">
            Search any contractor, hauler, or company. AI checks 7 public sources and returns a full risk report in ~30 seconds.
          </p>
        </div>

        {/* Stat bar — matches /join emerald stat numbers */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { val: '$47K',   sub: 'AVG LOSS', desc: 'per unverified sub incident', accent: true },
            { val: '1 in 4', sub: 'GCs BURNED', desc: 'by bad subs last year', accent: true },
            { val: '7',      sub: 'SOURCES', desc: 'checked per report', accent: false },
            { val: '30s',    sub: 'RESULTS', desc: 'average report time', accent: false },
          ].map(s => (
            <div key={s.sub} className="text-center">
              <div className={`text-2xl font-extrabold ${s.accent ? 'text-red-600' : 'text-emerald-600'}`}>{s.val}</div>
              <div className="text-[10px] font-bold text-gray-400 tracking-wider mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Search card — main CTA, matches /join form card style */}
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-6 mb-6">
          {/* Green highlight callout — matches /join "Same-Day Payment" callout */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-bold text-emerald-800">Free Contractor Risk Check</div>
                <div className="text-xs text-emerald-700/70 mt-0.5">
                  Searches court filings, liens, BBB complaints, OSHA violations, business registration, reviews, and license status — all in one report.
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <div className="flex-[2] min-w-[180px]">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Contractor or Company Name *</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runCheck()}
                placeholder="e.g. Bemas Construction"
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">City *</label>
              <input
                value={city} onChange={e => setCity(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runCheck()}
                placeholder="Denver"
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="min-w-[80px]">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">State</label>
              <select
                value={state} onChange={e => setState(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                {US_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={runCheck}
            disabled={loading || !name.trim() || !city.trim()}
            className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md disabled:shadow-none"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Investigating...
              </>
            ) : (
              <>
                <Search size={15} />
                Run Contractor Check — Free
              </>
            )}
          </button>

          {/* Trust badges — matches /join bottom badges */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-gray-100">
            {[
              { icon: <Lock size={11} />, label: '256-bit Encrypted' },
              { icon: <ShieldCheck size={11} />, label: 'FCRA Compliant' },
              { icon: <CheckCircle2 size={11} />, label: '7 Sources Checked' },
            ].map(b => (
              <div key={b.label} className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                <span className="text-gray-300">{b.icon}</span>
                {b.label}
              </div>
            ))}
          </div>
        </div>

        {/* Live search progress */}
        {(loading || (searches.length > 0 && !report)) && (
          <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-5 mb-6">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              {loading ? '🔍 Live Investigation' : '✓ Complete'}
            </div>
            <div className="space-y-2">
              {searches.map((q, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-gray-600 font-mono text-xs">{q}</span>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="w-3.5 h-3.5 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin flex-shrink-0" />
                  <span className="text-gray-400 text-xs">Searching...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-red-800">Verification Failed</div>
              <div className="text-xs text-red-600 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {/* Report results */}
        {report && rs && (
          <div className="space-y-4">
            {/* Score hero card */}
            <div className={`bg-white border ${rs.border} rounded-2xl shadow-sm p-6`}>
              <div className="flex items-start gap-6 flex-wrap">
                {/* Score circle */}
                <div className="flex flex-col items-center">
                  <div className={`w-20 h-20 rounded-full ${rs.scoreBg} flex items-center justify-center shadow-lg`}>
                    <span className="text-3xl font-black text-white">{report.trust_score}</span>
                  </div>
                  <span className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold ${rs.bg} ${rs.text} border ${rs.border}`}>
                    {rs.label}
                  </span>
                </div>
                {/* Details */}
                <div className="flex-1 min-w-[220px]">
                  <h2 className="text-xl font-extrabold text-gray-900">{report.contractor_name}</h2>
                  <p className="text-gray-500 text-sm mb-3">{report.location}</p>
                  <p className="text-gray-600 text-sm leading-relaxed">{report.summary}</p>
                </div>
              </div>
            </div>

            {/* Red flags */}
            {report.red_flags?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-red-700 uppercase tracking-wider mb-3">
                  <AlertTriangle size={13} /> Red Flags ({report.red_flags.length})
                </div>
                {report.red_flags.map((f: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <XCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-800">{f}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Positive indicators */}
            {report.positive_indicators?.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">
                  ✓ Verified ({report.positive_indicators.length})
                </div>
                {report.positive_indicators.map((p: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-emerald-800">{p}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Data source cards — 2x3 grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { title: 'Business Registration', icon: '🏛', rows: [
                  { l: 'Status',     v: report.business_registration?.status, badge: true },
                  { l: 'Entity',     v: report.business_registration?.entity_type },
                  { l: 'Formed',     v: report.business_registration?.formation_date },
                  { l: 'Agent',      v: report.business_registration?.registered_agent },
                ]},
                { title: 'Licensing', icon: '📋', rows: [
                  { l: 'Status',     v: report.licensing?.status, badge: true },
                  { l: 'License #',  v: report.licensing?.license_number },
                  { l: 'Expires',    v: report.licensing?.expiration },
                ]},
                { title: 'BBB Profile', icon: '🛡', rows: [
                  { l: 'Rating',     v: report.bbb_profile?.rating },
                  { l: 'Accredited', v: report.bbb_profile?.accredited != null ? (report.bbb_profile.accredited ? 'Yes' : 'No') : null },
                  { l: 'Complaints', v: report.bbb_profile?.complaint_count != null ? `${report.bbb_profile.complaint_count} on file` : null },
                ]},
                { title: 'Online Reviews', icon: '⭐', rows: [
                  { l: 'Avg Rating', v: report.reviews?.average_rating != null ? `${report.reviews.average_rating}/5.0` : null },
                  { l: 'Total',      v: report.reviews?.total_reviews },
                  { l: 'Sentiment',  v: report.reviews?.sentiment },
                ]},
                { title: 'Legal Records', icon: '⚖', rows: [
                  { l: 'Status',    v: report.legal_records?.status, badge: true },
                  { l: 'Finding',   v: report.legal_records?.findings?.[0] ?? null },
                ]},
                { title: 'OSHA Safety', icon: '🔶', rows: [
                  { l: 'Status',     v: report.osha_violations?.status, badge: true },
                  { l: 'Violations', v: report.osha_violations?.violation_count },
                  { l: 'Serious',    v: report.osha_violations?.serious_count },
                ]},
              ].map(card => (
                <div key={card.title} className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    <span>{card.icon}</span> {card.title}
                  </div>
                  {card.rows.map(row => (
                    <div key={row.l} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs text-gray-500">{row.l}</span>
                      {row.badge ? (
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          ['VERIFIED','CLEAN'].includes(row.v ?? '')
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : ['NOT_FOUND','INACTIVE','EXPIRED'].includes(row.v ?? '')
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>{row.v ?? 'Unknown'}</span>
                      ) : (
                        <span className="text-xs font-medium text-gray-800">{row.v ?? '—'}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <p className="text-[11px] text-gray-400 text-center px-4 leading-relaxed">
              Confidence: {report.confidence_level} · {report.data_sources_searched?.length ?? 0} sources checked · {report.disclaimer}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !report && !error && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={28} className="text-emerald-400" />
            </div>
            <div className="text-base font-semibold text-gray-700 mb-1">Enter a contractor name above</div>
            <div className="text-sm text-gray-400">AI searches 7 sources and returns a full risk report in ~30 seconds</div>
          </div>
        )}

        {/* Previous checks */}
        {history.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              <Clock size={12} /> Previous Checks
            </div>
            <div className="space-y-2">
              {history.map((h: any, i: number) => {
                const hr = RISK[h.risk_level] ?? RISK.MEDIUM
                const age = scoreAge(h.created_at)
                return (
                  <button
                    key={h.id ?? i}
                    onClick={() => setReport(h)}
                    className="w-full bg-white border border-gray-200/80 rounded-xl shadow-sm px-4 py-3 flex items-center justify-between hover:border-emerald-300 hover:shadow-md transition-all text-left group"
                  >
                    <div>
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-emerald-700 transition-colors">{h.contractor_name}</span>
                      <span className="text-xs text-gray-400 ml-2">{h.city}, {h.state_code}</span>
                      {age !== 'fresh' && (
                        <span className="ml-2 text-[10px] text-amber-600 font-medium">⏱ {age}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full ${hr.scoreBg} flex items-center justify-center`}>
                        <span className="text-xs font-black text-white">{h.trust_score}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hr.bg} ${hr.text} border ${hr.border}`}>{hr.label}</span>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
