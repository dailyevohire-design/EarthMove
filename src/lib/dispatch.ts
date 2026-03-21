// src/lib/dispatch.ts
// Server-side only.

import { createAdminClient } from '@/lib/supabase/server'
import type { Order, DispatchStatus, ApiResult } from '@/types'
import { computePerformanceScore } from './fulfillment-resolver'

// ── Enqueue ───────────────────────────────────────────────────

/**
 * Called from Stripe webhook after payment confirmation.
 * Creates the dispatch_queue record linked to the confirmed order.
 */
export async function enqueueOrder(order: Order): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase.from('dispatch_queue').insert({
    order_id:              order.id,
    // Snapshot originals from order (immutable reference)
    original_offering_id:  order.resolved_offering_id,
    original_yard_id:      order.supply_yard_id,
    original_supplier_id:  order.supplier_id,
    // Assigned starts as original (may be overridden by admin before dispatch)
    assigned_offering_id:  order.resolved_offering_id,
    assigned_yard_id:      order.supply_yard_id,
    assigned_supplier_id:  order.supplier_id,
    status:                'queued',
    target_delivery_date:  order.requested_delivery_date,
    target_window:         order.requested_delivery_window,
  })

  if (error) {
    console.error('[dispatch] enqueueOrder failed:', error)
    throw new Error('Failed to create dispatch queue entry.')
  }

  await supabase.from('audit_events').insert({
    event_type:  'dispatch.queued',
    entity_type: 'orders',
    entity_id:   order.id,
    actor_role:  'admin',
    payload: {
      offering_id: order.resolved_offering_id,
      yard_id:     order.supply_yard_id,
      supplier_id: order.supplier_id,
    },
  })
}

// ── Assign ────────────────────────────────────────────────────

export interface AssignDispatchInput {
  orderId: string
  dispatcherId: string
  driverName?: string
  driverPhone?: string
  truckInfo?: string
  opsNotes?: string
  estimatedArrival?: string
  // Optional: override the fulfillment source
  overrideOfferingId?: string
  overrideYardId?: string
  overrideSupplierId?: string
}

export async function assignDispatch(
  input: AssignDispatchInput
): Promise<ApiResult<void>> {
  const supabase = createAdminClient()
  const isOverride = !!input.overrideOfferingId

  const updates: Record<string, unknown> = {
    status:            'assigned',
    assigned_at:       new Date().toISOString(),
    dispatcher_id:     input.dispatcherId,
    driver_name:       input.driverName ?? null,
    driver_phone:      input.driverPhone ?? null,
    truck_info:        input.truckInfo ?? null,
    ops_notes:         input.opsNotes ?? null,
    estimated_arrival: input.estimatedArrival ?? null,
  }

  if (isOverride) {
    updates.assigned_offering_id  = input.overrideOfferingId
    updates.assigned_yard_id      = input.overrideYardId
    updates.assigned_supplier_id  = input.overrideSupplierId
    updates.was_overridden        = true
  }

  const { error } = await supabase
    .from('dispatch_queue')
    .update(updates)
    .eq('order_id', input.orderId)

  if (error) return { success: false, error: 'Failed to assign dispatch.' }

  // Sync customer-visible order status
  await supabase.from('orders').update({
    status:       'dispatched',
    dispatched_at: new Date().toISOString(),
    ...(isOverride && {
      supply_yard_id: input.overrideYardId,
      supplier_id:    input.overrideSupplierId,
    }),
  }).eq('id', input.orderId)

  await supabase.from('audit_events').insert({
    actor_id:    input.dispatcherId,
    actor_role:  'admin',
    event_type:  isOverride ? 'dispatch.assigned_override' : 'dispatch.assigned',
    entity_type: 'orders',
    entity_id:   input.orderId,
    payload:     updates,
  })

  return { success: true, data: undefined }
}

// ── Status progression ────────────────────────────────────────

export async function markEnRoute(
  orderId: string,
  dispatcherId: string,
  estimatedArrival?: string
): Promise<ApiResult<void>> {
  return progressDispatch(orderId, dispatcherId, 'en_route', {
    en_route_at:       new Date().toISOString(),
    estimated_arrival: estimatedArrival ?? null,
  })
}

export async function markDelivered(
  orderId: string,
  dispatcherId: string
): Promise<ApiResult<void>> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const result = await progressDispatch(orderId, dispatcherId, 'delivered', {
    delivered_at: now,
  })

  if (!result.success) return result

  await supabase.from('orders').update({
    status:       'delivered',
    delivered_at: now,
  }).eq('id', orderId)

  // Update supplier performance asynchronously (non-blocking)
  void updatePerformanceOnDelivery(orderId, true, now)

  return { success: true, data: undefined }
}

export async function markDispatchFailed(
  orderId: string,
  dispatcherId: string,
  reason: string
): Promise<ApiResult<void>> {
  return progressDispatch(orderId, dispatcherId, 'failed', {
    failed_at:      new Date().toISOString(),
    failure_reason: reason,
  })
}

// ── Internal helpers ──────────────────────────────────────────

async function progressDispatch(
  orderId: string,
  actorId: string,
  status: DispatchStatus,
  extraFields: Record<string, unknown>
): Promise<ApiResult<void>> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('dispatch_queue')
    .update({ status, ...extraFields })
    .eq('order_id', orderId)

  if (error) {
    return { success: false, error: `Failed to update dispatch status to ${status}.` }
  }

  await supabase.from('audit_events').insert({
    actor_id:    actorId,
    actor_role:  'admin',
    event_type:  `dispatch.${status}`,
    entity_type: 'orders',
    entity_id:   orderId,
    payload:     extraFields,
  })

  return { success: true, data: undefined }
}

async function updatePerformanceOnDelivery(
  orderId: string,
  onTime: boolean,
  deliveredAt: string
): Promise<void> {
  try {
    const supabase = createAdminClient()

    const { data: order } = await supabase
      .from('orders')
      .select('supplier_id, requested_delivery_date')
      .eq('id', orderId)
      .single()

    if (!order?.supplier_id) return

    // Determine on-time: if scheduled, compare to requested date
    let wasOnTime = onTime
    if (order.requested_delivery_date) {
      const deliveryDate = new Date(deliveredAt).toISOString().split('T')[0]
      wasOnTime = deliveryDate <= order.requested_delivery_date
    }

    const { data: perf } = await supabase
      .from('supplier_performance')
      .select('*')
      .eq('supplier_id', order.supplier_id)
      .single()

    if (!perf) return

    const newTotal     = perf.total_orders + 1
    const newCompleted = perf.completed_orders + 1
    const newOnTimeRate = wasOnTime
      ? ((perf.on_time_rate * perf.completed_orders) + 100) / newCompleted
      : (perf.on_time_rate * perf.completed_orders) / newCompleted

    const newScore = computePerformanceScore({
      on_time_rate:       Math.round(newOnTimeRate * 100) / 100,
      cancellation_rate:  perf.cancellation_rate,
      avg_response_hours: perf.avg_response_hours,
      total_orders:       newTotal,
    })

    await supabase.from('supplier_performance').update({
      total_orders:       newTotal,
      completed_orders:   newCompleted,
      on_time_rate:       Math.round(newOnTimeRate * 100) / 100,
      performance_score:  newScore,
      is_bootstrapped:    newTotal >= 5 ? false : perf.is_bootstrapped,
      last_calculated_at: new Date().toISOString(),
    }).eq('supplier_id', order.supplier_id)
  } catch (err) {
    // Performance update is non-critical — log but don't throw
    console.error('[dispatch] updatePerformanceOnDelivery failed:', err)
  }
}
