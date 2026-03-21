import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { ORDER_STATUS_CONFIG } from '@/types'

export const metadata = { title: 'My Orders — Supplier Portal' }

export default async function PortalOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('supplier_id').eq('id', user.id).single()
  if (!profile?.supplier_id) redirect('/')

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, status, material_name_snapshot, quantity, unit,
      total_amount, created_at, delivery_type,
      requested_delivery_date, supply_yard_name_snapshot,
      delivery_address_snapshot
    `)
    .eq('supplier_id', profile.supplier_id)
    .neq('status', 'pending_payment')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-100">My Orders</h1>
        <p className="text-stone-500 text-sm mt-1">Orders fulfilled by your yards</p>
      </div>

      {(!orders || orders.length === 0) ? (
        <div className="card p-12 text-center text-stone-500 text-sm">No orders yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-800">
                {['Order', 'Material', 'Yard', 'Delivery', 'Total', 'Status'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/40">
              {orders.map((order: any) => {
                const config = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
                const addr = order.delivery_address_snapshot as any
                return (
                  <tr key={order.id}>
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs text-stone-400">#{order.id.slice(-8).toUpperCase()}</div>
                      <div className="text-[11px] text-stone-600">{new Date(order.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-stone-200">{order.material_name_snapshot}</div>
                      <div className="text-xs text-stone-500">{order.quantity} {unitLabel(order.unit, order.quantity)}</div>
                    </td>
                    <td className="px-5 py-4 text-stone-400 text-xs">{order.supply_yard_name_snapshot}</td>
                    <td className="px-5 py-4">
                      <div className="text-xs text-stone-400">
                        {addr ? `${addr.city}, ${addr.state}` : 'Pickup'}
                      </div>
                      <div className="text-[11px] text-stone-600">
                        {order.delivery_type === 'scheduled' && order.requested_delivery_date
                          ? new Date(order.requested_delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : order.delivery_type === 'asap' ? 'ASAP' : ''}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-stone-200">{formatCurrency(order.total_amount)}</td>
                    <td className="px-5 py-4">
                      <span className={config?.badgeClass ?? 'badge-stone'}>{config?.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
