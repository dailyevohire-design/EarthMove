'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ShieldCheck, AlertTriangle, Search, Clock, ChevronRight, CheckCircle2,
  XCircle, Lock, Download, Zap, Crown, ArrowRight, Loader2
} from 'lucide-react'

type PaidTier = 'standard' | 'deep_dive'
const JOB_POLL_MS = 2000

type ActiveJob = {
  id: string
  status: string
  tier?: string
  sources_completed?: number | null
  total_sources_planned?: number | null
  report_id?: string | null
  error_message?: string | null
}

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

type Tier = 'free' | 'standard' | 'deep_dive'

// Per-lookup pricing per commit 83fa9c7's shipped redemption tiers.
// free     — cached lookup, no charge
// standard — fresh AI-compiled report, $0.19 per lookup
// deep_dive — paid-source data + full audit trail, $2.00 per lookup
// Keyed on the lookup tier ('free') + purchase tiers ('standard', 'deep_dive'). The
// lookup call uses 'free'; the upgrade buttons route to /api/trust/checkout with
// 'standard' or 'deep_dive'.
const TIERS = {
  free:      { label: 'Free',       price: '$0',     period: 'per lookup', icon: <ShieldCheck size={18} />, blurb: 'Cached report from our library. $0.', depth: 'Cached results (7-30 days old)', sources: '7 public sources', speed: '~30 seconds', features: ['Basic trust score', 'Red flags & verified indicators', 'Business registration check', 'BBB profile lookup'] },
  standard:  { label: 'Standard',   price: '$0.19',  period: 'per lookup', icon: <Zap size={18} />,         blurb: 'Fresh AI-compiled report. $0.19 per lookup.', depth: 'Fresh real-time search', sources: '12+ sources with deep web', speed: '~20 seconds', features: ['Everything in Free', 'Real-time fresh results every lookup', 'OSHA violation deep scan', 'Court records & lien search', 'Downloadable PDF report'] },
  deep_dive: { label: 'Deep Dive',  price: '$2.00',  period: 'per lookup', icon: <Crown size={18} />,       blurb: 'Paid-source data + full audit trail. $2.00 per lookup.', depth: 'Full investigation with paid APIs', sources: '20+ sources incl. Secretary of State', speed: '~60 seconds', features: ['Everything in Standard', 'Secretary of State live verification', 'OSHA enforcement database direct', 'Insurance & bonding verification', 'Owner/officer background check', 'Custom branded PDF report'] },
}

const RISK: Record<string, { text: string; bg: string; border: string; label: string; ringColor: string; scoreBg: string }> = {
  LOW:      { text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'Low Risk',      ringColor: '#059669', scoreBg: 'bg-emerald-600' },
  MEDIUM:   { text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   label: 'Medium Risk',   ringColor: '#d97706', scoreBg: 'bg-amber-500' },
  HIGH:     { text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     label: 'High Risk',     ringColor: '#dc2626', scoreBg: 'bg-red-600' },
  CRITICAL: { text: 'text-red-800',     bg: 'bg-red-100',     border: 'border-red-300',     label: 'Critical Risk', ringColor: '#991b1b', scoreBg: 'bg-red-700' },
}

function scoreAge(createdAt: string): 'fresh' | 'aging' | 'stale' {
  const days = (Date.now() - new Date(createdAt).getTime()) / 86400000
  if (days < 30) return 'fresh'
  if (days < 90) return 'aging'
  return 'stale'
}

function ScoreRing({ score, riskLevel }: { score: number; riskLevel: string }) {
  const rs = RISK[riskLevel] ?? RISK.MEDIUM
  const c = 2 * Math.PI * 52
  const offset = c - (score / 100) * c
  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#f3f4f6" strokeWidth="8" />
        <circle cx="60" cy="60" r="52" fill="none" stroke={rs.ringColor} strokeWidth="8" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-gray-900">{score}</span>
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Score</span>
      </div>
    </div>
  )
}

