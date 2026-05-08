/**
 * EntityConfirmationBanner — surfaces the entity the report matched, prominently,
 * at the top of every report. Lets the user catch wrong-entity matches at a glance
 * (D2 from the launch readiness review).
 *
 * Three states + two non-renders:
 *   Case A — direct exact match   → emerald header "✓ Report matched to:"
 *   Case B — click-through        → amber header "⚠ Searched as ... — confirmed entity:"
 *   Case C — disambiguation_required → returns null (EntityDisambiguationCard renders)
 *   Case D — entity_not_found     → returns null (NoEntityFoundCard renders)
 *
 * SSR-safe: pure render off props, no useEffect, no hooks.
 */

import Link from 'next/link'

interface BusinessRaw {
  entity_name?: string | null
  entity_type?: string | null
  entity_id?: string | null
  formation_date?: string | null
  jurisdiction?: string | null
  status?: string | null
  principal_address?: string | null
  registered_agent?: string | null
  source_url?: string | null
}

interface SourceCited {
  source_key?: string
  pulled_at?: string | null
}

interface RawReport {
  business?: BusinessRaw | null
  name_discrepancy?: { searched_as?: string | null; canonical_name?: string | null } | null
  disambiguation?: { candidates?: unknown[]; query?: string | null } | null
  sources_cited?: SourceCited[] | null
}

export interface TrustReportLike {
  contractor_name?: string | null
  state_code?: string | null
  searched_as?: string | null
  data_integrity_status?: string | null
  raw_report?: RawReport | null
}

interface Props {
  report: TrustReportLike
  /** Optional reset hook surfaced as the "Not the right company?" link. */
  onReset?: () => void
}

function statusBadgeClass(status: string | null | undefined): string {
  const s = (status ?? '').trim().toLowerCase()
  if (s === 'good standing' || s === 'active' || s === 'a') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  }
  if (s === 'delinquent' || s === 'inactive' || s === 'noncompliant') {
    return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
  }
  if (
    s === 'voluntarily dissolved' || s === 'dissolved' ||
    s === 'forfeited' || s === 'cancelled' || s === 'canceled' ||
    s === 'withdrawn' || s === 'merged' || s === 'converted'
  ) {
    return 'bg-red-50 text-red-700 ring-1 ring-red-200'
  }
  return 'bg-stone-100 text-stone-700 ring-1 ring-stone-200'
}

function jurisdictionLabelForSourceUrl(jurisdiction: string | null | undefined): string {
  const j = (jurisdiction ?? '').trim().toUpperCase()
  if (j === 'CO') return 'Colorado Secretary of State'
  if (j === 'TX') return 'Texas Comptroller of Public Accounts'
  return 'state business registry'
}

function fallbackSourceUrl(jurisdiction: string | null | undefined): string {
  const j = (jurisdiction ?? '').trim().toUpperCase()
  if (j === 'CO') return 'https://www.coloradosos.gov/biz/'
  if (j === 'TX') return 'https://mycpa.cpa.state.tx.us/coa/'
  return '#'
}

function formatPulledAt(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export default function EntityConfirmationBanner({ report, onReset }: Props) {
  const status = report.data_integrity_status
  // Case D — entity_not_found / no business object: don't render.
  // Case C — disambiguation: don't render.
  if (status === 'entity_not_found' || status === 'entity_disambiguation_required') {
    return null
  }
  const business = report.raw_report?.business
  if (!business || !business.entity_name) return null

  const searched = report.searched_as ?? null
  const canonical = report.contractor_name ?? business.entity_name
  const isClickThrough = !!searched && searched.trim().length > 0 &&
    searched.trim().toLowerCase() !== (canonical ?? '').trim().toLowerCase()

  const accent = isClickThrough ? 'border-t-amber-500' : 'border-t-emerald-500'
  const kicker = isClickThrough
    ? `⚠ Searched as "${searched}" — confirmed entity:`
    : '✓ Report matched to:'

  // Source line: prefer SOS source_url + matching sources_cited.pulled_at.
  const sosCited = (report.raw_report?.sources_cited ?? []).find(
    (s) => s.source_key === 'co_sos_biz' || s.source_key === 'tx_sos_biz',
  )
  const pulledAt = formatPulledAt(sosCited?.pulled_at)
  const sourceLabel = jurisdictionLabelForSourceUrl(business.jurisdiction)
  const sourceUrl = business.source_url ?? fallbackSourceUrl(business.jurisdiction)

  return (
    <section
      role="region"
      aria-label="Entity match confirmation"
      className={`rounded-2xl border ${accent} border-t-4 border-stone-200 bg-white p-5 shadow-sm`}
    >
      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-3">
        {kicker}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        {/* Left col */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-stone-900">{business.entity_name}</h2>
            {business.status && (
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass(business.status)}`}
              >
                {business.status}
              </span>
            )}
          </div>
          {business.entity_type && (
            <p className="text-sm text-stone-600 mt-1">{business.entity_type}</p>
          )}
          {business.formation_date && (
            <p className="text-xs text-stone-500 mt-1">Formed {business.formation_date}</p>
          )}
        </div>

        {/* Right col */}
        <div className="text-sm text-stone-600 space-y-1">
          {business.principal_address && (
            <div>
              <span className="font-semibold text-stone-700">Address: </span>
              {business.principal_address}
            </div>
          )}
          {business.registered_agent && (
            <div>
              <span className="font-semibold text-stone-700">Registered agent: </span>
              {business.registered_agent}
            </div>
          )}
          {business.entity_id && (
            <div className="font-mono text-xs text-stone-500">
              Entity ID: {business.entity_id}
            </div>
          )}
        </div>
      </div>

      {isClickThrough && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong className="font-semibold">Name discrepancy is itself a fraud indicator.</strong>{' '}
          Confirm directly with the contractor that this is their registered legal entity.
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
        <span>
          Source: {sourceLabel}
          {pulledAt && ` · pulled ${pulledAt}`}
        </span>
        {sourceUrl !== '#' && (
          <Link
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Verify on official record →
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            if (onReset) onReset()
            else if (typeof window !== 'undefined') window.history.back()
          }}
          className="ml-auto text-stone-500 hover:text-stone-700 underline-offset-2 hover:underline"
        >
          Not the right company? Search a different name →
        </button>
      </div>
    </section>
  )
}
