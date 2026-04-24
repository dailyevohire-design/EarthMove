import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { isGroundcheckCheckoutEnabled } from '@/lib/trust/feature-flags'
import { assertEntityOnly, EntityOnlyError } from '@/lib/trust/trust-validator'

// Stripe SDK is not edge-compatible (uses Node crypto).
export const runtime = 'nodejs'

type RedemptionTier = 'standard' | 'plus' | 'deep_dive'
const VALID_TIERS: readonly RedemptionTier[] = ['standard', 'plus', 'deep_dive']

const TIER_PRICE_ENV: Record<RedemptionTier, string> = {
  standard:  'STRIPE_PRICE_TRUST_STANDARD',
  plus:      'STRIPE_PRICE_TRUST_PLUS',
  deep_dive: 'STRIPE_PRICE_TRUST_DEEP_DIVE',
}

function sanitizeReturnPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return '/dashboard'
  if (!raw.startsWith('/')) return '/dashboard'
  if (raw.startsWith('//')) return '/dashboard'
  // Reject anything that looks like an absolute URL after the leading slash
  // (e.g. "/\evil.com", "/http://evil.com"). Require path-only.
  if (/^\/[^\/a-zA-Z0-9_\-\.~?#&=%]/.test(raw)) return '/dashboard'
  return raw
}

function resolveOrigin(req: Request): string | null {
  const fromHeader = req.headers.get('origin')
  const fromUrl = (() => {
    try { return new URL(req.url).origin } catch { return null }
  })()
  const origin = fromHeader ?? fromUrl
  if (!origin) return null

  const allowlistEnv = process.env.STRIPE_ALLOWED_ORIGINS
  if (allowlistEnv) {
    const allowed = allowlistEnv.split(',').map(s => s.trim()).filter(Boolean)
    return allowed.includes(origin) ? origin : null
  }
  const fallback = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (!fallback) return null
  try {
    return new URL(fallback).origin === origin ? origin : null
  } catch {
    return null
  }
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

  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const tier = String(body.tier ?? '').trim() as RedemptionTier
  if (!VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'invalid_tier', valid: VALID_TIERS }, { status: 400 })
  }

  const contractor_name = typeof body.contractor_name === 'string' ? body.contractor_name.trim() : ''
  if (contractor_name.length < 2 || contractor_name.length > 200) {
    return NextResponse.json({ error: 'invalid_contractor_name' }, { status: 400 })
  }

  const state_code = typeof body.state_code === 'string' ? body.state_code.trim().toUpperCase() : ''
  if (!/^[A-Z]{2}$/.test(state_code)) {
    return NextResponse.json({ error: 'invalid_state_code' }, { status: 400 })
  }

  const return_path = sanitizeReturnPath(body.return_path)

  try {
    assertEntityOnly(contractor_name)
  } catch (err) {
    if (err instanceof EntityOnlyError) {
      return NextResponse.json({
        error:   'entity_only',
        message: 'Background checks on individuals are handled through our verified partner. Entity lookups (LLC, Corp, etc.) are supported here.',
      }, { status: 422 })
    }
    throw err
  }

  const priceEnv = TIER_PRICE_ENV[tier]
  const priceId = process.env[priceEnv]
  if (!priceId) {
    console.error('[api/trust/checkout] missing stripe price env var', { env: priceEnv })
    return NextResponse.json({ error: 'stripe_price_not_configured' }, { status: 500 })
  }

  const origin = resolveOrigin(req)
  if (!origin) {
    console.error('[api/trust/checkout] origin rejected')
    return NextResponse.json({ error: 'origin_not_allowed' }, { status: 400 })
  }

  // Fetch user email from profiles (fallback to auth user email)
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .maybeSingle()
  const email = profile?.email ?? user.email ?? undefined

  // Per-minute stable idempotency key so Stripe retries within the same minute
  // collapse but a fresh click 60s later gets a new session.
  const nameHash = createHash('sha256')
    .update(`${contractor_name}|${state_code}`)
    .digest('hex')
    .slice(0, 12)
  const idemKey = `trust_checkout_${user.id}_${tier}_${nameHash}_${Math.floor(Date.now() / 60000)}`

  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: email,
        client_reference_id: user.id,
        metadata: {
          tier,
          contractor_name,
          state_code,
          user_id: user.id,
          product_family: 'ground_check',
        },
        payment_intent_data: {
          metadata: {
            tier,
            contractor_name,
            state_code,
            user_id: user.id,
            product_family: 'ground_check',
          },
        },
        success_url: `${origin}/api/trust/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}${return_path}?checkout=cancelled`,
        automatic_tax: { enabled: false },
      },
      { idempotencyKey: idemKey },
    )

    if (!session.url) {
      console.error('[api/trust/checkout] stripe returned session with no url', { sessionId: session.id })
      return NextResponse.json({ error: 'stripe_no_url' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (err) {
    console.error('[api/trust/checkout] stripe create failed', {
      userId: user.id, tier,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'stripe_failed' }, { status: 500 })
  }
}
