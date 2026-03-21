import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Props { searchParams: Promise<{ entity?: string; type?: string; page?: string }> }

export const metadata = { title: 'Audit Log — Admin' }

export default async function AdminAuditPage({ searchParams }: Props) {
  const { entity, type, page: pageStr } = await searchParams
  const page    = Math.max(1, parseInt(pageStr ?? '1'))
  const perPage = 50
  const offset  = (page - 1) * perPage

  const supabase = createAdminClient()

  let q = supabase
    .from('audit_events')
    .select(`
      id, event_type, entity_type, entity_id, payload, created_at,
      actor:profiles(first_name, last_name, role)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (entity) q = q.eq('entity_type', entity)
  if (type) q = q.ilike('event_type', `%${type}%`)

  const { data: events, count } = await q
  const totalPages = Math.ceil((count ?? 0) / perPage)

  const entityTypes = [
    'orders', 'market_materials', 'supplier_offerings',
    'suppliers', 'promotions', 'import_records', 'pricing_rules',
  ]

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-100">Audit Log</h1>
        <p className="text-stone-500 text-sm mt-1">{count ?? 0} total events</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <Link href="/admin/audit" className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${!entity ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-stone-800 text-stone-400 border-stone-700'}`}>
          All
        </Link>
        {entityTypes.map(e => (
          <Link
            key={e}
            href={`/admin/audit?entity=${e}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
              entity === e
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700'
            }`}
          >
            {e.replace(/_/g, ' ')}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-800">
              {['Event', 'Entity', 'Actor', 'Time'].map(h => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/40">
            {(events ?? []).map((ev: any) => {
              const actor = ev.actor as any
              return (
                <tr key={ev.id} className="hover:bg-stone-800/20">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-amber-400/80">{ev.event_type}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-stone-400 text-xs capitalize">{ev.entity_type?.replace(/_/g, ' ')}</div>
                    {ev.entity_id && (
                      <div className="font-mono text-[10px] text-stone-600">
                        {ev.entity_id.slice(-8).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {actor ? (
                      <div className="text-stone-300 text-xs">{actor.first_name} {actor.last_name}</div>
                    ) : (
                      <span className="text-stone-600 text-xs">System</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-stone-500 text-xs">
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-stone-800">
            <span className="text-xs text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/admin/audit?entity=${entity ?? ''}&page=${page - 1}`} className="btn-secondary btn-sm">← Prev</Link>}
              {page < totalPages && <Link href={`/admin/audit?entity=${entity ?? ''}&page=${page + 1}`} className="btn-secondary btn-sm">Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
