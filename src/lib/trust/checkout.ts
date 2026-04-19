import { stripe } from '@/lib/stripe'

export type TrustTier = 'standard' | 'plus' | 'deep_dive' | 'forensic'

export const VALID_TRUST_TIERS: readonly TrustTier[] = [
  'standard',
  'plus',
  'deep_dive',
  'forensic',
] as const

export interface TrustTierConfig {
  name:         string
  description:  string
  amountCents:  number
  // How long the credit is valid after purchase. Mirrored server-side by the
  // webhook (p_credit_validity_days default = 90). Keep them in sync.
  validityDays: number
}

// Single source of truth for tier pricing.
// TODO(juan): confirm prices before live traffic. These are placeholders.
// The webhook reads amount_total from Stripe, not from this config — UI/checkout
// mismatch is impossible, but the UI copy must match whatever is set here.
export const TRUST_TIER_CONFIG: Record<TrustTier, TrustTierConfig> = {
  standard: {
    name:         'Standard Report',
    description:  'License check, complaint summary, basic verification.',
    amountCents:  2900,
    validityDays: 90,
  },
  plus: {
    name:         'Plus Report',
    description:  'Standard plus lawsuits, liens, and cross-reference checks.',
    amountCents:  9900,
    validityDays: 90,
  },
  deep_dive: {
    name:         'Deep Dive',
    description:  'Full business history, entity resolution, principals.',
    amountCents:  19900,
    validityDays: 90,
  },
  forensic: {
    name:         'Forensic Report',
    description:  'Court-admissible investigation with chain-of-custody.',
    amountCents:  39700,
    validityDays: 90,
  },
}

export interface CreditCheckoutInput {
  userId:     string
  tier:       TrustTier
  successUrl: string
  cancelUrl:  string
}

/**
 * Creates a Stripe Checkout Session for a Ground Check credit purchase.
 *
 * Metadata contract (required by stripe-webhook-groundcheck Edge Function):
 *   metadata.user_id        — uuid of auth.users row (NOT nullable)
 *   metadata.tier           — one of TrustTier
 *   metadata.product_family — 'ground_check' (gates the webhook)
 *
 * Duplicated onto payment_intent_data.metadata so refund/dispute events can
 * resolve back to the originating user+tier without reading the session.
 */
export async function createCreditCheckoutSession(input: CreditCheckoutInput) {
  const cfg = TRUST_TIER_CONFIG[input.tier]

  const metadata = {
    user_id:        input.userId,
    tier:           input.tier,
    product_family: 'ground_check',
  }

  return stripe().checkout.sessions.create({
    mode: 'payment',
    customer_creation:   'always',
    client_reference_id: input.userId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency:    'usd',
          unit_amount: cfg.amountCents,
          product_data: {
            name:        cfg.name,
            description: cfg.description,
          },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    success_url: input.successUrl,
    cancel_url:  input.cancelUrl,
    billing_address_collection: 'auto',
    phone_number_collection:    { enabled: true },
    expires_at: Math.floor(Date.now() / 1000) + 60 * 30, // 30 min
  })
}