function TierComparisonPanel({ tier, setTier }: { tier: Tier; setTier: (t: Tier) => void }) {
  if (tier === 'standard') {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 mb-4">
        <h3 className="text-base font-semibold text-stone-900">You&apos;re on Standard — $0.19 per lookup</h3>
        <p className="text-sm text-stone-600 mt-1">Fresh AI report with 7+ public sources, 30s turnaround.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => setTier('free')} className="border border-stone-300 bg-white text-stone-700 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-stone-50">Switch to Free (cached)</button>
          <button onClick={() => setTier('deep_dive')} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5 text-sm font-medium">Upgrade to Deep Dive ($2) →</button>
        </div>
      </div>
    )
  }
  if (tier === 'deep_dive') {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 mb-4">
        <h3 className="text-base font-semibold text-stone-900">You&apos;re on Deep Dive — $2.00 per lookup</h3>
        <p className="text-sm text-stone-600 mt-1">Paid-source data + full audit trail. Business entities only (LLC, Corp). Individual driver background checks require Checkr.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => setTier('standard')} className="border border-stone-300 bg-white text-stone-700 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-stone-50">Switch to Standard ($0.19)</button>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 mb-4">
      <h3 className="text-base font-semibold text-stone-900">What you get on Free</h3>
      <ul className="mt-3 space-y-1.5">
        <li className="flex items-start gap-2 text-sm text-stone-600"><CheckCircle2 size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" /><span>Cached report from prior lookups (may be 7-30 days old)</span></li>
        <li className="flex items-start gap-2 text-sm text-stone-600"><CheckCircle2 size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" /><span>Trust score, risk level, basic business registration</span></li>
        <li className="flex items-start gap-2 text-sm text-stone-600"><CheckCircle2 size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" /><span>BBB rating, review aggregates</span></li>
        <li className="flex items-start gap-2 text-sm text-stone-600"><XCircle size={14} className="text-stone-400 mt-0.5 flex-shrink-0" /><span>Fresh AI-compiled research</span></li>
        <li className="flex items-start gap-2 text-sm text-stone-600"><XCircle size={14} className="text-stone-400 mt-0.5 flex-shrink-0" /><span>Live court records, legal findings, OSHA violations</span></li>
        <li className="flex items-start gap-2 text-sm text-stone-600"><XCircle size={14} className="text-stone-400 mt-0.5 flex-shrink-0" /><span>Full evidence trail with cited sources</span></li>
      </ul>
      <p className="text-sm text-stone-600 mt-4 font-medium">Need more? Upgrade this lookup:</p>
      <div className="grid md:grid-cols-2 gap-3 mt-2">
        <div className="rounded-md border border-stone-200 p-3">
          <div className="text-sm font-semibold text-stone-900">Standard — $0.19</div>
          <p className="text-sm text-stone-600 mt-1">Fresh AI report, 7+ public sources, 30s turnaround.</p>
          <button onClick={() => setTier('standard')} className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5 text-sm font-medium">Use Standard →</button>
        </div>
        <div className="rounded-md border border-stone-200 p-3">
          <div className="text-sm font-semibold text-stone-900">Deep Dive — $2.00</div>
          <p className="text-sm text-stone-600 mt-1">Paid sources, full audit trail, business entities only.</p>
          <button onClick={() => setTier('deep_dive')} className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5 text-sm font-medium">Use Deep Dive →</button>
        </div>
      </div>
    </div>
  )
}

