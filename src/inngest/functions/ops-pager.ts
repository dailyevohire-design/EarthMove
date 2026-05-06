// src/inngest/functions/ops-pager.ts
// Operator pager: listens for `app/order.confirmed` Inngest events fired from
// the Stripe webhook on payment success, looks up the order, SMSes the
// operator on call (OPS_PHONE_E164). Read-only on the DB; defensive on missing
// fields. Failures emit a warn-severity entity_event for audit.

import { inngest } from '@/lib/inngest'
import { createAdminClient } from '@/lib/supabase/server'
import { sendOpsSms } from '@/lib/notify/twilio-sms'
import { fireAndForget, EntityType, EventSource } from '@/lib/events'

export const opsPagerOnOrderConfirmed = inngest.createFunction(
  {
    id:       'ops-pager-order-confirmed',
    triggers: [{ event: 'app/order.confirmed' }],
    retries:  3,
  },
  async ({ event, step }) => {
    const orderId = (event.data as { order_id?: string } | undefined)?.order_id
    if (!orderId) return { skipped: 'no_order_id' }

    const order = await step.run('load-order', async () => {
      const sb = createAdminClient()
      const { data, error } = await sb
        .from('orders')
        .select(`
          id, total_amount, status, market_id, customer_id,
          delivery_address, delivery_address_snapshot,
          markets:market_id ( name ),
          material_catalog:material_catalog_id ( name )
        `)
        .eq('id', orderId)
        .maybeSingle()
      if (error) throw new Error(`load_order_failed: ${error.message}`)
      return data
    })

    if (!order) return { skipped: 'order_not_found', orderId }

    type AddrSnap = { city?: string; state?: string; zip?: string; line1?: string }
    type Joined = typeof order & {
      markets?:                   { name?: string } | null
      material_catalog?:          { name?: string } | null
      delivery_address?:          string | null
      delivery_address_snapshot?: AddrSnap | null
    }
    const o = order as Joined
    const market   = o.markets?.name          ?? '?'
    const material = o.material_catalog?.name ?? 'material'
    const total    = o.total_amount != null ? `$${Number(o.total_amount).toFixed(0)}` : '$?'
    const addr     = o.delivery_address_snapshot ?? null
    const dest     = addr?.zip
                  ?? addr?.city
                  ?? o.delivery_address
                  ?? '?'
    const shortId  = orderId.slice(0, 8)
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://earthmove.io'

    const body =
      `🚨 ORDER ${shortId}\n` +
      `${material}\n` +
      `→ ${dest} (${market})\n` +
      `${total}\n` +
      `${appUrl}/admin/command`

    const result = await step.run('send-sms', () => sendOpsSms(body))

    fireAndForget({
      entityType: EntityType.ORDER,
      entityId:   orderId,
      eventType:  'ops.pager.sent',
      severity:   result.delivered ? 'info' : 'warn',
      source:     EventSource.INNGEST,
      payload:    { delivered: result.delivered, error: result.error, sid: result.sid },
    })

    return result
  },
)
