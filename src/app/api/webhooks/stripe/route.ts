import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { enqueueOrder } from '@/lib/dispatch'
import { sendOrderConfirmation } from '@/lib/email'

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

        // Enqueue for dispatch
        await enqueueOrder(order as any)

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

        // Send order confirmation email (non-blocking)
        if (order.customer_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', order.customer_id)
            .single()

          if (profile?.email) {
            const addr = order.delivery_address_snapshot as any
            sendOrderConfirmation({
              customerEmail: profile.email,
              customerName: profile.first_name ?? 'Customer',
              orderId: order.id,
              materialName: order.material_name ?? 'Material',
              quantity: order.quantity ?? 0,
              unit: order.unit ?? 'ton',
              totalAmount: session.amount_total ?? order.total_amount_cents ?? 0,
              deliveryAddress: addr ? `${addr.city}, ${addr.state} ${addr.zip}` : undefined,
              deliveryType: order.delivery_type ?? 'asap',
            }).catch(err => console.error('[stripe-webhook] email send failed:', err))
          }
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
