/**
 * NoEntityFoundCard — rendered in place of the standard trust report when
 * `data_integrity_status === 'entity_not_found'`. Surfaces:
 *   - what name + state we searched
 *   - which sources we checked (so the absence is auditable)
 *   - suggested name variants the user can try (commit 1 stubs these;
 *     PR #25 wires real variants from expandContractorNameVariants)
 *   - external-search shortcut links (BBB / Google Business Profile / SOS)
 *   - disclaimer that absence ≠ clean record
 *
 * Matches the visual language of the standard report cards (rounded-2xl,
 * stone-on-paper neutrals; amber accent reserved for "we couldn't conclude"
 * states, mirroring DisambiguationPicker).
 */

import Link from 'next/link'
import type { EntityCandidate } from '@/lib/trust/scrapers/types'
import EntityDisambiguationCard from './EntityDisambiguationCard'

interface Props {
  searchedName: string
  stateCode: string
  sourcesSearched: string[]
  variantSuggestions: string[]
  /** 227: when the orchestrator's disambiguation fallback found similar
   *  registered entities, render <EntityDisambiguationCard /> instead of
   *  the no-found UI. */
  candidates?: EntityCandidate[]
  onSelectCandidate?: (candidate: EntityCandidate) => void
}

function externalSearchUrls(name: string, stateCode: string): Array<{ label: string; href: string }> {
  const q = encodeURIComponent(name)
  const out: Array<{ label: string; href: string }> = [
    { label: 'BBB',       href: `https://www.bbb.org/search?find_text=${q}` },
    { label: 'Google',    href: `https://www.google.com/search?q=${q}+${encodeURIComponent(stateCode)}+contractor` },
  ]
  // State-specific business search for CO + TX (the launch markets). Other
  // states fall back to a Google site:gov search.
  const sosByState: Record<string, { label: string; href: string }> = {
    CO: { label: 'Colorado SOS',    href: `https://www.coloradosos.gov/biz/BusinessEntityCriteriaExt.do` },
    TX: { label: 'Texas Comptroller', href: `https://mycpa.cpa.state.tx.us/coa/Index.html` },
  }
  if (sosByState[stateCode.toUpperCase()]) {
    out.push(sosByState[stateCode.toUpperCase()])
  } else {
    out.push({ label: `${stateCode} SOS`, href: `https://www.google.com/search?q=${q}+site%3A.gov+secretary+of+state` })
  }
  return out
}

export default function NoEntityFoundCard({
  searchedName,
  stateCode,
  sourcesSearched,
  variantSuggestions,
  candidates,
  onSelectCandidate,
}: Props) {
  // 227: prefer EntityDisambiguationCard when similar entities exist.
  // The standard no-found UI is the fallback for the genuine
  // entity_not_found case (no candidates, no near-matches anywhere).
  if (candidates && candidates.length > 0 && onSelectCandidate) {
    return (
      <EntityDisambiguationCard
        candidates={candidates}
        query={searchedName}
        onSelect={onSelectCandidate}
      />
    )
  }
  const externalLinks = externalSearchUrls(searchedName, stateCode)
  return (
    <section
      role="region"
      aria-label="No public business record found"
      className="rounded-2xl border border-stone-300 bg-white p-6 shadow-sm"
    >
      <header className="mb-4">
        <span className="inline-block rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-200">
          No record found
        </span>
        <h2 className="mt-3 text-xl font-semibold text-stone-900">
          We didn&rsquo;t find a public business record matching{' '}
          <span className="text-stone-700">&ldquo;{searchedName}&rdquo;</span> in {stateCode}.
        </h2>
      </header>

      {sourcesSearched.length > 0 && (
        <div className="mb-5 text-sm text-stone-600">
          <p className="mb-1 font-semibold text-stone-700">We checked:</p>
          <ul className="flex flex-wrap gap-2">
            {sourcesSearched.map((s) => (
              <li
                key={s}
                className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-mono text-stone-700"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {variantSuggestions.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold text-stone-700">Try a name variant:</p>
          <ul className="space-y-1">
            {variantSuggestions.map((v) => (
              <li key={v} className="text-sm text-stone-700">
                <span className="font-medium text-emerald-700">{v}</span>
                <span className="ml-2 text-xs text-stone-400">— click-to-search lands in PR #25</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-5">
        <p className="mb-2 text-sm font-semibold text-stone-700">Check elsewhere:</p>
        <ul className="flex flex-wrap gap-2">
          {externalLinks.map((l) => (
            <li key={l.label}>
              <Link
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md border border-stone-300 px-3 py-1 text-sm text-stone-700 hover:bg-stone-50"
              >
                {l.label} ↗
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="rounded-md border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">
        <strong className="font-semibold text-stone-700">Absence of public records is not a clean record.</strong>{' '}
        Some legitimate businesses operate without formal registration, and some bad actors operate under
        unregistered or just-formed entities. Use this signal alongside in-person verification — verify the
        license, request proof of insurance, and meet the principals on-site before contracting.
      </p>
    </section>
  )
}
