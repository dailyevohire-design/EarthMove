import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'

type ResponseMode = 'redirect' | 'json'

async function resolveRole(userId: string): Promise<'gc' | 'driver'> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    return data?.role === 'gc' ? 'gc' : 'driver'
  } catch {
    return 'driver'
  }
}

function dashboardRoot(role: 'gc' | 'driver'): string {
  return role === 'gc' ? '/dashboard/gc/contractors' : '/dashboard/driver/trust'
}

function processingPath(role: 'gc' | 'driver'): string {
  return role === 'gc' ? '/dashboard/gc/trust/processing' : '/dashboard/driver/trust/processing'
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('session_id') ?? ''
  const format: ResponseMode = url.searchParams.get('format') === 'json' ? 'json' : 'redirect'
  const origin = url.origin

  if (!sessionId) {
    if (format === 'json') return NextResponse.json({ error: 'missing_session_id' }, { status: 400 })
    return NextResponse.redirect(`${origin}/dashboard`, { status: 303 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    if (format === 'json') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const next = encodeURIComponent(`/api/trust/checkout/success?session_id=${sessionId}`)
    return NextResponse.redirect(`${origin}/login?next=${next}`, { status: 303 })
  }

  const role = await resolveRole(user.id)
  const base = dashboardRoot(role)

  // ---- Retrieve + validate the Stripe session ----
  let session: any
  try {
    session = await stripe().checkout.sessions.retrieve(sessionId)
  } catch (err) {
    console.error('[checkout/success] stripe.retrieve failed', {
      err: err instanceof Error ? err.message : String(err),
    })
    if (format === 'json') return NextResponse.json({ error: 'session_invalid' }, { status: 400 })
    return NextResponse.redirect(`${origin}${base}?checkout=invalid`, { status: 303 })
  }

  if (
    session?.status !== 'complete' ||
    session?.payment_status !== 'paid' ||
    session?.client_reference_id !== user.id
  ) {
    if (format === 'json') return NextResponse.json({ error: 'session_invalid' }, { status: 400 })
    return NextResponse.redirect(`${origin}${base}?checkout=invalid`, { status: 303 })
  }

  const meta = session.metadata ?? {}
  const tier            = String(meta.tier ?? '')
  const contractor_name = String(meta.contractor_name ?? '')
  const state_code      = String(meta.state_code ?? '')

  if (
    !['standard', 'plus', 'deep_dive'].includes(tier) ||
    contractor_name.length < 2 ||
    !/^[A-Z]{2}$/.test(state_code)
  ) {
    if (format === 'json') return NextResponse.json({ error: 'session_invalid' }, { status: 400 })
    return NextResponse.redirect(`${origin}${base}?checkout=invalid`, { status: 303 })
  }

  // ---- Redeem atomically ----
  const admin = createAdminClient()
  const idempotency_key = `checkout:${sessionId}`

  const { data: redeemData, error: redeemErr } = await admin.rpc('redeem_credit_atomic', {
    p_user_id:         user.id,
    p_tier:            tier,
    p_contractor_name: contractor_name,
    p_state_code:      state_code,
    p_idempotency_key: idempotency_key,
  })

  if (redeemErr) {
    const msg  = redeemErr.message ?? ''
    const code = (redeemErr as any).code
    if (code === '23514' || /INSUFFICIENT_CREDITS/i.test(msg)) {
      // Webhook hasn't granted the credit yet — the processing page will poll.
      if (format === 'json') return NextResponse.json({ status: 'pending' }, { status: 202 })
      return NextResponse.redirect(
        `${origin}${processingPath(role)}?session_id=${encodeURIComponent(sessionId)}`,
        { status: 303 },
      )
    }
    console.error('[checkout/success] redeem_credit_atomic failed', { err: msg, code })
    if (format === 'json') return NextResponse.json({ error: 'redemption_failed' }, { status: 500 })
    return NextResponse.redirect(`${origin}${base}?checkout=error`, { status: 303 })
  }

  const redeemRow = Array.isArray(redeemData) ? redeemData[0] : redeemData
  if (!redeemRow?.ledger_id) {
    console.error('[checkout/success] redeem returned no ledger_id')
    if (format === 'json') return NextResponse.json({ error: 'redemption_failed' }, { status: 500 })
    return NextResponse.redirect(`${origin}${base}?checkout=error`, { status: 303 })
  }

  // ---- Enqueue the trust job ----
  const { data: jobData, error: jobErr } = await admin.rpc('enqueue_trust_job', {
    p_contractor_name: contractor_name,
    p_state_code:      state_code,
    p_city:            null,
    p_tier:            tier,
    p_user_id:         user.id,
    p_credit_id:       redeemRow.ledger_id,
    p_idempotency_key: `job:checkout:${sessionId}`,
  })

  if (jobErr) {
    console.error('[checkout/success] enqueue_trust_job failed', { err: jobErr.message })
    if (format === 'json') return NextResponse.json({ error: 'enqueue_failed' }, { status: 500 })
    return NextResponse.redirect(`${origin}${base}?checkout=error`, { status: 303 })
  }

  const jobRow = Array.isArray(jobData) ? jobData[0] : jobData
  const job_id = jobRow?.id

  if (format === 'json') return NextResponse.json({ status: 'ready', job_id })
  return NextResponse.redirect(
    `${origin}${base}?job_id=${encodeURIComponent(String(job_id))}&auto=1`,
    { status: 303 },
  )
}
