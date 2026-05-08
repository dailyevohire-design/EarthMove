'use client'

import DisambiguationPicker, { type AmbiguousCandidate } from './DisambiguationPicker'
import NoEntityFoundCard from './no-entity-found-card'
import OpenWebFindingsTile, { type OpenWebSection } from './OpenWebFindingsTile'
import RelatedEntitiesPanel from './RelatedEntitiesPanel'
import { expandContractorNameVariants } from '@/lib/trust/name-variants'

// Inline row type — matches select('*') on trust_reports. Kept here rather
// than in types.ts because this view is the only consumer.
export interface TrustReport {
  id: string
  user_id: string | null
  contractor_name: string
  city: string | null
  state_code: string
  tier: string | null
  contractor_id: string | null
  trust_score: number | null
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'AMBIGUOUS' | null
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW' | null
  biz_status: string | null
  biz_entity_type: string | null
  biz_formation_date: string | null
  lic_status: string | null
  lic_license_number: string | null
  bbb_rating: string | null
  bbb_accredited: boolean | null
  bbb_complaint_count: number | null
  review_avg_rating: number | null
  review_total: number | null
  review_sentiment: string | null
  legal_status: string | null
  legal_findings: string[] | null
  osha_status: string | null
  osha_violation_count: number | null
  osha_serious_count: number | null
  red_flags: string[] | null
  positive_indicators: string[] | null
  summary: string | null
  data_sources_searched: string[] | null
  raw_report: Record<string, unknown> | null
  searches_performed: number | null
  processing_ms: number | null
  created_at: string
  report_version: number | null
  evidence_ids: string[] | null
  synthesis_model: string | null
  structured_source_hit_rate: number | null
  data_integrity_status: 'ok' | 'partial' | 'entity_not_found' | 'degraded' | 'failed' | 'entity_disambiguation_required' | null
  /** 227: original user query when canonical legal name differs (populated
   *  via click-through from the disambiguation card). Drives the warning
   *  banner below + powers the name-discrepancy fraud signal. */
  searched_as: string | null
  // 230: open-web aggregates (drives OpenWebFindingsTile sweepRan probe).
  open_web_adverse_count?: number | null
  open_web_positive_count?: number | null
  open_web_corroboration_depth?: number | null
  open_web_recency_min?: number | null
  open_web_engines_used?: string[] | null
}

// ---------- small inline presentational components ----------

function TierBadge({ tier }: { tier: string | null }) {
  const t = (tier ?? '').toLowerCase()
  let cls = 'bg-gray-100 text-gray-700'
  if (t === 'standard' || t === 'plus' || t === 'pro') cls = 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  if (t === 'deep_dive' || t === 'forensic')           cls = 'bg-emerald-600 text-white'
  const label = tier && tier.length > 0 ? tier.replace(/_/g, ' ') : '—'
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  )
}

function RiskPill({ level }: { level: TrustReport['risk_level'] }) {
  // Trust-surface color rules: emerald-only accent; non-emerald reserved for
  // risk semantics. LOW=emerald, MEDIUM=stone (neutral), HIGH=red, CRITICAL=red-deep,
  // AMBIGUOUS=stone. No bright-spectrum accents (amber/blue/orange mid-shades) anywhere.
  const map: Record<string, string> = {
    LOW:        'bg-emerald-50 text-emerald-700 border border-emerald-200',
    MEDIUM:     'bg-stone-100 text-stone-800 border border-stone-300',
    HIGH:       'bg-red-50 text-red-700 border border-red-200',
    CRITICAL:   'bg-red-100 text-red-800 border border-red-300',
    AMBIGUOUS:  'bg-stone-100 text-stone-700 border border-stone-200',
  }
  const label = level ?? 'UNKNOWN'
  const cls = level ? map[level] : 'bg-stone-100 text-stone-700 border border-stone-200'
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  )
}

function ConfidenceLabel({ level }: { level: TrustReport['confidence_level'] }) {
  if (!level) return null
  return (
    <span className="text-xs text-stone-500">
      Confidence: <span className="font-semibold text-stone-700">{level.toLowerCase()}</span>
    </span>
  )
}

