import { createAdminClient } from '@/lib/supabase/server'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { ORDER_STATUS_CONFIG } from '@/types'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface Props { searchParams: Promise<{ status?: string; needs_review?: string; page?: string }> }

export const metadata = { title: 'Orders — Admin' }

const FILTERS = [
  { value: 'all',            label: 'All' },
  { value: 'confirmed',      label: 'Confirmed' },
  { value: 'dispatched',     label: 'Dispatched' },
  { value: 'delivered',      label: 'Delivered' },
  { value: 'payment_failed', label: 'Failed' },
  { value: 'cancelled',      label: 'Cancelled' },
]

export default async function AdminOrdersPage({ searchParams }: Props) {
  const { status, needs_review, page: pageStr } = await searchParams
  const page    = Math.max(1, parseInt(pageStr ?? '1'))
  const perPage = 30
  const offset  = (page - 1) * perPage
  const supabase = createAdminClient()

  let q = supabase
    .from('orders')
    .select(`
      id, status, material_name_snapshot, quantity, unit,
      total_amount, created_at, delivery_type, needs_review,
      requested_delivery_date, delivery_address_snapshot,
      customer:profiles(first_name, last_name, phone, company_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (status && status !== 'all') q = q.eq('status', status)
  if (needs_review === '1') q = q.eq('needs_review', true)

  const { data: orders, count } = await q
  const totalPages = Math.ceil((count ?? 0) / perPage)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Orders</h1>
          <p className="text-stone-500 text-sm mt-1">{count ?? 0} total</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {FILTERS.map(f => {
          const active = (status ?? 'all') === f.value && needs_review !== '1'
          return (
            <Link
              key={f.value}
              href={`/admin/orders?status=${f.value}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                active
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700 border-stone-700'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
        <Link
          href="/admin/orders?needs_review=1"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
            needs_review === '1'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-stone-800 text-stone-400 hover:bg-stone-700 border-stone-700'
          }`}
        >
          Needs Review
        </Link>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-800">
                {['Order', 'Customer', 'Material', 'Delivery', 'Total', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-stone-500 uppercase tracking-wider first:pl-5 last:w-10">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/40">
              {(orders ?? []).map((order: any) => {
                const config = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
                const customer = order.customer as any
                const addr = order.delivery_address_snapshot as any
                return (
                  <tr key={order.id} className="hover:bg-stone-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs text-stone-400">#{order.id.slice(-8).toUpperCase()}</div>
                      <div className="text-[11px] text-stone-600 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-stone-200">{customer?.first_name} {customer?.last_name}</div>
                      {customer?.company_name && <div className="text-xs text-stone-500">{customer.company_name}</div>}
                      {customer?.phone && <div className="text-xs text-stone-600">{customer.phone}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-stone-300">{order.material_name_snapshot}</div>
                      <div className="text-xs text-stone-500">{order.quantity} {unitLabel(order.unit, order.quantity)}</div>
                    </td>
                    <td className="px-5 py-4">
                      {addr ? (
                        <div className="text-xs text-stone-400">
                          <div>{addr.city}, {addr.state}</div>
                          <div className="text-stone-600">
                            {order.delivery_type === 'scheduled' && order.requested_delivery_date
                              ? new Date(order.requested_delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : 'ASAP'}
                          </div>
                        </div>
                      ) : <span className="text-xs text-stone-600">Pickup</span>}
                    </td>
                    <td className="px-5 py-4 font-semibold text-stone-200">{formatCurrency(order.total_amount)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={config?.badgeClass ?? 'badge-stone'}>{config?.label}</span>
                        {order.needs_review && <span className="badge-amber text-[10px]">REVIEW</span>}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <Link href={`/admin/orders/${order.id}`} className="p-1.5 rounded text-stone-600 hover:text-amber-400 hover:bg-stone-800 transition-colors block">
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-stone-800">
            <span className="text-xs text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/admin/orders?status=${status ?? 'all'}&page=${page - 1}`} className="btn-secondary btn-sm">← Prev</Link>}
              {page < totalPages && <Link href={`/admin/orders?status=${status ?? 'all'}&page=${page + 1}`} className="btn-secondary btn-sm">Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
