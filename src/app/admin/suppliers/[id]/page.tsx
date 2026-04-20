import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { SupplierEditor } from '@/components/admin/supplier-editor'
import Link from 'next/link'
import { formatCurrency } from '@/lib/pricing-engine'
import { Plus } from 'lucide-react'

interface Props { params: Promise<{ id: string }> }

export default async function AdminSupplierDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: supplier } = await supabase
    .from('suppliers')
    .select(`
      *,
      performance:supplier_performance(*),
      yards:supply_yards(
        id, name, city, state, is_active, delivery_enabled,
        offerings:supplier_offerings(
          id, price_per_unit, unit, is_available, is_public,
          material:material_catalog(name)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (!supplier) notFound()

  const perf = Array.isArray(supplier.performance) ? supplier.performance[0] : supplier.performance
  const yards = Array.isArray(supplier.yards) ? supplier.yards : []

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-2 mb-8 text-sm text-stone-500">
        <Link href="/admin/suppliers" className="hover:text-stone-300 transition-colors">Suppliers</Link>
        <span>/</span>
        <span className="text-stone-400">{supplier.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Supplier editor */}
        <div className="lg:col-span-2 space-y-5">
          <SupplierEditor supplier={supplier as any} />

          {/* Performance */}
          {perf && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Performance</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  ['Score', `${perf.performance_score}/100`],
                  ['On Time', `${perf.on_time_rate}%`],
                  ['Cancel Rate', `${perf.cancellation_rate}%`],
                  ['Total Orders', perf.total_orders],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <div className="text-xs text-stone-500 mb-1">{label as string}</div>
                    <div className="font-semibold text-stone-200">{value as string}</div>
                  </div>
                ))}
              </div>
              {perf.is_bootstrapped && (
                <p className="text-xs text-stone-600 mt-3">
                  ⚠ Performance metrics are defaults (not yet based on real orders).
                </p>
              )}
            </div>
          )}
        </div>

        {/* Yards panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-stone-200 text-sm">Supply Yards</h3>
            <Link href={`/admin/suppliers/${id}/yards/new`} className="btn-secondary btn-sm">
              <Plus size={12} /> Add
            </Link>
          </div>

          {yards.length === 0 && (
            <div className="card p-6 text-center text-stone-600 text-sm">No yards yet.</div>
          )}

          {yards.map((yard: any) => {
            const offerings = Array.isArray(yard.offerings) ? yard.offerings : []
            return (
              <Link
                key={yard.id}
                href={`/admin/suppliers/${id}/yards/${yard.id}`}
                className="card-hover p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-stone-200 text-sm">{yard.name}</div>
                  <div className="flex gap-1">
                    {yard.is_active
                      ? <span className="badge-green text-[10px]">Active</span>
                      : <span className="badge-stone text-[10px]">Inactive</span>}
                  </div>
                </div>
                {(yard.city || yard.state) && (
                  <div className="text-xs text-stone-500">{[yard.city, yard.state].filter(Boolean).join(', ')}</div>
                )}
                <div className="text-xs text-stone-600">
                  {offerings.length} offering{offerings.length !== 1 ? 's' : ''}
                </div>
                {offerings.slice(0, 3).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between text-xs">
                    <span className={o.is_available ? 'text-stone-400' : 'text-stone-600 line-through'}>
                      {o.material?.name}
                    </span>
                    <span className="text-stone-500">{formatCurrency(o.price_per_unit)}/{o.unit}</span>
                  </div>
                ))}
                {offerings.length > 3 && (
                  <div className="text-xs text-stone-600">+{offerings.length - 3} more</div>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
