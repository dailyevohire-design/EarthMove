'use server'

import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveOffering, FulfillmentError } from '@/lib/fulfillment-resolver'
import { buildPriceQuote, PricingError } from '@/lib/pricing-engine'
import { resolveDistanceMiles } from '@/lib/distance-resolver'
import { createCheckoutSession } from '@/lib/stripe'
import { normalizeDeliverySchedule } from '@/lib/delivery-window-bridge'
import type { ApiResult } from '@/types'

const Schema = z.object({
  market_material_id:       z.string().uuid(),
  quantity:                 z.number().positive().max(10000),
  delivery_type:            z.enum(['asap', 'scheduled']),
  fulfillment_method:       z.enum(['delivery', 'pickup']),
  delivery_address: z.object({
    street_line_1: z.string().min(3).max(200),
    street_line_2: z.string().max(100).optional(),
    city:          z.string().min(2).max(100),
    state:         z.string().length(2),
    zip:           z.string().regex(/^\d{5}(-\d{4})?$/),
    delivery_notes: z.string().max(500).optional(),
  }).optional(),
  requested_delivery_date:   z.string().optional().nullable(),
  requested_delivery_window: z.string().optional().nullable(),
  delivery_notes:            z.string().max(500).optional().nullable(),
  // Optional guest checkout block. When present, the action will provision
  // an auth.users row server-side via the admin client and use it as the
  // order's customer. The user can claim the account later via magic link.
  guest: z.object({
    email:      z.string().email().max(200),
    first_name: z.string().min(1).max(80),
    last_name:  z.string().min(1).max(80),
    phone:      z.string().max(40).optional(),
  }).optional(),
})

