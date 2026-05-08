'use client'

/**
 * ConfirmationStep — surfaced between dashboard search submit and full
 * report run. Shows the exact-match entity (if any) + top-5 similar
 * candidates. User picks one (or refines the search). The selected
 * candidate's identity flows back to /api/trust as confirmed_from_discovery.
 *
 * Closes the wrong-entity-silent-run failure mode: previously, a typo'd
 * search would either silently match a similar-but-wrong entity (no
 * disambiguation) or run the full pipeline against a non-canonical name.
 * Now the user explicitly confirms the entity before any expensive work.
 *
 * Pure render off props. No fetches. No state machine. The parent
 * (ContractorCheckClient) drives state.
 */

import { useState } from 'react'
import type { EntityCandidate } from '@/lib/trust/scrapers/types'

interface Props {
  query: string
  exactMatch: EntityCandidate | null
  candidates: EntityCandidate[]
  zeroResults: boolean
  onConfirm: (candidate: EntityCandidate) => void
  onSearchAgain: () => void
}

function statusBadgeClass(status: string | null): string {
  const s = (status ?? '').trim().toLowerCase()
  if (s === 'good standing' || s === 'a' || s === 'active') {
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

function CandidateCard({ c, onConfirm, isExact }: { c: EntityCandidate; onConfirm: () => void; isExact?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${isExact ? 'border-emerald-300 bg-emerald-50/30' : 'border-stone-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-stone-900">{c.entity_name}</h3>
            {c.status && (
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass(c.status)}`}>
                {c.status}
              </span>
            )}
            {isExact && (
              <span className="inline-block rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Exact match
              </span>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-600">
            {c.entity_type && (<><dt className="font-semibold text-stone-700">Type</dt><dd>{c.entity_type}</dd></>)}
            {c.formation_date && (<><dt className="font-semibold text-stone-700">Formed</dt><dd>{c.formation_date}</dd></>)}
            {c.principal_address && (<><dt className="font-semibold text-stone-700">Address</dt><dd>{c.principal_address}</dd></>)}
            {c.registered_agent && (<><dt className="font-semibold text-stone-700">Agent</dt><dd>{c.registered_agent}</dd></>)}
          </dl>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          {isExact ? 'Yes, run report on this' : 'Run report on this entity →'}
        </button>
      </div>
    </div>
  )
}

export default function ConfirmationStep({
  query,
  exactMatch,
  candidates,
  zeroResults,
  onConfirm,
  onSearchAgain,
}: Props) {
  const [showSimilar, setShowSimilar] = useState(false)
  const others = candidates.filter((c) => !exactMatch || c.entity_id !== exactMatch.entity_id)

  if (zeroResults) {
    return (
      <section className="rounded-2xl border border-stone-300 bg-white p-6 shadow-sm">
        <header className="mb-3">
          <span className="inline-block rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-200">
            No registered entities found
          </span>
          <h2 className="mt-3 text-xl font-semibold text-stone-900">
            No registered entities found matching{' '}
            <span className="text-stone-700">&ldquo;{query}&rdquo;</span>.
          </h2>
        </header>
        <p className="text-sm text-stone-600 mb-4">
          The contractor may not be registered in this state, may operate under a different legal name,
          or may not have a state-level filing requirement.
        </p>
        <button
          type="button"
          onClick={onSearchAgain}
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Refine search →
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-200">
          Confirm entity
        </span>
        <h2 className="mt-3 text-xl font-semibold text-stone-900">
          {exactMatch
            ? `Did you mean this entity?`
            : `No exact match for "${query}" — these are similar:`}
        </h2>
        {exactMatch && (
          <p className="text-sm text-stone-600 mt-1">
            Confirming runs the full report against the canonical legal name. Your typed query is
            recorded in case the discrepancy itself is a fraud indicator.
          </p>
        )}
      </header>

      <div className="space-y-3">
        {exactMatch && <CandidateCard c={exactMatch} onConfirm={() => onConfirm(exactMatch)} isExact />}
        {!exactMatch && others.map((c) => (
          <CandidateCard key={`${c.source_key}:${c.entity_id}`} c={c} onConfirm={() => onConfirm(c)} />
        ))}
        {exactMatch && others.length > 0 && !showSimilar && (
          <button
            type="button"
            onClick={() => setShowSimilar(true)}
            className="text-sm font-semibold text-stone-600 hover:text-stone-800 underline-offset-2 hover:underline"
          >
            Show {others.length} similar name{others.length === 1 ? '' : 's'} →
          </button>
        )}
        {exactMatch && showSimilar && others.map((c) => (
          <CandidateCard key={`${c.source_key}:${c.entity_id}`} c={c} onConfirm={() => onConfirm(c)} />
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-stone-200">
        <button
          type="button"
          onClick={onSearchAgain}
          className="text-xs font-semibold text-stone-500 hover:text-stone-700 underline-offset-2 hover:underline"
        >
          None of these match — search a different name →
        </button>
      </div>
    </section>
  )
}
