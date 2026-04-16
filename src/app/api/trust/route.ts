import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { validateInput } from '@/lib/trust/prompt-guards'
import { getRateLimiter, checkDailyCostCap, recordCost } from '@/lib/trust/rate-limiter'
import { runFreeTier } from '@/lib/trust/trust-engine'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const start = Date.now()

  // Re-verify auth inside handler (CVE-2025-29927 hardening — never trust middleware alone)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Parse body
  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { contractor_name, city, state_code, tier = 'free' } = body

  // Validate + sanitize inputs (prompt injection defense)
  const validation = validateInput(contractor_name ?? '', city ?? '', state_code ?? '')
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { name, city: sCity, state } = validation.clean!

  // Tier validation
  if (!['free', 'pro', 'enterprise'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  // Paid tiers require auth
  if ((tier === 'pro' || tier === 'enterprise') && !user) {
    return NextResponse.json({ error: 'Sign in required for paid tiers' }, { status: 401 })
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
  const rlKey = user?.id ?? ip
  const limiter = getRateLimiter(tier)
  const { success: rlOk } = await limiter.limit(rlKey)
  if (!rlOk) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before running another report.' },
      { status: 429 }
    )
  }

  // Daily cost cap
  if (user) {
    const { allowed, used, cap } = await checkDailyCostCap(user.id, tier)
    if (!allowed) {
      return NextResponse.json(
        { error: `Daily lookup limit reached ($${used.toFixed(2)} / $${cap}). Resets at midnight UTC.` },
        { status: 429 }
      )
    }
  }

  // Admin client for cache + writes (bypasses RLS)
  const admin = createAdminClient()

  // Cache check (skip enterprise — always fresh)
  if (tier !== 'enterprise') {
    const { data: cached } = await admin.rpc('get_cached_trust_report', {
      p_contractor: name,
      p_state: state,
      p_tier: tier,
    })
    if (cached) {
      return NextResponse.json({ ...cached, cached: true })
    }
  }

  // Run verification
  const searches: string[] = []
  let report: any
  let costUsd = 0

  try {
    const result = await runFreeTier(name, sCity, state, q => searches.push(q))
    report = result.report
    costUsd = result.costUsd
  } catch (err: any) {
    console.error('[TrustAPI]', err.message)
    return NextResponse.json({ error: err.message ?? 'Verification failed' }, { status: 500 })
  }

  const processingMs = Date.now() - start

  // Persist + cache (non-fatal)
  try {
    const { data: saved } = await admin.from('trust_reports').insert({
      user_id: user?.id ?? null,
      contractor_name: name,
      city: sCity,
      state_code: state,
      tier,
      trust_score: report.trust_score,
      risk_level: report.risk_level,
      confidence_level: report.confidence_level,
      biz_status: report.business_registration?.status,
      lic_status: report.licensing?.status,
      bbb_rating: report.bbb_profile?.rating,
      review_avg_rating: report.reviews?.average_rating,
      review_sentiment: report.reviews?.sentiment,
      legal_status: report.legal_records?.status,
      osha_status: report.osha_violations?.status,
      red_flags: report.red_flags ?? [],
      positive_indicators: report.positive_indicators ?? [],
      summary: report.summary,
      data_sources_searched: report.data_sources_searched ?? [],
      raw_report: report,
      searches_performed: searches.length,
      api_cost_usd: costUsd,
      processing_ms: processingMs,
    }).select('id').maybeSingle()

    if (user) {
      await admin.from('trust_api_usage').insert({
        user_id: user.id,
        report_id: saved?.id ?? null,
        api_provider: 'anthropic',
        searches_used: searches.length,
        cost_usd: costUsd,
        status: 'success',
      })
      await recordCost(user.id, costUsd)
    }

    if (tier !== 'enterprise') {
      await admin.rpc('set_cached_trust_report', {
        p_contractor: name,
        p_state: state,
        p_tier: tier,
        p_payload: report,
      })
    }
  } catch (dbErr) {
    console.error('[TrustAPI] DB write error (non-fatal):', dbErr)
  }

  return NextResponse.json({
    ...report,
    searches,
    searches_performed: searches.length,
    processing_ms: processingMs,
    cached: false,
  })
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST /api/trust' }, { status: 405 })
}
