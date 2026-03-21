import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { enqueueOrder } from '@/lib/dispatch'

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

        // TODO: Resend order confirmation email
        // TODO: Twilio SMS confirmation
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