export default function ContractorCheckClient({ initialHistory, checkoutEnabled }: { initialHistory: any[]; checkoutEnabled: boolean }) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('CO')
  const [tier, setTier] = useState<Tier>('free')
  const [loading, setLoading] = useState(false)
  const [searches, setSearches] = useState<string[]>([])
  const [report, setReport] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState(initialHistory)
  const [showPlans, setShowPlans] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const jobId = params.get('job_id')
    const auto = params.get('auto')
    const checkoutStatus = params.get('checkout')
    if (checkoutStatus === 'cancelled') setToast('Checkout cancelled.')
    if (checkoutStatus === 'invalid')   setToast('Checkout session invalid. Contact support.')
    if (jobId && auto === '1') {
      startPollingJob(jobId)
      router.replace('/dashboard/gc/contractors')
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
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
        }
      } catch { /* transient */ }
    }
    poll()
    pollRef.current = setInterval(poll, JOB_POLL_MS)
  }

  async function upgradeToCheckout(paidTier: PaidTier) {
    if (!checkoutEnabled) { setToast('Paid tiers launching soon.'); return }
    if (!name.trim()) { setToast('Enter a contractor name first.'); return }
    setUpgrading(true)
    try {
      const res = await fetch('/api/trust/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier:             paidTier,
          contractor_name:  name.trim(),
          state_code:       state,
          return_path:      '/dashboard/gc/contractors',
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
    } finally {
      setUpgrading(false)
    }
  }

  async function runCheck() {
    if (!name.trim() || !city.trim() || loading) return
    setLoading(true); setSearches([]); setReport(null); setError(null)
    try {
      const res = await fetch('/api/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractor_name: name.trim(), city: city.trim(), state_code: state, tier }),
      })
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}))
        if (checkoutEnabled && data?.checkout_url) {
          await upgradeToCheckout((tier === 'deep_dive' ? 'deep_dive' : 'standard') as PaidTier)
          return
        }
        setToast('Paid tiers launching soon.')
        return
      }
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? `Error ${res.status}`) }
      const data = await res.json()
      setReport(data)
      if (data.searches?.length) setSearches(data.searches)
      setHistory(prev => [data, ...prev].slice(0, 20))
    } catch (e: any) { setError(e.message ?? 'Verification failed') }
    finally { setLoading(false) }
  }

  function downloadReport() {
    if (!report) return
    const w = window.open('', '_blank')
    if (!w) return
    const rs = RISK[report.risk_level] ?? RISK.MEDIUM
    w.document.write(`<!DOCTYPE html><html><head><title>Trust Report — ${report.contractor_name}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;padding:40px;max-width:800px;margin:0 auto}
    .hdr{display:flex;align-items:center;gap:12px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #059669}.logo{font-size:20px;font-weight:900;color:#059669}.meta{font-size:11px;color:#888}
    .sc{display:flex;align-items:center;gap:24px;margin:24px 0;padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb}
    .circle{width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:white}
    .c-low{background:#059669}.c-medium{background:#d97706}.c-high{background:#dc2626}.c-critical{background:#991b1b}
    .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700}
    .b-LOW{background:#ecfdf5;color:#065f46}.b-MEDIUM{background:#fffbeb;color:#92400e}.b-HIGH{background:#fef2f2;color:#991b1b}.b-CRITICAL{background:#fef2f2;color:#7f1d1d}
    h1{font-size:22px;margin-bottom:4px}.loc{color:#6b7280;font-size:13px}.sum{color:#374151;font-size:13px;line-height:1.6;margin-top:8px}
    .sec{margin:20px 0}.st{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:8px}
    .fl{display:flex;align-items:flex-start;gap:8px;padding:6px 0;font-size:13px}.fi{color:#dc2626;font-weight:bold}.ci{color:#059669;font-weight:bold}
    .gr{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:20px 0}.cd{border:1px solid #e5e7eb;border-radius:10px;padding:14px}
    .ct{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;margin-bottom:10px}
    .rw{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}.rl{color:#6b7280}.rv{font-weight:600;color:#1f2937}
    .bg{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px}.bg-g{background:#ecfdf5;color:#065f46}.bg-b{background:#fef2f2;color:#991b1b}.bg-n{background:#f3f4f6;color:#6b7280}
    .ft{margin-top:30px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af}@media print{body{padding:20px}}</style></head><body>
    <div class="hdr"><div class="logo">EARTHMOVE</div><div style="flex:1"></div><div class="meta">Trust Report · ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div></div>
    <div class="sc"><div class="circle c-${report.risk_level?.toLowerCase()}">${report.trust_score}</div><div><h1>${report.contractor_name}</h1><div class="loc">${report.location}</div>
    <span class="badge b-${report.risk_level}">${rs.label}</span><div class="sum">${report.summary}</div></div></div>
    ${report.red_flags?.length?`<div class="sec"><div class="st">⚠ Red Flags (${report.red_flags.length})</div>${report.red_flags.map((f:string)=>`<div class="fl"><span class="fi">✕</span>${f}</div>`).join('')}</div>`:''}
    ${report.positive_indicators?.length?`<div class="sec"><div class="st">✓ Verified (${report.positive_indicators.length})</div>${report.positive_indicators.map((p:string)=>`<div class="fl"><span class="ci">✓</span>${p}</div>`).join('')}</div>`:''}
    <div class="gr">
    <div class="cd"><div class="ct">🏛 Business Registration</div><div class="rw"><span class="rl">Status</span><span class="bg ${['VERIFIED','CLEAN'].includes(report.business_registration?.status)?'bg-g':report.business_registration?.status==='UNKNOWN'?'bg-n':'bg-b'}">${report.business_registration?.status??'Unknown'}</span></div><div class="rw"><span class="rl">Entity</span><span class="rv">${report.business_registration?.entity_type??'—'}</span></div><div class="rw"><span class="rl">Formed</span><span class="rv">${report.business_registration?.formation_date??'—'}</span></div></div>
    <div class="cd"><div class="ct">📋 Licensing</div><div class="rw"><span class="rl">Status</span><span class="bg ${['VERIFIED','CLEAN'].includes(report.licensing?.status)?'bg-g':report.licensing?.status==='UNKNOWN'?'bg-n':'bg-b'}">${report.licensing?.status??'Unknown'}</span></div><div class="rw"><span class="rl">License #</span><span class="rv">${report.licensing?.license_number??'—'}</span></div><div class="rw"><span class="rl">Expires</span><span class="rv">${report.licensing?.expiration??'—'}</span></div></div>
    <div class="cd"><div class="ct">🛡 BBB Profile</div><div class="rw"><span class="rl">Rating</span><span class="rv">${report.bbb_profile?.rating??'—'}</span></div><div class="rw"><span class="rl">Accredited</span><span class="rv">${report.bbb_profile?.accredited!=null?(report.bbb_profile.accredited?'Yes':'No'):'—'}</span></div><div class="rw"><span class="rl">Complaints</span><span class="rv">${report.bbb_profile?.complaint_count??'—'}</span></div></div>
    <div class="cd"><div class="ct">⭐ Reviews</div><div class="rw"><span class="rl">Rating</span><span class="rv">${report.reviews?.average_rating!=null?report.reviews.average_rating+'/5.0':'—'}</span></div><div class="rw"><span class="rl">Total</span><span class="rv">${report.reviews?.total_reviews??'—'}</span></div><div class="rw"><span class="rl">Sentiment</span><span class="rv">${report.reviews?.sentiment??'—'}</span></div></div>
    <div class="cd"><div class="ct">⚖ Legal Records</div><div class="rw"><span class="rl">Status</span><span class="bg ${['VERIFIED','CLEAN'].includes(report.legal_records?.status)?'bg-g':report.legal_records?.status==='UNKNOWN'?'bg-n':'bg-b'}">${report.legal_records?.status??'Unknown'}</span></div>${report.legal_records?.findings?.[0]?`<div class="rw"><span class="rl">Finding</span><span class="rv" style="font-size:11px;max-width:160px">${report.legal_records.findings[0]}</span></div>`:''}</div>
    <div class="cd"><div class="ct">🔶 OSHA Safety</div><div class="rw"><span class="rl">Status</span><span class="bg ${['VERIFIED','CLEAN'].includes(report.osha_violations?.status)?'bg-g':report.osha_violations?.status==='UNKNOWN'?'bg-n':'bg-b'}">${report.osha_violations?.status??'Unknown'}</span></div><div class="rw"><span class="rl">Violations</span><span class="rv">${report.osha_violations?.violation_count??'—'}</span></div><div class="rw"><span class="rl">Serious</span><span class="rv">${report.osha_violations?.serious_count??'—'}</span></div></div>
    </div><div class="ft"><p>${report.disclaimer??'For informational purposes only.'}</p><p style="margin-top:4px">Confidence: ${report.confidence_level} · ${report.data_sources_searched?.length??0} sources · earthmove.io</p></div></body></html>`)
    w.document.close()
    w.onload = () => w.print()
  }

  const rs = report ? RISK[report.risk_level] ?? RISK.MEDIUM : null
  const ct = TIERS[tier]

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4 border border-emerald-200">
            <ShieldCheck size={13} /> AI-Powered Verification — Free Forever
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Know who you&apos;re doing business with</h1>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">Search any contractor, hauler, or company. AI checks public sources and returns a full risk report.</p>
        </div>

        {/* Tier pills */}
        <div className="flex items-center justify-center gap-1 mb-6 bg-gray-100 rounded-xl p-1 max-w-xl mx-auto">
          {(Object.entries(TIERS) as [Tier, typeof TIERS.free][]).map(([key, t]) => (
            <button key={key} onClick={() => setTier(key)} className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${tier===key?'bg-white shadow-md text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
              {t.icon}<span>{t.label}</span>
              {key!=='free'&&<span className={`text-[10px] font-bold ml-1 ${tier===key?'text-emerald-600':'text-gray-400'}`}>{t.price}</span>}
            </button>
          ))}
        </div>

        {/* Plan banner */}
        <div className={`mb-6 rounded-xl border p-4 transition-all ${tier==='free'?'bg-emerald-50/50 border-emerald-200':tier==='standard'?'bg-emerald-50 border-emerald-200':'bg-emerald-600/10 border-emerald-300'}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tier==='free'?'bg-emerald-100 text-emerald-600':tier==='standard'?'bg-emerald-100 text-emerald-700':'bg-emerald-600 text-white'}`}>{ct.icon}</div>
              <div>
                <div className="text-sm font-bold text-gray-900">{ct.label} — {ct.price} <span className="text-gray-500 font-normal">{ct.period}</span></div>
                <div className="text-xs text-gray-500">{ct.blurb}</div>
              </div>
            </div>
            {tier!=='free'
              ? (checkoutEnabled
                  ? <button
                      onClick={() => upgradeToCheckout(tier === 'deep_dive' ? 'deep_dive' : 'standard')}
                      disabled={upgrading}
                      className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-all hover:shadow-lg disabled:opacity-60 bg-emerald-600 hover:bg-emerald-700"
                    >{upgrading ? 'Opening Stripe…' : `Upgrade to ${ct.label} →`}</button>
                  : <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-gray-600 bg-gray-100 border border-gray-200">Paid tiers launching soon — free lookup available</span>)
              :<button onClick={()=>setShowPlans(!showPlans)} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">{showPlans?'Hide plans':'Compare plans →'}</button>}
          </div>
        </div>

        <TierComparisonPanel tier={tier} setTier={setTier} />

        {/* Plan comparison */}
        {showPlans&&<div className="grid grid-cols-3 gap-4 mb-8">
          {(Object.entries(TIERS) as [Tier, typeof TIERS.free][]).map(([key,t])=>(
            <div key={key} className={`relative bg-white rounded-2xl border-2 p-5 transition-all ${key==='standard'?'border-emerald-300 shadow-lg shadow-emerald-100/50 scale-[1.02]':key==='deep_dive'?'border-emerald-500 shadow-lg shadow-emerald-100/50':'border-gray-200'}`}>
              {key==='standard'&&<div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">MOST POPULAR</div>}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${key==='free'?'bg-gray-100 text-gray-700':key==='standard'?'bg-emerald-100 text-emerald-700':'bg-emerald-600 text-white'}`}>{t.icon}</div>
                <div className="text-sm font-bold text-gray-900">{t.label}</div>
              </div>
              <div className="mb-4"><span className="text-3xl font-black text-gray-900">{t.price}</span><span className="text-sm text-gray-400"> {t.period}</span></div>
              <div className="text-xs text-gray-500 mb-3 font-medium">{t.blurb}</div>
              <ul className="space-y-2 mb-5">{t.features.map(f=><li key={f} className="flex items-start gap-2 text-xs text-gray-600"><CheckCircle2 size={12} className="mt-0.5 flex-shrink-0 text-emerald-500"/>{f}</li>)}</ul>
              <button
                onClick={() => {
                  if (key === 'free') { setTier(key); setShowPlans(false); return }
                  if (checkoutEnabled) {
                    upgradeToCheckout(key as PaidTier)
                  } else {
                    setTier(key); setShowPlans(false)
                  }
                }}
                disabled={upgrading}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 ${key==='free'?'bg-gray-100 text-gray-700 hover:bg-gray-200':'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'}`}>
                {key==='free'?'Current Plan':key===tier?'Selected':`Get ${t.label}`}
              </button>
            </div>
          ))}
        </div>}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[{v:'$47K',s:'AVG LOSS',a:'text-red-600'},{v:'1 in 4',s:'GCs BURNED',a:'text-red-600'},{v:'7+',s:'SOURCES',a:'text-emerald-600'},{v:'30s',s:'RESULTS',a:'text-emerald-600'}].map(s=>(
            <div key={s.s} className="text-center"><div className={`text-xl sm:text-2xl font-extrabold ${s.a}`}>{s.v}</div><div className="text-[10px] font-bold text-gray-400 tracking-wider mt-0.5">{s.s}</div></div>
          ))}
        </div>

        {/* Search form */}
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-6 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3"><ShieldCheck size={18} className="text-emerald-600 mt-0.5 flex-shrink-0"/><div><div className="text-sm font-bold text-emerald-800">Free Contractor Risk Check</div><div className="text-xs text-emerald-700/70 mt-0.5">Searches court filings, liens, BBB complaints, OSHA violations, business registration, reviews, and license status.</div></div></div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-[2] min-w-[180px]"><label className="block text-xs font-semibold text-gray-700 mb-1.5">Contractor or Company Name *</label>
              <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runCheck()} placeholder="e.g. Bemas Construction" className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"/></div>
            <div className="flex-1 min-w-[120px]"><label className="block text-xs font-semibold text-gray-700 mb-1.5">City *</label>
              <input value={city} onChange={e=>setCity(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runCheck()} placeholder="Denver" className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"/></div>
            <div className="min-w-[80px]"><label className="block text-xs font-semibold text-gray-700 mb-1.5">State</label>
              <select value={state} onChange={e=>setState(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">{US_STATES.map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <button onClick={runCheck} disabled={loading||!name.trim()||!city.trim()} className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3.5 text-white rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-lg disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none bg-emerald-600 hover:bg-emerald-700">
            {loading?<><Loader2 size={15} className="animate-spin"/>Investigating...</>:<><Search size={15}/>Run {ct.label} Check{tier==='free'?' — Free':''}</>}
          </button>
          <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-gray-100">
            {[{i:<Lock size={11}/>,l:'256-bit Encrypted'},{i:<ShieldCheck size={11}/>,l:'FCRA Compliant'},{i:<CheckCircle2 size={11}/>,l:`${tier==='deep_dive'?'20+':tier==='standard'?'12+':'7'} Sources`}].map(b=>(
              <div key={b.l} className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium"><span className="text-gray-300">{b.i}</span>{b.l}</div>
            ))}
          </div>
        </div>

        {/* Progress */}
        {(loading||(searches.length>0&&!report))&&<div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-5 mb-6">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{loading?'🔍 Live Investigation':'✓ Complete'}</div>
          <div className="space-y-2">{searches.map((q,i)=><div key={i} className="flex items-center gap-2.5 text-sm"><CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0"/><span className="text-gray-600 font-mono text-xs">{q}</span></div>)}
            {loading&&<div className="flex items-center gap-2.5 text-sm"><Loader2 size={14} className="text-emerald-500 animate-spin flex-shrink-0"/><span className="text-gray-400 text-xs">Searching...</span></div>}
          </div></div>}

        {/* Toast */}
        {toast && <div role="status" className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 text-xs text-amber-800">{toast}</div>}

        {/* Active job (from ?job_id=&auto=1 or the redemption path) */}
        {activeJob && <div className="bg-white border border-emerald-200 rounded-2xl p-4 mb-6">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Deep-dive report</div>
          <div className="text-sm text-gray-900">Job {activeJob.id.slice(0,8)} — {activeJob.status}{activeJob.sources_completed!=null && activeJob.total_sources_planned!=null ? ` · ${activeJob.sources_completed}/${activeJob.total_sources_planned} sources` : ''}</div>
          {activeJob.status === 'failed' && activeJob.error_message && <div className="text-xs text-red-700 mt-1">{activeJob.error_message}</div>}
        </div>}

        {/* Error */}
        {error&&<div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3"><XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0"/><div><div className="text-sm font-semibold text-red-800">Verification Failed</div><div className="text-xs text-red-600 mt-0.5">{error}</div></div></div>}

        {/* Report */}
        {report&&rs&&<div className="space-y-4" ref={reportRef}>
          {/* Score card */}
          <div className={`bg-white border ${rs.border} rounded-2xl shadow-sm p-6`}>
            <div className="flex items-start gap-6 flex-wrap">
              <ScoreRing score={report.trust_score} riskLevel={report.risk_level}/>
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-3 flex-wrap"><h2 className="text-xl font-extrabold text-gray-900">{report.contractor_name}</h2><span className={`text-[10px] font-bold px-3 py-1 rounded-full ${rs.bg} ${rs.text} border ${rs.border}`}>{rs.label}</span></div>
                <p className="text-gray-500 text-sm mb-2">{report.location}</p>
                <p className="text-gray-600 text-sm leading-relaxed">{report.summary}</p>
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={downloadReport} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold text-gray-700 transition-all"><Download size={13}/>Download PDF</button>
                  {report.cached&&<span className="text-[10px] text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">⏱ Cached — upgrade for live data</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Red flags */}
          {report.red_flags?.length>0&&<div className="bg-red-50 border border-red-200 rounded-2xl p-5"><div className="flex items-center gap-2 text-xs font-bold text-red-700 uppercase tracking-wider mb-3"><AlertTriangle size={13}/>Red Flags ({report.red_flags.length})</div>
            {report.red_flags.map((f:string,i:number)=><div key={i} className="flex items-start gap-2 py-1.5"><XCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0"/><span className="text-sm text-red-800">{f}</span></div>)}</div>}

          {/* Verified */}
          {report.positive_indicators?.length>0&&<div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5"><div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">✓ Verified ({report.positive_indicators.length})</div>
            {report.positive_indicators.map((p:string,i:number)=><div key={i} className="flex items-start gap-2 py-1.5"><CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0"/><span className="text-sm text-emerald-800">{p}</span></div>)}</div>}

          {/* Data sources grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {t:'Business Registration',ic:'🏛',rows:[{l:'Status',v:report.business_registration?.status,b:true},{l:'Entity',v:report.business_registration?.entity_type},{l:'Formed',v:report.business_registration?.formation_date},{l:'Agent',v:report.business_registration?.registered_agent}]},
              {t:'Licensing',ic:'📋',rows:[{l:'Status',v:report.licensing?.status,b:true},{l:'License #',v:report.licensing?.license_number},{l:'Expires',v:report.licensing?.expiration}]},
              {t:'BBB Profile',ic:'🛡',rows:[{l:'Rating',v:report.bbb_profile?.rating},{l:'Accredited',v:report.bbb_profile?.accredited!=null?(report.bbb_profile.accredited?'Yes':'No'):null},{l:'Complaints',v:report.bbb_profile?.complaint_count!=null?`${report.bbb_profile.complaint_count} on file`:null}]},
              {t:'Online Reviews',ic:'⭐',rows:[{l:'Avg Rating',v:report.reviews?.average_rating!=null?`${report.reviews.average_rating}/5.0`:null},{l:'Total',v:report.reviews?.total_reviews},{l:'Sentiment',v:report.reviews?.sentiment}]},
              {t:'Legal Records',ic:'⚖',rows:[{l:'Status',v:report.legal_records?.status,b:true},{l:'Finding',v:report.legal_records?.findings?.[0]??null}]},
              {t:'OSHA Safety',ic:'🔶',rows:[{l:'Status',v:report.osha_violations?.status,b:true},{l:'Violations',v:report.osha_violations?.violation_count},{l:'Serious',v:report.osha_violations?.serious_count}]},
            ].map(card=>(
              <div key={card.t} className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-3"><span>{card.ic}</span>{card.t}</div>
                {card.rows.map(row=><div key={row.l} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{row.l}</span>
                  {row.b?<span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${['VERIFIED','CLEAN'].includes(row.v??'')?'bg-emerald-50 text-emerald-700 border border-emerald-200':['NOT_FOUND','INACTIVE','EXPIRED'].includes(row.v??'')?'bg-red-50 text-red-700 border border-red-200':'bg-gray-100 text-gray-500 border border-gray-200'}`}>{row.v??'Unknown'}</span>
                  :<span className="text-xs font-medium text-gray-800 text-right max-w-[60%]">{row.v??'—'}</span>}
                </div>)}
              </div>
            ))}
          </div>

          {/* Upsell */}
          {tier==='free' && checkoutEnabled && <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div><div className="text-sm font-bold">Want a fresher report?</div><div className="text-xs text-emerald-100 mt-1">Standard ($0.19 per lookup) runs a fresh AI-compiled report against 12+ sources. Deep Dive ($2.00 per lookup) adds paid-source data and a full audit trail.</div></div>
              <button onClick={()=>upgradeToCheckout('standard')} disabled={upgrading} className="flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-all shadow-sm disabled:opacity-60"><Zap size={13}/>{upgrading ? 'Opening Stripe…' : 'Upgrade to Standard — $0.19'}<ArrowRight size={13}/></button>
            </div>
          </div>}
          {tier==='free' && !checkoutEnabled && <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-gray-700">
            <div className="text-sm font-bold text-gray-900">Paid tiers launching soon</div>
            <div className="text-xs text-gray-500 mt-1">Free lookup is fully available today. Standard ($0.19) and Deep Dive ($2.00) per-lookup tiers go live when the redemption flow ships.</div>
          </div>}

          <p className="text-[11px] text-gray-400 text-center px-4 leading-relaxed">Confidence: {report.confidence_level} · {report.data_sources_searched?.length??0} sources checked · {report.disclaimer}</p>
        </div>}

        {/* Empty state */}
        {!loading&&!report&&!error&&<div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4"><ShieldCheck size={28} className="text-emerald-400"/></div>
          <div className="text-base font-semibold text-gray-700 mb-1">Enter a contractor name above</div>
          <div className="text-sm text-gray-400 mb-4">AI searches {tier==='deep_dive'?'20+':tier==='standard'?'12+':'7'} sources and returns a full risk report</div>
        </div>}

        {/* History — full rows are links to the report detail page */}
        {history.length>0&&<div className="mt-10">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3"><Clock size={12}/>Previous Checks</div>
          <div className="space-y-2">{history.map((h:any,i:number)=>{const hr=RISK[h.risk_level]??RISK.MEDIUM;const age=scoreAge(h.created_at);const targetId=h.report_id??h.id;return(
            <Link key={h.id??i} href={`/dashboard/trust/report/${targetId}`} className="w-full bg-white border border-gray-200/80 rounded-xl shadow-sm px-4 py-3 flex items-center justify-between hover:border-emerald-300 hover:shadow-md hover:bg-stone-50 transition-all text-left group cursor-pointer block">
              <div>
                <span className="text-sm font-semibold text-gray-800 group-hover:text-emerald-700 transition-colors">{h.contractor_name}</span>
                <span className="text-xs text-gray-400 ml-2">{h.city}, {h.state_code}</span>
                {h.tier && <span className={`ml-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${h.tier==='free'?'bg-gray-100 text-gray-700':h.tier==='deep_dive'||h.tier==='forensic'?'bg-emerald-600 text-white':'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{h.tier.replace(/_/g,' ')}</span>}
                {age!=='fresh'&&<span className="ml-2 text-[10px] text-gray-500 font-medium">⏱ {age}</span>}
              </div>
              <div className="flex items-center gap-2.5">
                {h.trust_score != null && <div className={`w-8 h-8 rounded-full ${hr.scoreBg} flex items-center justify-center`}><span className="text-xs font-black text-white">{h.trust_score}</span></div>}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hr.bg} ${hr.text} border ${hr.border}`}>{hr.label}</span>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-emerald-500 transition-colors"/>
              </div>
            </Link>)})}</div>
        </div>}
      </div>
    </div>
  )
}