function ScoreRing({ score, risk }: { score: number | null; risk: TrustReport['risk_level'] }) {
  const s = score ?? 0
  let color = 'text-stone-400'
  if (score == null) color = 'text-stone-400'
  else if (s >= 80) color = 'text-emerald-600'
  else if (s >= 60) color = 'text-stone-700'
  else color = 'text-red-600'

  const label = score == null
    ? (risk === 'AMBIGUOUS' ? '—' : 'N/A')
    : String(s)

  return (
    <div className="flex flex-col items-center">
      <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center border-current ${color}`}>
        <span className={`text-3xl font-black ${color}`}>{label}</span>
      </div>
      <div className="mt-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider">Trust score</div>
    </div>
  )
}

function Panel({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-stone-100 last:border-0 text-sm">
      <span className="text-stone-500 text-xs">{k}</span>
      <span className="font-medium text-stone-900">{v || <span className="text-stone-400">—</span>}</span>
    </div>
  )
}

function List({ items, emptyText, itemClass }: { items: string[] | null | undefined; emptyText: string; itemClass?: string }) {
  if (!items || items.length === 0) return <p className="text-sm text-stone-500">{emptyText}</p>
  return (
    <ul className="space-y-1.5">
      {items.map((s, i) => (
        <li key={i} className={`text-sm ${itemClass ?? 'text-stone-800'}`}>• {s}</li>
      ))}
    </ul>
  )
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (isNaN(then)) return ''
  const diff = Date.now() - then
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

// State-code → full state name. Drives the explicit "Not registered in
// {STATE} Secretary of State" copy when biz_status is null/Not Found, so
// users see a concrete absence-of-record claim rather than a blank "Unknown".
const STATE_NAMES: Record<string, string> = {
  CO: 'Colorado',
  TX: 'Texas',
}

function formatBizStatus(report: TrustReport): React.ReactNode {
  const s = report.biz_status
  if (s && s !== 'Not Found' && s !== 'Unknown') return s
  const stateName = STATE_NAMES[report.state_code]
  if (!stateName) return s
  return `Not registered in ${stateName} Secretary of State`
}

function formatOshaStatus(report: TrustReport): React.ReactNode {
  const s = report.osha_status
  if (s === 'ERROR') return 'Unknown — lookup error'
  if (s == null) return 'No OSHA inspection records found'
  return s
}

function formatOshaViolations(report: TrustReport): React.ReactNode {
  const n = report.osha_violation_count
  if (n === 0) return 'No safety violations on record'
  return n
}

// ---------- main view ----------

export default function TrustReportView({ report }: { report: TrustReport }) {
  // Entity-not-found branch — short-circuit the standard layout. Triggers when
  // either data_integrity_status is explicitly 'entity_not_found', or the
  // legacy criteria (no score, no biz/lic status, sources were searched).
  // Variant suggestions are stubbed for commit 1; PR #25 wires real variants.
  const isEntityNotFound =
    report.data_integrity_status === 'entity_not_found' ||
    (report.trust_score === null &&
      report.biz_status === null &&
      report.lic_status === null &&
      (report.data_sources_searched?.length ?? 0) > 0)
  if (isEntityNotFound) {
    // Variant suggestions: drop variant[0] (the literal user input that just
    // missed) and pass the rest. expandContractorNameVariants is pure and
    // safe to call client-side.
    const allVariants = expandContractorNameVariants(report.contractor_name, 6)
    const variantSuggestions = allVariants.slice(1, 5)
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <NoEntityFoundCard
            searchedName={report.contractor_name}
            stateCode={report.state_code}
            sourcesSearched={report.data_sources_searched ?? []}
            variantSuggestions={variantSuggestions}
          />
        </div>
      </div>
    )
  }

  const rawCandidates = Array.isArray((report.raw_report as any)?.ambiguous_candidates)
    ? ((report.raw_report as any).ambiguous_candidates as AmbiguousCandidate[])
    : []
  const isAmbiguous = report.risk_level === 'AMBIGUOUS' && rawCandidates.length > 0
  const provisional = isAmbiguous

  const showBbbPanel =
    report.bbb_rating !== null ||
    report.bbb_accredited !== null ||
    report.bbb_complaint_count !== null

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header row */}
        <header className="mb-6 flex flex-wrap items-start gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">{report.contractor_name}</h1>
            <div className="mt-1 text-sm text-stone-500 flex items-center gap-2 flex-wrap">
              <span>
                {report.city ? `${report.city}, ` : ''}{report.state_code}
              </span>
              <span className="text-stone-300">·</span>
              <TierBadge tier={report.tier} />
              <span className="text-stone-300">·</span>
              <span>{relativeTime(report.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RiskPill level={report.risk_level} />
            <ConfidenceLabel level={report.confidence_level} />
          </div>
        </header>

        {/* 227: name-discrepancy banner — surfaces when the user clicked
            through entity disambiguation. The canonical legal name differs
            from what they originally searched. The discrepancy is itself a
            fraud signal (see commit 2 builder projection that pushes the
            matching red_flag), so this banner reinforces that finding at
            the top of the report rather than burying it in the red flags
            list below. */}
        {report.searched_as && report.searched_as !== report.contractor_name && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <span className="font-semibold">⚠ Searched as &ldquo;{report.searched_as}&rdquo;</span>{' '}
            — actual registered entity is &ldquo;{report.contractor_name}&rdquo;. This name discrepancy is itself a risk indicator.
          </div>
        )}

        {isAmbiguous && (
          <div className="mb-6">
            <DisambiguationPicker
              candidates={rawCandidates}
              contractorName={report.contractor_name}
              stateCode={report.state_code}
              city={report.city}
            />
          </div>
        )}

        {provisional && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            Score is provisional until you confirm which business you meant.
          </div>
        )}

        <div className={provisional ? 'opacity-60' : ''}>
          {/* Score card */}
          <section className="rounded-2xl border border-stone-200 bg-white p-6 mb-6 flex items-center gap-6 flex-wrap">
            <ScoreRing score={report.trust_score} risk={report.risk_level} />
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-stone-900">Trust assessment</h2>
                <RiskPill level={report.risk_level} />
              </div>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                {report.summary ?? 'No summary available.'}
              </p>
            </div>
          </section>

          {/* 230: Open Web Findings — dual-engine layer (Perplexity sweep
              + Claude verify + cross-engine corroboration). Patent claim 6.
              Renders above the data panels because corroborated open-web
              signals are the highest-signal element of the report. */}
          <div className="mb-6">
            <OpenWebFindingsTile
              openWeb={(report.raw_report as { open_web?: OpenWebSection } | null)?.open_web ?? null}
              sweepRan={(report.open_web_engines_used?.length ?? 0) > 0
                || (report.open_web_adverse_count ?? 0) > 0
                || (report.open_web_positive_count ?? 0) > 0}
            />
          </div>

          {/* 231: phoenix detector / cross-entity fraud-network panel.
              Renders only when raw_report.related_entities has rows. */}
          {(() => {
            const related = (report.raw_report as { related_entities?: Array<Record<string, unknown>> } | null)?.related_entities
            if (!related || related.length === 0) return null
            return (
              <div className="mb-6">
                <RelatedEntitiesPanel relatedEntities={related as unknown as Parameters<typeof RelatedEntitiesPanel>[0]['relatedEntities']} />
              </div>
            )
          })()}

          {/* Data panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Panel title="Business Registration" icon="🏛">
              <Row k="Status"    v={formatBizStatus(report)} />
              <Row k="Entity"    v={report.biz_entity_type} />
              <Row k="Formed"    v={report.biz_formation_date} />
            </Panel>

            <Panel title="License" icon="📋">
              <Row k="Status"    v={report.lic_status} />
              <Row k="License #" v={report.lic_license_number} />
            </Panel>

            {showBbbPanel && (
              <Panel title="BBB Profile" icon="🛡">
                <Row k="Rating"      v={report.bbb_rating} />
                <Row k="Accredited"  v={report.bbb_accredited == null ? null : (report.bbb_accredited ? 'Yes' : 'No')} />
                <Row k="Complaints"  v={report.bbb_complaint_count} />
              </Panel>
            )}

            <Panel title="Reviews" icon="⭐">
              <Row k="Avg rating" v={report.review_avg_rating == null ? null : `${report.review_avg_rating}/5.0`} />
              <Row k="Total"      v={report.review_total} />
              <Row k="Sentiment"  v={report.review_sentiment} />
            </Panel>

            <Panel title="Legal Records" icon="⚖">
              <List
                items={report.legal_findings}
                emptyText="No lawsuits, liens, or judgments surfaced in public records. This is not an exhaustive search — county-level civil dockets often require manual lookup."
              />
              <p className="mt-3 text-[11px] text-stone-500 leading-relaxed">
                This report compiles publicly available information and does not constitute a consumer report under FCRA.
              </p>
            </Panel>

            <Panel title="OSHA Safety" icon="🔶">
              <Row k="Status"      v={formatOshaStatus(report)} />
              <Row k="Violations"  v={formatOshaViolations(report)} />
              <Row k="Serious"     v={report.osha_serious_count} />
            </Panel>

            <Panel title="Risk Signals" icon="⚠">
              <List
                items={report.red_flags}
                emptyText="No risk signals identified."
                itemClass="text-red-700"
              />
            </Panel>

            <Panel title="Positive Indicators" icon="✓">
              <List
                items={report.positive_indicators}
                emptyText="No positive indicators noted."
                itemClass="text-emerald-700"
              />
            </Panel>
          </div>

          {/* Summary */}
          <Panel title="Summary" icon="📝">
            <p className="text-sm text-stone-800 leading-relaxed">
              {report.summary ?? 'No summary available.'}
            </p>
          </Panel>
        </div>

        {/* Footer meta */}
        <footer className="mt-8 pt-4 border-t border-stone-200 text-[11px] text-stone-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>{report.searches_performed ?? 0} searches</span>
          <span>·</span>
          <span>{(report.data_sources_searched ?? []).length} sources</span>
          <span>·</span>
          <span>{report.processing_ms ? `${(report.processing_ms / 1000).toFixed(1)}s` : '—'}</span>
          <span>·</span>
          <span>{report.synthesis_model ?? 'unknown model'}</span>
          <span>·</span>
          <span>{new Date(report.created_at).toLocaleString()}</span>
        </footer>
      </div>
    </div>
  )
}
