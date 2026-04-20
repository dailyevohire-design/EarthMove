import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ArrowRight, Building2 } from 'lucide-react'

export const metadata = { title: 'Suppliers — Admin' }

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'badge-green' },
  pending:   { label: 'Pending',   cls: 'badge-amber' },
  inactive:  { label: 'Inactive',  cls: 'badge-stone' },
  suspended: { label: 'Suspended', cls: 'badge-red' },
}

export default async function AdminSuppliersPage() {
  const supabase = createAdminClient()

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select(`
      id, name, status, portal_enabled, data_source,
      primary_contact_name, primary_contact_phone, primary_contact_email,
      performance:supplier_performance(performance_score, total_orders, is_bootstrapped),
      yards:supply_yards(id)
    `)
    .order('name')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Suppliers</h1>
          <p className="text-stone-500 text-sm mt-1">{suppliers?.length ?? 0} suppliers</p>
        </div>
        <Link href="/admin/suppliers/new" className="btn-primary btn-md">
          <Plus size={14} /> Add Supplier
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-800">
              {['Supplier', 'Contact', 'Yards', 'Performance', 'Status', ''].map(h => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/40">
            {(suppliers ?? []).map((s: any) => {
              const perf = Array.isArray(s.performance) ? s.performance[0] : s.performance
              const yardCount = Array.isArray(s.yards) ? s.yards.length : 0
              const config = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending

              return (
                <tr key={s.id} className="hover:bg-stone-800/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-stone-500 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-stone-200">{s.name}</div>
                        <div className="text-xs text-stone-600 capitalize">{s.data_source}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {s.primary_contact_name && (
                      <div className="text-stone-300 text-sm">{s.primary_contact_name}</div>
                    )}
                    {s.primary_contact_phone && (
                      <a href={`tel:${s.primary_contact_phone}`} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                        {s.primary_contact_phone}
                      </a>
                    )}
                    {!s.primary_contact_name && !s.primary_contact_phone && (
                      <span className="text-stone-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-medium text-stone-300">{yardCount}</span>
                    <span className="text-stone-600 text-xs ml-1">yard{yardCount !== 1 ? 's' : ''}</span>
                  </td>
                  <td className="px-5 py-4">
                    {perf ? (
                      <div>
                        <div className="font-medium text-stone-300 text-sm">{perf.performance_score}/100</div>
                        <div className="text-xs text-stone-600">
                          {perf.is_bootstrapped ? 'Default' : `${perf.total_orders} orders`}
                        </div>
                      </div>
                    ) : <span className="text-stone-600 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={config.cls}>{config.label}</span>
                      {s.portal_enabled && <span className="badge-blue text-[10px]">Portal</span>}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <Link href={`/admin/suppliers/${s.id}`} className="p-1.5 rounded text-stone-600 hover:text-amber-400 hover:bg-stone-800 transition-colors block">
                      <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
