import { createAdminClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/pricing-engine'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface Props {
  searchParams: Promise<{ material?: string; available?: string }>
}

export const metadata = { title: 'Offerings — Admin' }

export default async function AdminOfferingsPage({ searchParams }: Props) {
  const { material, available } = await searchParams
  const supabase = createAdminClient()

  let query = supabase
    .from('supplier_offerings')
    .select(`
      id, price_per_unit, unit, is_available, is_public,
      availability_confidence, last_verified_at, data_source,
      minimum_order_quantity,
      material:material_catalog(
        id, name, category:material_categories(name)
      ),
      supply_yard:supply_yards(
        id, name, city, state,
        supplier:suppliers(id, name, status)
      )
    `)
    .order('updated_at', { ascending: false })

  if (material) query = query.eq('material_catalog_id', material)
  if (available === '1') query = query.eq('is_available', true)

  const { data: offerings } = await query.limit(200)

  const { data: catalog } = await supabase
    .from('material_catalog')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-100">Offerings</h1>
        <p className="text-stone-500 text-sm mt-1">
          All supplier offerings across yards — {offerings?.length ?? 0} total
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          className="input text-sm w-56"
          value={material ?? ''}
          onChange={e => {
            const url = new URL(window.location.href)
            e.target.value ? url.searchParams.set('material', e.target.value) : url.searchParams.delete('material')
            window.location.href = url.toString()
          }}
        >
          <option value="">All materials</option>
          {(catalog ?? []).map((m: any) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <Link
          href={available === '1' ? '/admin/offerings' : '/admin/offerings?available=1'}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            available === '1'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700'
          }`}
        >
          Available only
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-800">
                {['Material', 'Supplier / Yard', 'Price', 'Min Qty', 'Confidence', 'Public', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/40">
              {(offerings ?? []).map((o: any) => (
                <tr key={o.id} className="hover:bg-stone-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-stone-200">{o.material?.name}</div>
                    <div className="text-xs text-stone-500">{o.material?.category?.name}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-stone-300 text-sm">{o.supply_yard?.supplier?.name}</div>
                    <div className="text-xs text-stone-500">
                      {o.supply_yard?.name}
                      {o.supply_yard?.city && ` · ${o.supply_yard.city}`}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-stone-200">{formatCurrency(o.price_per_unit)}</span>
                    <span className="text-stone-600 text-xs">/{o.unit}</span>
                  </td>
                  <td className="px-5 py-3.5 text-stone-400 text-xs">{o.minimum_order_quantity} {o.unit}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-1.5 rounded-full ${
                        o.availability_confidence >= 90 ? 'bg-emerald-500' :
                        o.availability_confidence >= 70 ? 'bg-amber-500' : 'bg-red-500'
                      }`} style={{ width: `${o.availability_confidence}%`, maxWidth: '60px' }} />
                      <span className="text-xs text-stone-500">{o.availability_confidence}%</span>
                    </div>
                    {o.last_verified_at && (
                      <div className="text-[10px] text-stone-700 mt-0.5">
                        {new Date(o.last_verified_at).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {o.is_public
                      ? <span className="badge-green text-[10px]">Yes</span>
                      : <span className="badge-stone text-[10px]">No</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {o.is_available
                      ? <span className="badge-green">Available</span>
                      : <span className="badge-stone">Unavailable</span>}
                  </td>
                  <td className="px-3 py-3.5">
                    <Link
                      href={`/admin/suppliers/${o.supply_yard?.supplier?.id}/yards/${o.supply_yard?.id}`}
                      className="p-1.5 rounded text-stone-600 hover:text-amber-400 hover:bg-stone-800 transition-colors block"
                    >
                      <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
