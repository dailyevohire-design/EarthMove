// POST /api/checkout/create-session
//
// Creates an `orders` row in pending_payment, then a Stripe Checkout Session
// configured with order_id metadata so the existing webhook can flip the row
// to confirmed on session.completed.
//
// Mirrors the trust-checkout pattern: per-minute idempotency key, origin
// allowlist, runtime nodejs (Stripe SDK isn't edge-compat).
//
// WELCOME5 redemption: optimistic — we mark profiles.signup_promo_redeemed_at
// here, before Stripe session creation. If the user abandons checkout they
// "lose" the discount; this prevents double-redemption and is acceptable for
// v1. Move to webhook-driven redemption when the funnel is more sensitive.
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { quoteOrder, computeWelcome5DiscountCents } from '@/lib/checkout/pricing'
import { normalizeDeliverySchedule } from '@/lib/delivery-window-bridge'

export const runtime = 'nodejs'

// Hardcoded for v1 — single market launch (DFW). Market resolution by
// delivery ZIP is followup #C3.1.
const MARKET_ID_DFW = 'a9f89572-50c3-4a59-bbdf-78219c5199d6'

// Snapshot fields are NOT NULL on orders. Real supplier resolution is C3.1;
// these placeholders make the row valid for the webhook → enqueueOrder()
// path while a dispatcher assigns the actual supplier post-payment.
const SUPPLIER_NAME_TBD    = 'TBD — assigned by dispatcher'
const SUPPLY_YARD_NAME_TBD = 'TBD — assigned by dispatcher'

interface SessionBody {
  material_catalog_id: string
  material_name: string
  tons: number
  delivery: {
    street: string
    city: string
    state: string
    zip: string
    notes?: string | null
  }
  contact: {
    first_name: string
    last_name: string
    email: string
    phone: string
  }
  delivery_window: string | null
  delivery_date?: string | null
  project_type: string | null
  sub_type: string | null
  apply_welcome5: boolean
  is_guest: boolean
}

