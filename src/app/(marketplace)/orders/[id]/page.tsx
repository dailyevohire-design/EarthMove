import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { ORDER_STATUS_CONFIG } from '@/types'
import { OrderStatusTimeline } from '@/components/marketplace/order-status-timeline'
import { CheckCircle2, MapPin, Calendar, Phone, Package, Clock } from 'lucide-react'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ payment?: string }>
}

async function getOrder(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('customer_id', user.id)
    .single()

  return data
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return { title: `Order #${id.slice(-8).toUpperCase()}` }
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params
  const { payment } = await searchParams
  const order = await getOrder(id)
  if (!order) notFound()

  const isNewOrder = payment === 'success' && order.status === 'confirmed'
  const statusConfig = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
  const addr = order.delivery_address_snapshot as any

  return (
    <div className="container-main py-10 max-w-3xl order-detail-page">
      {/* Success banner */}
      {isNewOrder && (
        <div className="mb-8 p-5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-4 animate-fade-up">
          <CheckCircle2 className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <div className="font-semibold text-emerald-800">Order confirmed!</div>
            <div className="text-emerald-600 text-sm mt-0.5">
              Payment received. We'll be in touch with delivery updates.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Order #{order.id.slice(-8).toUpperCase()}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Placed {new Date(order.created_at).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric'
            })}
          </p>
        </div>
        <span className={statusConfig?.badgeClass ?? 'badge-stone'}>
          {statusConfig?.label ?? order.status}
        </span>
      </div>

      {/* Status timeline */}
      <div className="card p-6 mb-5">
        <OrderStatusTimeline status={order.status} />
      </div>

      {/* Order detail */}
      <div className="card p-6 mb-5 space-y-5">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">Order Details</h2>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Package size={18} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900">{order.material_name_snapshot}</div>
            <div className="text-gray-500 text-sm">
              {order.quantity} {unitLabel(order.unit, order.quantity)} · {formatCurrency(order.price_per_unit)} per {order.unit}
            </div>
            <div className="text-gray-400 text-xs mt-0.5 capitalize">{order.fulfillment_method} · {order.delivery_type === 'asap' ? 'ASAP' : 'Scheduled'}</div>
          </div>
          <div className="font-semibold text-gray-900 flex-shrink-0">{formatCurrency(order.subtotal)}</div>
        </div>

        {addr && (
          <div className="flex items-start gap-3 pt-4 border-t border-gray-100">
            <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-gray-700 text-sm">{addr.street_line_1}</div>
              <div className="text-gray-500 text-sm">{addr.city}, {addr.state} {addr.zip}</div>
              {addr.delivery_notes && (
                <div className="text-gray-400 text-xs mt-1">{addr.delivery_notes}</div>
              )}
            </div>
          </div>
        )}

        {order.requested_delivery_date && (
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <Calendar size={16} className="text-gray-400 flex-shrink-0" />
            <div>
              <div className="text-gray-400 text-xs">Requested delivery</div>
              <div className="text-gray-700 text-sm font-medium">
                {new Date(order.requested_delivery_date).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric'
                })}
                {order.requested_delivery_window && ` · ${order.requested_delivery_window}`}
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-gray-100 pt-4 space-y-2">
          {(order.line_items_snapshot as any[] ?? []).map((li: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span className={li.type === 'discount' ? 'text-emerald-600' : 'text-gray-500'}>{li.label}</span>
              <span className={li.type === 'discount' ? 'text-emerald-600 font-medium' : 'text-gray-700 font-medium'}>
                {li.amount < 0 ? `−${formatCurrency(Math.abs(li.amount))}` : formatCurrency(li.amount)}
              </span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total paid</span>
            <span className="price-display">{formatCurrency(order.total_amount)}</span>
          </div>
        </div>

        {(order.dispatched_at || order.delivered_at) && (
          <div className="border-t border-gray-100 pt-4 space-y-1">
            {order.dispatched_at && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Clock size={11} />
                Dispatched: {new Date(order.dispatched_at).toLocaleString()}
              </div>
            )}
            {order.delivered_at && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Clock size={11} />
                Delivered: {new Date(order.delivered_at).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card p-5 flex items-center gap-4">
        <div className="p-2.5 bg-gray-100 rounded-lg flex-shrink-0">
          <Phone size={16} className="text-gray-500" />
        </div>
        <div>
          <div className="font-medium text-gray-900 text-sm">Questions about your order?</div>
          <div className="text-gray-500 text-xs">Reference #{order.id.slice(-8).toUpperCase()} when you call.</div>
        </div>
      </div>

      <div className="mt-6 order-footer-buttons">
        <Link href="/account/orders" className="btn-secondary btn-md done-btn">All orders</Link>
        <Link href={`/dashboard/contractor`} className="btn-primary btn-md track-btn">Track delivery →</Link>
      </div>
    </div>
  )
}
