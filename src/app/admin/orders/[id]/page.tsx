import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { OrderDispatchPanel } from '@/components/admin/order-dispatch-panel'
import { MapPin, Package, User, Phone, Calendar, Clock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      customer:profiles(first_name, last_name, phone, company_name),
      dispatch:dispatch_queue(*)
    `)
    .eq('id', id)
    .single()

  if (!order) notFound()

  const addr = order.delivery_address_snapshot as any
  const customer = order.customer as any
  const dispatch = order.dispatch as any

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <div className="flex items-center gap-2 mb-8 text-sm text-stone-500">
        <Link href="/admin/orders" className="hover:text-stone-300 transition-colors">Orders</Link>
        <span>/</span>
        <span className="font-mono text-stone-400">#{order.id.slice(-8).toUpperCase()}</span>
        {order.needs_review && (
          <span className="badge-amber flex items-center gap-1 ml-2">
            <AlertTriangle size={11} />NEEDS REVIEW
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Customer */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Customer</h3>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-stone-500" />
              </div>
              <div>
                <div className="font-semibold text-stone-200">
                  {customer?.first_name} {customer?.last_name}
                </div>
                {customer?.company_name && <div className="text-stone-500 text-sm">{customer.company_name}</div>}
                {customer?.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm mt-1 transition-colors">
                    <Phone size={12} />
                    {customer.phone}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Order */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Order</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-stone-800 flex items-center justify-center flex-shrink-0">
                <Package size={18} className="text-stone-600" />
              </div>
              <div>
                <div className="font-semibold text-stone-200">{order.material_name_snapshot}</div>
                <div className="text-stone-500 text-sm">
                  {order.quantity} {unitLabel(order.unit as any, order.quantity)} ·{' '}
                  {formatCurrency(order.price_per_unit)} per {order.unit}
                </div>
                <div className="text-stone-600 text-xs mt-0.5">
                  via {order.supplier_name_snapshot} — {order.supply_yard_name_snapshot}
                </div>
              </div>
            </div>
          </div>

          {/* Delivery */}
          {addr && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Delivery</h3>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-stone-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-stone-200 text-sm">{addr.street_line_1}</div>
                  <div className="text-stone-400 text-sm">{addr.city}, {addr.state} {addr.zip}</div>
                  {addr.delivery_notes && (
                    <div className="mt-2 p-2 bg-amber-500/5 border border-amber-500/10 rounded text-xs text-amber-300/80">
                      📋 {addr.delivery_notes}
                    </div>
                  )}
                </div>
              </div>
              {order.requested_delivery_date && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-800">
                  <Calendar size={14} className="text-stone-500" />
                  <div>
                    <span className="text-stone-500 text-xs">Requested: </span>
                    <span className="text-stone-300 text-sm font-medium">
                      {new Date(order.requested_delivery_date).toLocaleDateString('en-US', {
                        weekday: 'long', month: 'long', day: 'numeric'
                      })}
                      {order.requested_delivery_window && ` · ${order.requested_delivery_window}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Review reason */}
          {order.review_reason && (
            <div className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl">
              <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-amber-300 text-sm font-medium mb-0.5">Review Required</div>
                <div className="text-amber-400/70 text-xs">{order.review_reason}</div>
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Pricing</h3>
            <div className="space-y-2 text-sm">
              {(order.line_items_snapshot as any[] ?? []).map((li: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span className={li.type === 'discount' ? 'text-emerald-400' : 'text-stone-400'}>{li.label}</span>
                  <span className={li.type === 'discount' ? 'text-emerald-400' : 'text-stone-300'}>
                    {li.amount < 0 ? `−${formatCurrency(Math.abs(li.amount))}` : formatCurrency(li.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-stone-100 pt-2 border-t border-stone-800">
                <span>Total charged</span>
                <span className="price-display">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-stone-800 space-y-1">
              {order.paid_at && (
                <div className="flex items-center gap-2 text-xs text-stone-600">
                  <Clock size={11} />Paid: {new Date(order.paid_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dispatch panel */}
        <div className="sticky top-8 self-start">
          <OrderDispatchPanel order={order as any} dispatch={dispatch} />
        </div>
      </div>
    </div>
  )
}
