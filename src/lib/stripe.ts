import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})

export interface CreateCheckoutInput {
  orderId: string
  stripeCustomerId: string | null
  lineItems: Array<{ name: string; description?: string; amountCents: number }>
  metadata: Record<string, string>
  successUrl: string
  cancelUrl: string
}

export async function createCheckoutSession(input: CreateCheckoutInput) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer: input.stripeCustomerId ?? undefined,
    customer_creation: input.stripeCustomerId ? undefined : 'always',
    line_items: input.lineItems.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          ...(item.description && { description: item.description }),
        },
        unit_amount: item.amountCents,
      },
      quantity: 1,
    })),
    metadata: {
      order_id: input.orderId,
      ...input.metadata,
    },
    payment_intent_data: {
      metadata: { order_id: input.orderId },
    },
    success_url: input.successUrl,
    cancel_url:  input.cancelUrl,
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: true },
    expires_at: Math.floor(Date.now() / 1000) + 60 * 30, // 30 min
  })
}

export function constructWebhookEvent(payload: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  return stripe.webhooks.constructEvent(payload, signature, secret)
}
