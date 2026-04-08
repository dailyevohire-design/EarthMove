import { NextRequest, NextResponse, after } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { enqueueOrder } from '@/lib/dispatch'
import { sendOrderConfirmation, sendGuestClaimAccount } from '@/lib/email'

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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
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

        // Update Stripe customer ID on profile
        if (session.customer) {
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
        if (order.customer_id) {
          const customerId = order.customer_id
          const orderSnapshot = order
          after(async () => {
            try {
              // Email lives on auth.users, NOT on the profiles table — the
              // previous version queried profile.email which doesn't exist
              // and silently failed every time. Use admin.getUserById instead.
              const { data: { user: authUser }, error: userErr } = await supabase.auth.admin.getUserById(customerId)
              if (userErr || !authUser?.email) {
                console.error('[stripe-webhook] could not fetch auth user for email:', userErr)
                return
              }

              const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', customerId)
                .maybeSingle()

              const firstName = profile?.first_name
                ?? (authUser.user_metadata as any)?.first_name
                ?? 'Customer'
              const addr = orderSnapshot.delivery_address_snapshot as any

              // 1. Order confirmation (always)
              await sendOrderConfirmation({
                customerEmail:   authUser.email,
                customerName:    firstName,
                orderId:         orderSnapshot.id,
                materialName:    orderSnapshot.material_name_snapshot ?? orderSnapshot.material_name ?? 'Material',
                quantity:        orderSnapshot.quantity ?? 0,
                unit:            orderSnapshot.unit ?? 'ton',
                totalAmount:     session.amount_total ?? orderSnapshot.total_amount_cents ?? 0,
                deliveryAddress: addr ? `${addr.city}, ${addr.state} ${addr.zip}` : undefined,
                deliveryType:    orderSnapshot.delivery_type ?? 'asap',
              })

              // 2. Guest claim account (only for first-time guests)
              const meta = (authUser.user_metadata ?? {}) as any
              if (meta.was_guest_checkout && !meta.account_claimed) {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://earthmove.io'
                const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
                  type: 'recovery',
                  email: authUser.email,
                  options: { redirectTo: `${baseUrl}/account?claimed=1` },
                })
                if (linkErr || !linkData?.properties?.action_link) {
                  console.error('[stripe-webhook] could not generate recovery link:', linkErr)
                } else {
                  await sendGuestClaimAccount({
                    customerEmail: authUser.email,
                    customerName:  firstName,
                    recoveryLink:  linkData.properties.action_link,
                    orderShortId:  orderSnapshot.id.slice(-8).toUpperCase(),
                  })
                }
              }
            } catch (err) {
              console.error('[stripe-webhook] post-payment email path failed:', err)
            }
          })
        }

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
