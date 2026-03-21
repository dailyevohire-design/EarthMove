import { createAdminClient } from '@/lib/supabase/server'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { ORDER_STATUS_CONFIG } from '@/types'
import Link from 'next/link'
import {
  DollarSign, Clock, Truck, CheckCircle2,
  ShoppingCart, ArrowRight, AlertTriangle
} from 'lucide-react'

async function getStats() {
  const supabase = createAdminClient()
  const today = new Date(); today.setHours(0,0,0,0)

  const [{ data: all }, { data: todayOrders }, { data: reviews }] = await Promise.all([
    supabase.from('orders').select('status, total_amount').neq('status', 'pending_payment').neq('status', 'payment_failed'),
    supabase.from('orders').select('status, total_amount').gte('created_at', today.toISOString()).eq('status', 'confirmed'),
    supabase.from('orders').select('id').eq('needs_review', true).in('status', ['confirmed', 'dispatched']),
  ])

  const orders = all ?? []
  return {
    needs_dispatch:   orders.filter((o: any) => o.status === 'confirmed').length,
    in_transit:       orders.filter((o: any) => o.status === 'dispatched').length,
    delivered_total:  orders.filter((o: any) => o.status === 'delivered').length,
    total_revenue:    orders.reduce((s: number, o: any) => s + (o.total_amount ?? 0), 0),
    today_revenue:    (todayOrders ?? []).reduce((s: number, o: any) => s + (o.total_amount ?? 0), 0),
    today_orders:     todayOrders?.length ?? 0,
    needs_review:     reviews?.length ?? 0,
  }
}

async function getActionQueue() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('orders')
    .select(`
      id, status, material_name_snapshot, quantity, unit,
      total_amount, created_at, delivery_type,
      requested_delivery_date, needs_review,
      delivery_address_snapshot,
      customer:profiles(first_name, last_name, phone)
    `)
    .in('status', ['confirmed', 'dispatched'])
    .order('needs_review', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(12)
  return data ?? []
}

export const metadata = { title: 'Admin Dashboard' }

export default async function AdminDashboard() {
  const [stats, queue] = await Promise.all([getStats(), getActionQueue()])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-100">Dashboard</h1>
        <p className="text-stone-500 text-sm mt-1">DFW Operations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Today's Revenue</span>
            <DollarSign size={15} className="text-amber-500" />
          </div>
          <div className="stat-value text-amber-400">{formatCurrency(stats.today_revenue)}</div>
          <div className="stat-sub">{stats.today_orders} orders today</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Needs Dispatch</span>
            <Clock size={15} className="text-amber-500" />
          </div>
          <div className="stat-value">{stats.needs_dispatch}</div>
          <div className="stat-sub">confirmed, awaiting</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">In Transit</span>
            <Truck size={15} className="text-sky-400" />
          </div>
          <div className="stat-value">{stats.in_transit}</div>
          <div className="stat-sub">currently dispatched</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Total Revenue</span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <div className="stat-value">{formatCurrency(stats.total_revenue)}</div>
          <div className="stat-sub">{stats.delivered_total} delivered</div>
        </div>
      </div>

      {/* Review alert */}
      {stats.needs_review > 0 && (
        <Link
          href="/admin/orders?needs_review=1"
          className="flex items-center gap-3 p-4 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl hover:bg-amber-500/15 transition-colors"
        >
          <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
          <span className="text-amber-300 text-sm font-medium">
            {stats.needs_review} order{stats.needs_review !== 1 ? 's' : ''} flagged for review
          </span>
          <ArrowRight size={14} className="text-amber-500 ml-auto" />
        </Link>
      )}

      {/* Action queue */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <h2 className="font-semibold text-stone-200 flex items-center gap-2">
            <ShoppingCart size={16} className="text-amber-500" />
            Action Queue
            {queue.length > 0 && <span className="badge-amber">{queue.length}</span>}
          </h2>
          <Link href="/admin/orders" className="text-sm text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
            View all <ArrowRight size={13} />
          </Link>
        </div>

        {queue.length === 0 ? (
          <div className="p-12 text-center text-stone-600 text-sm">
            All orders dispatched. 
          </div>
        ) : (
          <div className="divide-y divide-stone-800/50">
            {queue.map((order: any) => {
              const config = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
              const addr = order.delivery_address_snapshot as any
              const customer = order.customer as any
              return (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-stone-800/40 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-stone-200 text-sm truncate">{order.material_name_snapshot}</span>
                      <span className={config?.badgeClass ?? 'badge-stone'}>{config?.label}</span>
                      {order.needs_review && <span className="badge-amber text-[10px]">REVIEW</span>}
                    </div>
                    <div className="text-stone-500 text-xs">
                      {order.quantity} {order.unit} ·{' '}
                      {customer?.first_name} {customer?.last_name}
                      {customer?.phone && ` · ${customer.phone}`}
                    </div>
                    {addr && (
                      <div className="text-stone-600 text-xs truncate">{addr.street_line_1}, {addr.city}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="font-semibold text-stone-200 text-sm">{formatCurrency(order.total_amount)}</span>
                    <span className="text-stone-600 text-xs">
                      {order.delivery_type === 'scheduled' && order.requested_delivery_date
                        ? new Date(order.requested_delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'ASAP'}
                    </span>
                  </div>
                  <ArrowRight size={14} className="text-stone-600 group-hover:text-stone-400 transition-colors" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
