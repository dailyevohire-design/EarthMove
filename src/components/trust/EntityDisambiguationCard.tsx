'use client'

/**
 * EntityDisambiguationCard — surfaced when the orchestrator's exact-match
 * round missed but candidate-search found similar entities. Lets the user
 * click through to a canonical legal entity and re-run the report.
 *
 * The click handler is supplied by the parent (ContractorCheckClient
 * re-issues a POST to /api/trust with entity_id + entity_source +
 * original_query). This component is dumb — props in, click out.
 */

import type { EntityCandidate } from '@/lib/trust/scrapers/types'

interface Props {
  candidates: EntityCandidate[]
  query: string
  onSelect: (candidate: EntityCandidate) => void
  onRefine?: () => void
}

function statusBadgeClass(status: string | null): string {
  const s = (status ?? '').trim().toLowerCase()
  if (s === 'good standing' || s === 'a' || s === 'active' || s === 'good_standing') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  }
  if (s === 'delinquent' || s === 'inactive' || s === 'noncompliant') {
    return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
  }
  if (
    s === 'voluntarily dissolved' || s === 'dissolved' ||
    s === 'forfeited' || s === 'withdrawn' ||
    s === 'merged' || s === 'converted'
  ) {
    return 'bg-red-50 text-red-700 ring-1 ring-red-200'
  }
  return 'bg-stone-100 text-stone-700 ring-1 ring-stone-200'
}

function formatStatusLabel(status: string | null): string {
  if (!status) return 'Status unknown'
  return status.length > 0
    ? status[0].toUpperCase() + status.slice(1).toLowerCase()
    : status
}

export default function EntityDisambiguationCard({
  candidates,
  query,
  onSelect,
  onRefine,
}: Props) {
  return (
    <section
      role="region"
      aria-label="Entity disambiguation"
      className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"
    >
      <header className="mb-4">
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-200">
          Did you mean…?
        </span>
        <h2 className="mt-3 text-xl font-semibold text-stone-900">
          No exact match for{' '}
          <span className="text-stone-700">&ldquo;{query}&rdquo;</span> — these registered entities have similar names:
        </h2>
      </header>

      <ul className="space-y-3">
        {candidates.map((c) => (
          <li
            key={`${c.source_key}:${c.entity_id}`}
            className="rounded-xl border border-stone-200 bg-stone-50 p-4"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-stone-900">{c.entity_name}</h3>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass(c.status)}`}
                  >
                    {formatStatusLabel(c.status)}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-600">
                  {c.entity_type && (
                    <>
                      <dt className="font-semibold text-stone-700">Type</dt>
                      <dd>{c.entity_type}</dd>
                    </>
                  )}
                  {c.formation_date && (
                    <>
                      <dt className="font-semibold text-stone-700">Formed</dt>
                      <dd>{c.formation_date}</dd>
                    </>
                  )}
                  {c.principal_address && (
                    <>
                      <dt className="font-semibold text-stone-700">Address</dt>
                      <dd>{c.principal_address}</dd>
                    </>
                  )}
                  {c.registered_agent && (
                    <>
                      <dt className="font-semibold text-stone-700">Registered agent</dt>
                      <dd>{c.registered_agent}</dd>
                    </>
                  )}
                </dl>
              </div>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Run report on this entity →
              </button>
            </div>
          </li>
        ))}
      </ul>

      {onRefine && (
        <div className="mt-5 pt-4 border-t border-stone-200">
          <button
            type="button"
            onClick={onRefine}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            None of these match — refine your search
          </button>
        </div>
      )}

      <p className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">
        Selecting an entity will run a full trust report against the canonical registered name. Your original
        search term will be recorded as part of the report&rsquo;s name-discrepancy fraud signal.
      </p>
    </section>
  )
}