export async function createOrderAndCheckout(
  raw: unknown
): Promise<ApiResult<{ checkout_url: string }>> {
  try {
    const parsed = Schema.safeParse(raw)
    if (!parsed.success) return { success: false, error: 'Invalid order details.' }
    const input = parsed.data

    const supabase = await createClient()
    const { data: { user: authedUser } } = await supabase.auth.getUser()

    // Resolve identity: either a signed-in user OR a guest block. We do NOT
    // create an auth.users row for guests anymore — orders carry guest_*
    // columns directly (see migration 014_guest_orders.sql). The CHECK
    // constraint on the table enforces exactly one identity type.
    if (!authedUser && !input.guest) {
      return { success: false, error: 'Sign in or check out as guest to place an order.', code: 'AUTH_REQUIRED' }
    }

    const adminClient = createAdminClient()

    // Get profile (only for authed users — guests have no profile)
    const { data: profile } = authedUser
      ? await supabase.from('profiles').select('stripe_customer_id').eq('id', authedUser.id).single()
      : { data: null }

    // Get market_material to find market + catalog IDs
    const { data: mm } = await adminClient
      .from('market_materials')
      .select('market_id, material_catalog_id')
      .eq('id', input.market_material_id)
      .single()

    if (!mm) return { success: false, error: 'Material not found.' }

    // Resolve fulfillment source
    let resolved: Awaited<ReturnType<typeof resolveOffering>>
    try {
      resolved = await resolveOffering(mm.market_id, mm.material_catalog_id)
    } catch (err) {
      if (err instanceof FulfillmentError) return { success: false, error: err.message }
      throw err
    }

    // Delivery validation
    if (input.fulfillment_method === 'delivery' && !input.delivery_address) {
      return { success: false, error: 'Delivery address is required.' }
    }
    const schedule = normalizeDeliverySchedule({
      delivery_window: input.requested_delivery_window,
      delivery_date:   input.requested_delivery_date,
    })
    if (schedule.delivery_type === 'scheduled' && !schedule.requested_delivery_date) {
      return { success: false, error: 'A delivery date is required for scheduled orders.' }
    }

    // Fetch active promotion
    const now = new Date().toISOString()
    const { data: promo } = await adminClient
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', now)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .or(`material_catalog_id.eq.${mm.material_catalog_id},offering_id.eq.${resolved.offering.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fetch platform fee
    const { data: feeRule } = await adminClient
      .from('pricing_rules')
      .select('config')
      .eq('rule_type', 'platform_fee')
      .eq('is_active', true)
      .or(`market_id.eq.${mm.market_id},market_id.is.null`)
      .order('market_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    const platformFeeRate = feeRule?.config?.value ? feeRule.config.value / 100 : 0.09

    let distanceMiles: number | undefined
    if (input.fulfillment_method === 'delivery') {
      const { data: market } = await adminClient
        .from('markets')
        .select('center_lat, center_lng')
        .eq('id', mm.market_id)
        .maybeSingle()

      const resolvedDistance = await resolveDistanceMiles({
        zip:             input.delivery_address?.zip,
        yardId:          resolved.supply_yard.id,
        yardLat:         resolved.supply_yard.lat ?? null,
        yardLng:         resolved.supply_yard.lng ?? null,
        marketCenterLat: market?.center_lat ?? null,
        marketCenterLng: market?.center_lng ?? null,
      })
      distanceMiles = resolvedDistance.miles
    }

    // Build authoritative quote (server-side — this is the price of record)
    let quote: ReturnType<typeof buildPriceQuote>
    try {
      quote = buildPriceQuote({
        offering:           resolved.offering,
        quantity:           input.quantity,
        fulfillment_method: input.fulfillment_method,
        delivery_type:      schedule.delivery_type,
        market_material_id: input.market_material_id,
        distance_miles:     distanceMiles,
        promotion:          promo ?? null,
        platform_fee_rate:  platformFeeRate,
      })
    } catch (err) {
      if (err instanceof PricingError) return { success: false, error: err.message }
      throw err
    }

    // Create order record. Guests get guest_* columns; authed users get customer_id.
    // The CHECK constraint added in migration 014 enforces exactly one identity.
    const identityFields = authedUser
      ? {
          customer_id:      authedUser.id,
          guest_email:      null,
          guest_first_name: null,
          guest_last_name:  null,
          guest_phone:      null,
        }
      : {
          customer_id:      null,
          guest_email:      input.guest!.email,
          guest_first_name: input.guest!.first_name,
          guest_last_name:  input.guest!.last_name,
          guest_phone:      input.guest!.phone ?? null,
        }

    const { data: order, error: orderErr } = await adminClient
      .from('orders')
      .insert({
        ...identityFields,
        market_id:                  mm.market_id,
        market_material_id:         input.market_material_id,
        resolved_offering_id:       resolved.offering.id,
        supply_yard_id:             resolved.supply_yard.id,
        supplier_id:                resolved.supplier.id,
        material_catalog_id:        mm.material_catalog_id,
        status:                     'pending_payment',
        fulfillment_method:         input.fulfillment_method,
        material_name_snapshot:     resolved.market_material.display_name ?? (resolved.offering.supply_yard as any)?.name ?? resolved.offering.supplier_material_name ?? 'Material',
        supplier_name_snapshot:     resolved.supplier.name,
        supply_yard_name_snapshot:  resolved.supply_yard.name,
        quantity:                   input.quantity,
        unit:                       resolved.offering.unit,
        delivery_type:              schedule.delivery_type,
        delivery_address_snapshot:  input.delivery_address ?? null,
        requested_delivery_date:    schedule.requested_delivery_date,
        requested_delivery_window:  schedule.requested_delivery_window,
        delivery_notes:             input.delivery_notes ?? null,
        price_per_unit:             quote.price_per_unit,
        subtotal:                   quote.subtotal,
        delivery_fee:               quote.delivery_fee,
        platform_fee:               quote.platform_fee,
        promotion_discount:         quote.promotion_discount,
        tax_amount:                 quote.tax_amount,
        total_amount:               quote.total_amount,
        line_items_snapshot:        quote.line_items,
        promotion_id:               quote.promotion_id,
        needs_review:               quote.needs_review,
        review_reason:              quote.review_reason,
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      console.error('[createOrder] insert error:', orderErr)
      return { success: false, error: 'Failed to create order. Please try again.' }
    }

    // Build Stripe line items
    const stripeLineItems = quote.line_items
      .filter(li => li.amount > 0)
      .map(li => ({
        name: li.label,
        amountCents: Math.round(li.amount * 100),
      }))

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!
    const session = await createCheckoutSession({
      orderId:          order.id,
      stripeCustomerId: profile?.stripe_customer_id ?? null,
      lineItems:        stripeLineItems,
      metadata: {
        order_id:    order.id,
        customer_id: authedUser?.id ?? '',
        guest_email: input.guest?.email ?? '',
        market_id:   mm.market_id,
      },
      successUrl: `${baseUrl}/orders/${order.id}?payment=success`,
      cancelUrl:  `${baseUrl}/browse`,
    })

    // Save checkout session ID
    await adminClient
      .from('orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id)

    return { success: true, data: { checkout_url: session.url! } }
  } catch (err) {
    console.error('[createOrderAndCheckout]', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}
