/**
 * RelatedEntitiesPanel — surfaces phoenix-LLC + cross-entity fraud-network
 * findings (patent claim 1).
 *
 * Three render groups by relationship_type:
 *   phoenix_signal → red border, severe alert (operator dissolved an
 *     entity then reincarnated under a new one).
 *   same_operator → amber border, soft warning (operator runs multiple
 *     active entities under the same agent/officer).
 *   address_neighbor → gray, informational (could be coincidence).
 *
 * Returns null when relatedEntities is empty/missing.
 */

import Link from 'next/link'

interface RelatedEntity {
  entity_name: string | null
  entity_id: string | null
  status: string | null
  formation_date: string | null
  dissolution_date: string | null
  shared_indicator: 'address' | 'officer' | 'agent' | null
  relationship_type: 'phoenix_signal' | 'same_operator' | 'address_neighbor' | null
  source_url: string | null
}

interface Props {
  relatedEntities: RelatedEntity[] | null | undefined
}

function GroupHeader({ kind, count }: { kind: 'phoenix_signal' | 'same_operator' | 'address_neighbor'; count: number }) {
  if (kind === 'phoenix_signal') {
    return (
      <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">
        ⚠ Possible Phoenix-LLC Pattern ({count})
      </h3>
    )
  }
  if (kind === 'same_operator') {
    return (
      <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
        Same Operator — Confirm Which Entity ({count})
      </h3>
    )
  }
  return (
    <h3 className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
      Address Neighbors ({count})
    </h3>
  )
}

function EntityRow({ e }: { e: RelatedEntity }) {
  const statusLower = (e.status ?? '').trim().toLowerCase()
  const isDissolved = ['dissolved', 'voluntarily dissolved', 'forfeited', 'cancelled', 'withdrawn'].includes(statusLower)
  const statusBadge = isDissolved
    ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
    : statusLower === 'good standing' || statusLower === 'active'
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
      : 'bg-stone-100 text-stone-700 ring-1 ring-stone-200'
  return (
    <li className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-stone-900">{e.entity_name ?? 'Unknown'}</span>
            {e.status && (
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadge}`}>
                {e.status}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {e.formation_date && <>Formed {e.formation_date}</>}
            {e.dissolution_date && <> · Dissolved {e.dissolution_date}</>}
            {e.shared_indicator && <> · Shared {e.shared_indicator}</>}
          </div>
        </div>
        {e.source_url && (
          <Link href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            Source ↗
          </Link>
        )}
      </div>
    </li>
  )
}

export default function RelatedEntitiesPanel({ relatedEntities }: Props) {
  if (!relatedEntities || relatedEntities.length === 0) return null

  const phoenix = relatedEntities.filter((e) => e.relationship_type === 'phoenix_signal')
  const sameOp = relatedEntities.filter((e) => e.relationship_type === 'same_operator')
  const neighbors = relatedEntities.filter((e) => e.relationship_type === 'address_neighbor')

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
      <header>
        <span className="inline-block rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 ring-1 ring-stone-200">
          Cross-Entity Network · Patent claim 1
        </span>
        <h2 className="mt-2 text-base font-semibold text-stone-900">Related Entities</h2>
        <p className="mt-1 text-xs text-stone-600">
          Other entities sharing principal address, registered agent, or officer with this contractor.
          Phoenix patterns and operator overlap are independent fraud indicators.
        </p>
      </header>

      {phoenix.length > 0 && (
        <div>
          <GroupHeader kind="phoenix_signal" count={phoenix.length} />
          <ul className="space-y-2">
            {phoenix.map((e, i) => (<EntityRow key={`p${i}`} e={e} />))}
          </ul>
        </div>
      )}

      {sameOp.length > 0 && (
        <div>
          <GroupHeader kind="same_operator" count={sameOp.length} />
          <ul className="space-y-2">
            {sameOp.map((e, i) => (<EntityRow key={`s${i}`} e={e} />))}
          </ul>
        </div>
      )}

      {neighbors.length > 0 && (
        <div>
          <GroupHeader kind="address_neighbor" count={neighbors.length} />
          <ul className="space-y-2">
            {neighbors.map((e, i) => (<EntityRow key={`n${i}`} e={e} />))}
          </ul>
        </div>
      )}
    </section>
  )
}
