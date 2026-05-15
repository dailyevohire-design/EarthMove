/**
 * OpenWebFindingsTile — surfaces the dual-engine open-web layer
 * (Perplexity sweep + Claude web_search verify + cross-engine corroboration).
 * Patent claim 6 footer.
 *
 * Renders four states:
 *   - Independently corroborated (depth >= 2, mostly adverse) → emerald
 *     prominence with "Independently confirmed by N engines" badge.
 *   - Single-engine signals only → muted with "Single source — verify
 *     directly" framing.
 *   - No signals (engines ran, found nothing) → reassuring "Public web
 *     surfaced no adverse findings".
 *   - Sweep disabled (free tier with no API key configured) →
 *     not_searched_link_out variant pointing at the upgrade page.
 */

import Link from 'next/link'

interface AdverseFinding {
  summary: string
  citation_url: string | null
  published_date: string | null
}

interface CorroborationEvent {
  summary: string
  shared_url: string | null
  method: string | null
  direction: string | null
}

export interface OpenWebSection {
  summary: string
  adverse_findings: AdverseFinding[]
  positive_findings: AdverseFinding[]
  corroboration_events: CorroborationEvent[]
  corroboration_depth: number
  engines_used: string[]
  newest_finding_age_minutes: number | null
  adverse_count: number
  positive_count: number
}

interface Props {
  openWeb: OpenWebSection | null
  /** When openWeb is null AND the orchestrator was able to run the sweep,
   *  pass empty + corroborationDepth=0 to render the "no signals" reassurance.
   *  When the orchestrator skipped the sweep entirely (free tier, no key),
   *  pass null and the tile renders the upgrade-link variant. */
  sweepRan?: boolean
}

function relativeAgeFromMinutes(minutes: number | null): string {
  if (minutes == null) return ''
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  return `${Math.round(months / 12)} year ago`
}

function CorroborationBadge({ depth }: { depth: number }) {
  if (depth >= 3) {
    return (
      <span className="inline-block rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
        Independently confirmed by {depth}+ engines
      </span>
    )
  }
  if (depth === 2) {
    return (
      <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-200">
        Independently confirmed by 2 engines
      </span>
    )
  }
  return (
    <span className="inline-block rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-600 ring-1 ring-stone-200">
      Single source
    </span>
  )
}

export default function OpenWebFindingsTile({ openWeb, sweepRan = true }: Props) {
  if (!openWeb && !sweepRan) {
    // Sweep disabled (no API key, or tier explicitly opt-out).
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <header className="mb-3">
          <span className="inline-block rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500 ring-1 ring-stone-200">
            Open Web Findings
          </span>
          <h2 className="mt-2 text-base font-semibold text-stone-900">Open-web search not run for this tier.</h2>
        </header>
        <p className="text-sm text-stone-600">
          Upgrade to Standard ($0.19) for Perplexity grounded research + Claude web verification of every adverse hit.
        </p>
        <Link
          href="/dashboard/gc/contractors"
          className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Upgrade →
        </Link>
      </section>
    )
  }

  if (!openWeb || (openWeb.adverse_count === 0 && openWeb.positive_count === 0 && openWeb.corroboration_depth === 0)) {
    // Engines ran, found no notable signals.
    return (
      <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <header className="mb-3">
          <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-200">
            Open Web Findings
          </span>
          <h2 className="mt-2 text-base font-semibold text-stone-900">Public web surfaced no adverse findings.</h2>
        </header>
        <p className="text-sm text-stone-600">
          Engines used: {openWeb?.engines_used?.length ? openWeb.engines_used.join(', ') : 'Perplexity'}. Recency: 12-month window.
        </p>
      </section>
    )
  }

  const isCorroborated = openWeb.corroboration_depth >= 2
  return (
    <section className={`rounded-2xl border ${isCorroborated ? 'border-emerald-300' : 'border-stone-200'} bg-white p-6 shadow-sm`}>
      <header className="mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="inline-block rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 ring-1 ring-stone-200">
            Open Web Findings · Perplexity + Claude
          </span>
          <CorroborationBadge depth={openWeb.corroboration_depth} />
        </div>
        <p className="mt-3 text-sm text-stone-700">{openWeb.summary}</p>
      </header>

      {openWeb.adverse_findings.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Adverse signals</h3>
          <ul className="space-y-2">
            {openWeb.adverse_findings.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                <div className="flex-1">
                  <p>{f.summary}</p>
                  {f.citation_url && (
                    <Link href={f.citation_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 hover:text-emerald-800">
                      {f.citation_url} ↗
                    </Link>
                  )}
                  {f.published_date && (
                    <span className="ml-2 text-[11px] text-stone-500">
                      {new Date(f.published_date).toISOString().slice(0, 10)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {openWeb.positive_findings.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Positive signals</h3>
          <ul className="space-y-2">
            {openWeb.positive_findings.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <div className="flex-1">
                  <p>{f.summary}</p>
                  {f.citation_url && (
                    <Link href={f.citation_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 hover:text-emerald-800">
                      {f.citation_url} ↗
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 leading-relaxed">
        {openWeb.newest_finding_age_minutes != null && `Newest finding: ${relativeAgeFromMinutes(openWeb.newest_finding_age_minutes)} · `}
        Sources: {openWeb.engines_used.join(' + ')}
        {openWeb.corroboration_depth >= 2 && ' · Cross-engine corroboration is a Groundcheck patent-pending method (multiple U.S. Provisional Applications)'}
      </p>
    </section>
  )
}
