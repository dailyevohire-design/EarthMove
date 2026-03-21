import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { ORDER_STATUS_CONFIG } from '@/types'
import Link from 'next/link'
import { Package, ChevronRight } from 'lucide-react'

export const metadata = { title: 'My Orders' }

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/account/orders')

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, material_name_snapshot, quantity, unit, total_amount, created_at, delivery_type')
    .eq('customer_id', user.id)
    .neq('status', 'pending_payment')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="container-main py-10 max-w-3xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/account" className="text-gray-500 hover:text-gray-700 text-sm transition-colors">
          ← Account
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
      </div>

      {(!orders || orders.length === 0) ? (
        <div className="card p-16 text-center">
          <Package size={40} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-1">No orders yet</p>
          <p className="text-gray-400 text-sm mb-6">Orders appear here once placed.</p>
          <Link href="/browse" className="btn-primary btn-md">Browse Materials</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => {
            const config = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="card-hover flex items-center gap-4 p-4"
              >
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Package size={18} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">
                    {order.material_name_snapshot}
                  </div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {order.quantity} {unitLabel(order.unit, order.quantity)} ·{' '}
                    {new Date(order.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="font-semibold text-gray-900 text-sm">
                    {formatCurrency(order.total_amount)}
                  </span>
                  <span className={config?.badgeClass ?? 'badge-stone'}>{config?.label ?? order.status}</span>
                </div>
                <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
