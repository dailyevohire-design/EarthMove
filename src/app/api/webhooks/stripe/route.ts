import { NextRequest, NextResponse, after } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { enqueueOrder } from '@/lib/dispatch'
import { sendOrderConfirmation, sendGuestClaimAccount } from '@/lib/email'
import { generateAndStoreCase } from '@/lib/collections/generator'
import { inngest } from '@/lib/inngest'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event
  try {
    event = constructWebhookEvent(body, sig)
  } catch (err) {
    console.error('[stripe-webhook] signature failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Idempotency guard — claims the event before any side effects.
  // Stripe retries on any 5xx or timeout. Without this, a retry that arrives
  // while the first call is still in-flight can double-enqueue. Subsequent
  // retries (after first call completes) are already covered by the
  // status='pending_payment' UPDATE filter, but in-flight collisions weren't.
  const { error: claimError } = await supabase
    .from('webhook_events')
    .insert({ event_id: event.id, source: 'stripe' })

  if (claimError?.code === '23505') {
    // Duplicate — another invocation already claimed this event. Return 200
    // so Stripe stops retrying.
    return NextResponse.json({ received: true, duplicate: true })
  }
  if (claimError) {
    // DB unreachable — let Stripe retry.
    console.error('[stripe-webhook] webhook_events insert failed', {
      event_id: event.id,
      code:     claimError.code,
      message:  claimError.message,
    })
    return NextResponse.json({ error: 'db error' }, { status: 500 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any

        // Route 1: Collections Assist (product_family='collections')
        if (session.metadata?.product_family === 'collections') {
          const caseId = session.metadata?.case_id
          const userId = session.metadata?.user_id
          if (!caseId || !userId) {
            return NextResponse.json({ error: 'missing case_id or user_id metadata' }, { status: 400 })
          }
          if (session.client_reference_id && session.client_reference_id !== userId) {
            return NextResponse.json({ error: 'user_mismatch' }, { status: 400 })
          }

          const { error: rpcErr } = await supabase.rpc('grant_collections_case_from_stripe_event', {
            p_stripe_event_id:          event.id,
            p_event_type:               event.type,
            p_case_id:                  caseId,
            p_user_id:                  userId,
            p_amount_cents:             session.amount_total ?? 0,
            p_stripe_session_id:        session.id,
            p_stripe_payment_intent_id: session.payment_intent ?? null,
            p_payload:                  { session_id: session.id },
          })
          if (rpcErr) {
            console.error('[stripe-webhook] collections grant RPC failed:', rpcErr)
            await supabase.from('collections_case_events').insert({
              case_id: caseId,
              event_type: 'error',
              event_payload: { stage: 'grant_rpc', error: rpcErr.message },
              stripe_event_id: event.id,
            })
            return NextResponse.json({ error: 'grant_failed' }, { status: 500 })
          }

          // Generate PDFs after a 2xx to Stripe is safe because the case row is already
          // flipped to 'paid' — a failure here leaves a retryable async task, not a money gap.
          after(async () => {
            try {
              await generateAndStoreCase(caseId)
            } catch (genErr) {
              console.error('[stripe-webhook] PDF generation failed (status stays paid):', genErr)
            }
          })

          break
        }

        // Route 2: Aggregate-materials orders (product_family=undefined, order_id metadata)
        const orderId = session.metadata?.order_id
        if (!orderId) break

        const { data: order } = await supabase
          .from('orders')
          .update({
            status:                   'confirmed',
            stripe_payment_intent_id: session.payment_intent as string,
            paid_at:                  new Date().toISOString(),
          })
          .eq('id', orderId)
          .eq('status', 'pending_payment')   // idempotency guard
          .select('*')
          .single()

        if (!order) break  // already processed

        // Fan out to the ops pager via Inngest. Wrapped in try/catch so a
        // pager outage cannot bubble up to a 5xx and force Stripe to retry
        // the whole webhook.
        try {
          await inngest.send({
            name: 'app/order.confirmed',
            data: { order_id: order.id },
          })
        } catch (pagerErr) {
          console.error('[stripe-webhook] inngest.send(app/order.confirmed) failed:', pagerErr)
        }

        // Enqueue for dispatch. If this fails we MUST NOT let Stripe retry the
        // whole webhook — the idempotency guard above would skip re-processing
        // and the order would sit "confirmed" but un-dispatched forever. Instead
        // we record a dispatch_failed audit event and return 200; a human or
        // recovery job can resolve from there.
        try {
          await enqueueOrder(order as any)
        } catch (dispatchErr) {
          console.error('[stripe-webhook] enqueueOrder failed, logging for manual dispatch:', dispatchErr)
          await supabase.from('audit_events').insert({
            event_type:  'order.dispatch_failed',
            entity_type: 'orders',
            entity_id:   orderId,
            actor_role:  'admin',
            payload:     {
              stripe_session_id: session.id,
              error:             dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr),
            },
          })
        }

        // Update Stripe customer ID on profile (only for authed customers)
        if (session.customer && order.customer_id) {
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: session.customer })
            .eq('id', order.customer_id)
            .is('stripe_customer_id', null)
        }

        // Audit
        await supabase.from('audit_events').insert({
          event_type:  'order.payment_confirmed',
          entity_type: 'orders',
          entity_id:   orderId,
          actor_role:  'admin',
          payload:     { stripe_session_id: session.id, amount: session.amount_total },
        })

        // Send post-payment emails after the webhook responds.
        // `after()` keeps the Fluid Compute instance alive to finish this work
        // without blocking our 2xx back to Stripe (which must be fast, < 5s).
        const orderSnapshot = order
        after(async () => {
          try {
            // Resolve recipient email + name from either the auth user OR the
            // order's guest_* columns. Orders now carry their own identity.
            let recipientEmailFinal: string | null = null
            let recipientFirstName = 'Customer'
            let isGuest = false

            if (orderSnapshot.customer_id) {
              const { data: { user: authUser }, error: userErr } = await supabase.auth.admin.getUserById(orderSnapshot.customer_id)
              if (userErr || !authUser?.email) {
                console.error('[stripe-webhook] could not fetch auth user:', userErr)
                return
              }
              recipientEmailFinal = authUser.email
              const { data: profile } = await supabase
                .from('profiles')
                .select('first_name')
                .eq('id', orderSnapshot.customer_id)
                .maybeSingle()
              recipientFirstName = profile?.first_name
                ?? (authUser.user_metadata as any)?.first_name
                ?? 'Customer'
            } else if (orderSnapshot.guest_email) {
              recipientEmailFinal = orderSnapshot.guest_email
              recipientFirstName = orderSnapshot.guest_first_name ?? 'Customer'
              isGuest = true
            } else {
              console.error('[stripe-webhook] order has no customer_id or guest_email — cannot send email')
              return
            }

            if (!recipientEmailFinal) return // narrowing for TS
            const addr = orderSnapshot.delivery_address_snapshot as any

            // 1. Order confirmation (always)
            await sendOrderConfirmation({
              customerEmail:   recipientEmailFinal,
              customerName:    recipientFirstName,
              orderId:         orderSnapshot.id,
              materialName:    orderSnapshot.material_name_snapshot ?? 'Material',
              quantity:        orderSnapshot.quantity ?? 0,
              unit:            orderSnapshot.unit ?? 'ton',
              totalAmount:     session.amount_total ?? 0,
              deliveryAddress: addr ? `${addr.city}, ${addr.state} ${addr.zip}` : undefined,
              deliveryType:    orderSnapshot.delivery_type ?? 'asap',
            })

            // 2. For guest orders, send a "claim your account" email with a
            // signup link prefilled with their email + name. No auth.users row
            // exists yet — the user creates one through the normal signup flow.
            if (isGuest) {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://earthmove.io'
              const claimLink = `${baseUrl}/signup?email=${encodeURIComponent(recipientEmailFinal)}&first_name=${encodeURIComponent(recipientFirstName)}&from_order=${orderSnapshot.id.slice(-8)}`
              await sendGuestClaimAccount({
                customerEmail: recipientEmailFinal,
                customerName:  recipientFirstName,
                recoveryLink:  claimLink,
                orderShortId:  orderSnapshot.id.slice(-8).toUpperCase(),
              })
            }
          } catch (err) {
            console.error('[stripe-webhook] post-payment email path failed:', err)
          }
        })

        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as any
        const orderId = session.metadata?.order_id
        if (orderId) {
          await supabase.from('orders')
            .update({ status: 'payment_failed' })
            .eq('id', orderId)
            .eq('status', 'pending_payment')
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as any
        const orderId = pi.metadata?.order_id
        if (orderId) {
          await supabase.from('orders')
            .update({ status: 'payment_failed' })
            .eq('id', orderId)
            .eq('stripe_payment_intent_id', pi.id)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[stripe-webhook] processing error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
