import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createCreditCheckoutSession,
  VALID_TRUST_TIERS,
  type TrustTier,
} from '@/lib/trust/checkout'
import { isGroundcheckCheckoutEnabled } from '@/lib/trust/feature-flags'

// Stripe SDK is not edge-compatible (uses Node crypto).
export const runtime = 'nodejs'

interface RequestBody {
  tier?: string
}

export async function POST(req: Request) {
  // P0-3 / P0-4 / P0-6 gate. Paid GroundCheck tiers are disabled until:
  //   - /api/trust/redeem exists and consumes credits from trust_credits_ledger
  //   - Stripe live-mode products created with env-backed price IDs
  //   - TRUST_TIER_CONFIG placeholder prices confirmed by Juan
  // Returns 410 Gone while disabled so any stray clients fail loudly.
  if (!isGroundcheckCheckoutEnabled()) {
    return NextResponse.json({
      error:   'checkout_disabled',
      message: 'Paid GroundCheck tiers are temporarily unavailable. Free lookups remain active.',
    }, { status: 410 })
  }

  // ---- Auth (cookie-bound; reuses middleware session) ----
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ---- Parse body ----
  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // ---- Validate tier ----
  const tier = (body.tier ?? '').trim() as TrustTier
  if (!VALID_TRUST_TIERS.includes(tier)) {
    return NextResponse.json(
      { error: 'invalid_tier', valid: VALID_TRUST_TIERS },
      { status: 400 },
    )
  }

  // ---- Compose redirect URLs ----
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://earthmove.io'
  const successUrl = `${appUrl}/dashboard/gc?purchase=success&tier=${tier}`
  const cancelUrl  = `${appUrl}/dashboard/gc?purchase=cancel`

  // ---- Create session ----
  try {
    const session = await createCreditCheckoutSession({
      userId: user.id,
      tier,
      successUrl,
      cancelUrl,
    })

    if (!session.url) {
      console.error('[api/trust/checkout] stripe returned session with no url', {
        sessionId: session.id,
        userId:    user.id,
        tier,
      })
      return NextResponse.json({ error: 'stripe_no_url' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (err) {
    console.error('[api/trust/checkout] stripe create failed', {
      userId: user.id,
      tier,
      error:  err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'stripe_failed' }, { status: 500 })
  }
}
