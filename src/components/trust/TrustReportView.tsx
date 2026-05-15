'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { telemetry } from '@/lib/telemetry'
import EntityConfirmationBanner from './EntityConfirmationBanner'
import EntityDisambiguationCard from './EntityDisambiguationCard'
import type { EntityCandidate } from '@/lib/trust/scrapers/types'
import NoEntityFoundCard from './no-entity-found-card'
import OpenWebFindingsTile, { type OpenWebSection } from './OpenWebFindingsTile'
import RelatedEntitiesPanel from './RelatedEntitiesPanel'
import ScoreExplanationCard, { type ScoreBreakdownProps } from './ScoreExplanationCard'
import type { IndustryBaseline } from '@/lib/trust/industry-baseline'
import { expandContractorNameVariants } from '@/lib/trust/name-variants'
import {
  deriveBusinessTile,
  deriveLicensingTile,
  deriveBbbTile,
  deriveReviewsTile,
  deriveLegalTile,
  deriveOshaTile,
  type TileDisplay,
  type TileTone,
} from '@/lib/trust/tile-status'
import {
  tileProvenance,
  tileProvenanceMulti,
  type TileProvenance,
} from '@/lib/trust/tile-provenance'

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
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null
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
  // 231: score explanation + industry baseline (jsonb columns).
  score_breakdown?: ScoreBreakdownProps | null
  industry_baseline?: IndustryBaseline | null
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
  // risk semantics. LOW=emerald, MEDIUM=stone (neutral), HIGH=red, CRITICAL=red-deep.
  // No bright-spectrum accents (amber/blue/orange mid-shades) anywhere.
  const map: Record<string, string> = {
    LOW:        'bg-emerald-50 text-emerald-700 border border-emerald-200',
    MEDIUM:     'bg-stone-100 text-stone-800 border border-stone-300',
    HIGH:       'bg-red-50 text-red-700 border border-red-200',
    CRITICAL:   'bg-red-100 text-red-800 border border-red-300',
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

function ScoreRing({ score }: { score: number | null }) {
  const s = score ?? 0
  let color = 'text-stone-400'
  if (score == null) color = 'text-stone-400'
  else if (s >= 80) color = 'text-emerald-600'
  else if (s >= 60) color = 'text-stone-700'
  else color = 'text-red-600'

  const label = score == null ? 'N/A' : String(s)

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

// D5: tile pill driven by tile-status helpers. Replaces misleading blanks
// (em-dashes when a field is null) with verified/clean/not_applicable/
// not_searched language that explains why a panel is empty. Tooltip surfaces
// the long-form explanation on hover.
const TONE_CLASSES: Record<TileTone, string> = {
  verified: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  clean: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  not_applicable: 'bg-stone-50 text-stone-600 ring-1 ring-stone-200',
  not_searched: 'bg-stone-100 text-stone-500 ring-1 ring-stone-200',
  // 229: muted-but-clickable for link-out tiles (e.g. bbb.org search URL).
  not_searched_link_out: 'bg-stone-100 text-emerald-700 ring-1 ring-stone-200 hover:bg-stone-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  critical: 'bg-red-50 text-red-700 ring-1 ring-red-200',
}

function TilePill({ tile, provenance }: { tile: TileDisplay; provenance?: TileProvenance }) {
  const pill = (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE_CLASSES[tile.tone]}`}
      title={tile.tooltipText ?? undefined}
    >
      {tile.statusLabel}
    </span>
  )
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 flex-wrap">
        {tile.tone === 'not_searched_link_out' && tile.linkOutUrl ? (
          <a
            href={tile.linkOutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
          >
            {pill}
            <span className="text-emerald-700">↗</span>
          </a>
        ) : pill}
        {tile.bodyText && (
          <span className="text-xs text-stone-600">{tile.bodyText}</span>
        )}
      </div>
      {provenance && <ProvenanceFooter provenance={provenance} tileTone={tile.tone} />}
    </div>
  )
}

function ProvenanceFooter({ provenance, tileTone }: { provenance: TileProvenance; tileTone: TileTone }) {
  // For not_searched tones, surface "Not searched in this tier" instead of
  // a stale-looking timestamp. Sets correct expectations vs. implying we
  // looked but found nothing.
  if (provenance.status === 'not_searched' || tileTone === 'not_searched' || tileTone === 'not_searched_link_out' || tileTone === 'not_applicable') {
    return (
      <p className="mt-1.5 text-[11px] text-stone-400">
        Source: {provenance.displayName} · Not searched in this tier
      </p>
    )
  }
  return (
    <p className="mt-1.5 text-[11px] text-stone-500">
      Source: {provenance.displayName}
      {provenance.pulledAtRelative && ` · Pulled ${provenance.pulledAtRelative}`}
      {provenance.citationUrl && (
        <>
          {' · '}
          <a
            href={provenance.citationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 hover:text-emerald-800"
          >
            Verify on official record →
          </a>
        </>
      )}
    </p>
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

// State-keyed provenance lookups. For Business Registration and License
// panels, the source_key depends on which state's registry/board ran.
function sosKeyForState(stateCode: string | null): string {
  switch ((stateCode ?? '').toUpperCase()) {
    case 'CO': return 'co_sos_biz'
    case 'TX': return 'tx_sos_biz'
    case 'FL': return 'fl_sunbiz'
    case 'CA': return 'ca_sos_biz'
    case 'NY': return 'ny_sos_biz'
    case 'WA': return 'wa_sos_biz'
    case 'OR': return 'or_sos_biz'
    case 'NC': return 'nc_sos_biz'
    case 'GA': return 'ga_sos_biz'
    case 'AZ': return 'az_ecorp'
    default: return 'co_sos_biz' // launch markets default
  }
}
function licenseKeyForState(stateCode: string | null): string {
  switch ((stateCode ?? '').toUpperCase()) {
    case 'CO': return 'co_dora'
    case 'TX': return 'tx_tdlr'
    case 'CA': return 'cslb_ca'
    case 'OR': return 'ccb_or'
    case 'AZ': return 'roc_az'
    case 'WA': return 'lni_wa'
    case 'FL': return 'dbpr_fl'
    case 'NC': return 'nclbgc_nc'
    default: return 'co_dora'
  }
}

// STATE_NAMES + formatBizStatus + formatOshaStatus deleted in D5 — superseded by
// deriveBusinessTile + deriveOshaTile from src/lib/trust/tile-status.ts.
// formatOshaViolations retained because it formats the violation count
// row (separate from the status pill).

function formatOshaViolations(report: TrustReport): React.ReactNode {
  const n = report.osha_violation_count
  if (n === 0) return 'No safety violations on record'
  return n
}

// ---------- main view ----------

export default function TrustReportView({ report }: { report: TrustReport }) {
  const router = useRouter()

  // subject_id sourced from report.contractor_id — TrustReport has no
  // subject_id field; contractor_id is the entity being checked.
  useEffect(() => {
    telemetry.emit('groundcheck.report_viewed', {
      subject_id: report?.contractor_id ?? null,
      report_id: report?.id ?? null,
      tier: report?.tier ?? null,
    })
  }, [report?.id, report?.contractor_id, report?.tier])

  // Entity-disambiguation-required branch — orchestrator found similar
  // candidates but no exact match. raw_report.disambiguation is projected
  // by buildEvidenceDerivedReport from the 'entity_disambiguation_candidates'
  // evidence row. Re-running with a picked candidate routes through the
  // /dashboard/gc/contractors entry point (matches ContractorCheckClient's
  // entity_id + entity_source param shape).
  if (report.data_integrity_status === 'entity_disambiguation_required') {
    const disambig = (report.raw_report as { disambiguation?: { candidates?: EntityCandidate[]; query?: string } } | null)?.disambiguation
    const candidates = disambig?.candidates ?? []
    const query = disambig?.query ?? report.contractor_name ?? ''
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <EntityDisambiguationCard
            candidates={candidates}
            query={query}
            onSelect={(candidate) => {
              const params = new URLSearchParams({
                prefill: query,
                entity_id: candidate.entity_id,
                entity_source: candidate.source_key,
              })
              router.push(`/dashboard/gc/contractors?${params.toString()}`)
            }}
          />
        </div>
      </div>
    )
  }

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

  const showBbbPanel =
    report.bbb_rating !== null ||
    report.bbb_accredited !== null ||
    report.bbb_complaint_count !== null

  const showStamp = (report.trust_score ?? 0) >= 80
  const shortReportId = report.id.replace(/-/g, '').slice(0, 8).toUpperCase()

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Brand band — matches TrustPdfDocument header (wordmark left,
            report id right, conditional verified stamp). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="relative mb-6 rounded-2xl bg-[#F5F1E8] border border-stone-300/40 px-6 py-5 flex items-center justify-between">
          <img
            src="/brand/groundcheck-wordmark.png"
            alt="Groundcheck"
            className="h-7 w-auto"
          />
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-stone-500">Report</div>
            <div className="text-xs font-mono text-[#0E2A22] mt-0.5">{shortReportId}</div>
          </div>
          {showStamp && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/brand/groundcheck-stamp.png"
              alt="Verified contractor"
              className="absolute -top-3 right-24 h-16 w-16 pointer-events-none rotate-[-8deg]"
            />
          )}
        </div>

        {/* Subject identity row */}
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

        <div>
          {/* Entity confirmation banner — surfaces the matched entity above
              the score so wrong-entity reports are catchable at a glance.
              Self-handles state branching (returns null for entity_not_found
              + entity_disambiguation_required). */}
          <div className="mb-4">
            <EntityConfirmationBanner report={report} />
          </div>
          {/* Score card */}
          <section className="rounded-2xl border border-stone-200 bg-white p-6 mb-6 flex items-center gap-6 flex-wrap">
            <ScoreRing score={report.trust_score} />
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

          {/* 231: score explanation + industry baseline. Renders below
              the score card so users see *why* the score is what it is. */}
          <div className="mb-6">
            <ScoreExplanationCard
              breakdown={report.score_breakdown ?? null}
              baseline={report.industry_baseline ?? null}
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

          {/* Data panels — each tile gets a provenance footer (source +
              pulled-at + verify link) so the user can trace every claim
              back to the official record. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Panel title="Business Registration" icon="🏛">
              <TilePill
                tile={deriveBusinessTile(report)}
                provenance={tileProvenance(report, sosKeyForState(report.state_code))}
              />
              <Row k="Entity"    v={report.biz_entity_type} />
              <Row k="Formed"    v={report.biz_formation_date} />
            </Panel>

            <Panel title="License" icon="📋">
              <TilePill
                tile={deriveLicensingTile(report)}
                provenance={tileProvenance(report, licenseKeyForState(report.state_code))}
              />
              <Row k="License #" v={report.lic_license_number} />
            </Panel>

            {showBbbPanel && (
              <Panel title="BBB Profile" icon="🛡">
                <TilePill
                  tile={deriveBbbTile(report)}
                  provenance={tileProvenanceMulti(report, ['bbb_profile', 'bbb_link_check'])}
                />
                <Row k="Accredited"  v={report.bbb_accredited == null ? null : (report.bbb_accredited ? 'Yes' : 'No')} />
                <Row k="Complaints"  v={report.bbb_complaint_count} />
              </Panel>
            )}

            <Panel title="Reviews" icon="⭐">
              <TilePill
                tile={deriveReviewsTile(report)}
                provenance={tileProvenance(report, 'google_reviews')}
              />
              <Row k="Total"      v={report.review_total} />
              <Row k="Sentiment"  v={report.review_sentiment} />
            </Panel>

            <Panel title="Legal Records" icon="⚖">
              <TilePill
                tile={deriveLegalTile(report)}
                provenance={tileProvenanceMulti(report, ['courtlistener_fed', 'state_ag_enforcement'])}
              />
              <List
                items={report.legal_findings}
                emptyText="No lawsuits, liens, or judgments surfaced in public records. This is not an exhaustive search — county-level civil dockets often require manual lookup."
              />
              <p className="mt-3 text-[11px] text-stone-500 leading-relaxed">
                This report compiles publicly available information and does not constitute a consumer report under FCRA.
              </p>
            </Panel>

            <Panel title="OSHA Safety" icon="🔶">
              <TilePill
                tile={deriveOshaTile(report)}
                provenance={tileProvenance(report, 'osha_est_search')}
              />
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

        {/* Brand footer — matches TrustPdfDocument attribution line */}
        <footer className="mt-10 rounded-2xl bg-[#F5F1E8] border border-stone-300/40 px-6 py-4 text-center">
          <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#0E2A22]">
            Earth Pro Connect LLC · earthmove.io/trust
          </div>
        </footer>

        {/* Run meta — kept as muted detail below the brand line */}
        <div className="mt-3 mb-2 text-[11px] text-stone-400 flex flex-wrap gap-x-3 gap-y-1 justify-center">
          <span>{report.searches_performed ?? 0} searches</span>
          <span>·</span>
          <span>{(report.data_sources_searched ?? []).length} sources</span>
          <span>·</span>
          <span>{report.processing_ms ? `${(report.processing_ms / 1000).toFixed(1)}s` : '—'}</span>
          <span>·</span>
          <span>{report.synthesis_model ?? 'unknown model'}</span>
          <span>·</span>
          <span>{new Date(report.created_at).toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