function resolveOrigin(req: Request): string | null {
  const fromHeader = req.headers.get('origin')
  const fromUrl = (() => { try { return new URL(req.url).origin } catch { return null } })()
  const origin = fromHeader ?? fromUrl
  if (!origin) return null

  const allowlist = process.env.STRIPE_ALLOWED_ORIGINS
  if (allowlist) {
    const allowed = allowlist.split(',').map((s) => s.trim()).filter(Boolean)
    return allowed.includes(origin) ? origin : null
  }
  const fallback = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (!fallback) return origin
  try {
    return new URL(fallback).origin === origin ? origin : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  let body: SessionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Server-side validation (don't trust client at all)
  if (!body.material_catalog_id || typeof body.tons !== 'number' || body.tons <= 0) {
    return NextResponse.json({ error: 'Invalid order: missing material_catalog_id or tons' }, { status: 400 })
  }
  if (!body.contact?.email || !body.contact?.first_name || !body.contact?.last_name || !body.contact?.phone) {
    return NextResponse.json({ error: 'Invalid order: missing contact info' }, { status: 400 })
  }
  if (!body.delivery?.street || !body.delivery?.city || !body.delivery?.state || !body.delivery?.zip) {
    return NextResponse.json({ error: 'Invalid order: missing delivery address' }, { status: 400 })
  }
  if (!/^\d{5}$/.test(body.delivery.zip)) {
    return NextResponse.json({ error: 'Invalid ZIP' }, { status: 400 })
  }

  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()

  // Guest path: explicit body flag OR no auth user. Authed users with
  // is_guest=true still proceed authed (we don't downgrade their identity).
  const isGuest = body.is_guest || !user

  // Re-quote server-side (don't trust client totals)
  const quote = quoteOrder({
    material_catalog_id: body.material_catalog_id,
    material_name: body.material_name,
    tons: body.tons,
  })

  // WELCOME5 server-side eligibility check
  const admin = createAdminClient()
  let welcome5DiscountCents = 0
  let applyWelcome5 = false
  if (body.apply_welcome5 && !isGuest && user) {
    const { data: profile } = await admin
      .from('profiles')
      .select('signup_promo_redeemed_at')
      .eq('id', user.id)
      .maybeSingle()
    if (profile && profile.signup_promo_redeemed_at === null) {
      applyWelcome5 = true
      welcome5DiscountCents = computeWelcome5DiscountCents(quote.subtotalCents)
    }
  }

  const totalAmountCents = quote.totalCents - welcome5DiscountCents

  const origin = resolveOrigin(req)
  if (!origin) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 400 })
  }

  const schedule = normalizeDeliverySchedule({
    delivery_window: body.delivery_window,
    delivery_date:   body.delivery_date,
  })
  if (schedule.delivery_type === 'scheduled' && !schedule.requested_delivery_date) {
    return NextResponse.json({ error: 'Scheduled delivery requires a date' }, { status: 400 })
  }

  const orderInsert: Record<string, unknown> = {
    market_id: MARKET_ID_DFW,
    customer_id: isGuest ? null : user!.id,
    material_catalog_id: body.material_catalog_id,
    material_name_snapshot: quote.materialName,
    supplier_name_snapshot: SUPPLIER_NAME_TBD,
    supply_yard_name_snapshot: SUPPLY_YARD_NAME_TBD,
    quantity: body.tons,
    unit: 'ton',
    fulfillment_method: 'delivery',
    delivery_type: schedule.delivery_type,
    delivery_address_snapshot: {
      street: body.delivery.street,
      city: body.delivery.city,
      state: body.delivery.state,
      zip: body.delivery.zip,
    },
    delivery_notes: body.delivery.notes ?? null,
    requested_delivery_window: schedule.requested_delivery_window,
    requested_delivery_date: schedule.requested_delivery_date,
    price_per_unit: quote.pricePerTonCents / 100,
    subtotal: quote.subtotalCents / 100,
    delivery_fee: quote.deliveryFeeCents / 100,
    promotion_discount: welcome5DiscountCents / 100,
    total_amount: totalAmountCents / 100,
    customer_name: `${body.contact.first_name} ${body.contact.last_name}`,
    customer_email: body.contact.email,
    customer_phone: body.contact.phone,
    source: 'website',
  }
  if (isGuest) {
    orderInsert.guest_email = body.contact.email
    orderInsert.guest_first_name = body.contact.first_name
    orderInsert.guest_last_name = body.contact.last_name
    orderInsert.guest_phone = body.contact.phone
  }

  const { data: order, error: insertErr } = await admin
    .from('orders')
    .insert(orderInsert)
    .select('id')
    .single()

  if (insertErr || !order) {
    console.error('[checkout/create-session] order insert failed', insertErr)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  // Optimistic WELCOME5 redemption. Single-use, prevents double-spend.
  // If the user abandons Stripe, they lose the promo — acceptable for v1.
  if (applyWelcome5 && user) {
    const { error: redeemErr } = await admin
      .from('profiles')
      .update({
        signup_promo_code: 'WELCOME5',
        signup_promo_redeemed_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .is('signup_promo_redeemed_at', null)
    if (redeemErr) {
      console.error('[checkout/create-session] WELCOME5 redeem mark failed', redeemErr)
      // Don't block the order; the discount is already on the line items via Stripe.
    }
  }

  // If WELCOME5: create ad-hoc Stripe Coupon and apply at session level
  let couponId: string | undefined
  if (applyWelcome5 && welcome5DiscountCents > 0) {
    try {
      const coupon = await stripe().coupons.create({
        amount_off: welcome5DiscountCents,
        currency: 'usd',
        duration: 'once',
        max_redemptions: 1,
        name: 'WELCOME5',
        metadata: { order_id: order.id, user_id: user!.id },
      })
      couponId = coupon.id
    } catch (err) {
      console.error('[checkout/create-session] coupon create failed (proceeding without)', err)
    }
  }

  // Per-minute idempotency key: collapses Stripe retries within 60s, fresh
  // click 60s later gets a fresh session.
  const emailHash = createHash('sha256')
    .update(body.contact.email.toLowerCase())
    .digest('hex')
    .slice(0, 12)
  const idemKey = `checkout_${order.id}_${emailHash}_${Math.floor(Date.now() / 60000)}`

  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${quote.materialName} (${body.tons} tons)`,
                description: `Delivery to ${body.delivery.city}, ${body.delivery.state} ${body.delivery.zip}`,
              },
              unit_amount: quote.subtotalCents,
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Delivery',
                description: body.delivery_window === 'this_week' ? 'This-week delivery' : 'Scheduled delivery',
              },
              unit_amount: quote.deliveryFeeCents,
            },
            quantity: 1,
          },
        ],
        ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
        customer_email: isGuest ? body.contact.email : undefined,
        client_reference_id: isGuest ? undefined : user!.id,
        metadata: {
          order_id: order.id,
          ...(applyWelcome5 ? { welcome5_applied: 'true', user_id: user!.id } : {}),
        },
        payment_intent_data: {
          metadata: { order_id: order.id },
        },
        success_url: `${origin}/order/confirmation/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}/checkout?cancelled=1`,
        billing_address_collection: 'auto',
        phone_number_collection: { enabled: false },
        expires_at: Math.floor(Date.now() / 1000) + 60 * 30,
        automatic_tax: { enabled: false },
      },
      { idempotencyKey: idemKey },
    )

    if (!session.url) {
      console.error('[checkout/create-session] Stripe returned no URL', { sessionId: session.id })
      return NextResponse.json({ error: 'Stripe returned no URL' }, { status: 500 })
    }

    // Persist the checkout session id on the order
    await admin
      .from('orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id)

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (err) {
    console.error('[checkout/create-session] Stripe session create failed', err)
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 })
  }
}
