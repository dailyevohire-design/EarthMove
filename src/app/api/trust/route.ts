import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { validateInput } from '@/lib/trust/prompt-guards'
import { getRateLimiter } from '@/lib/trust/rate-limiter'
import { runFreeTier } from '@/lib/trust/trust-engine'

export const runtime = 'nodejs'
export const maxDuration = 180

export async function POST(req: NextRequest) {
  const start = Date.now()

  // Re-verify auth inside handler (CVE-2025-29927 hardening — never trust middleware alone)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Parse body
  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const {
    contractor_name,
    city,
    state_code,
    tier = 'free',
    address,
    principal,
    license_number,
    ein_last4,
  } = body

  // Validate + sanitize inputs (prompt injection defense)
  const validation = validateInput(
    contractor_name ?? '',
    city ?? '',
    state_code ?? '',
    { address, principal, license_number, ein_last4 },
  )
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { name, city: sCity, state, hints } = validation.clean!

  // Tier validation
  if (!['free', 'pro', 'enterprise'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  // Paid tiers require auth
  if ((tier === 'pro' || tier === 'enterprise') && !user) {
    return NextResponse.json({ error: 'Sign in required for paid tiers' }, { status: 401 })
  }

  // Rate limiting
  const ip =
    req.headers.get('x-real-ip') ??
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
    'anon'
  const rlKey = user?.id ?? ip
  const limiter = getRateLimiter(tier)
  const { success: rlOk } = await limiter.limit(rlKey)
  if (!rlOk) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before running another report.' },
      { status: 429 }
    )
  }

  // Admin client for cache + writes (bypasses RLS)
  const admin = createAdminClient()

  // Daily cost cap (anon shares a pooled NULL-user bucket; authed has a per-user cap)
  const capUsd = user
    ? Number(process.env.TRUST_USER_DAILY_CAP_USD ?? '25')
    : Number(process.env.TRUST_ANON_DAILY_CAP_USD ?? '50')
  const { data: capData } = await admin.rpc('check_trust_daily_cost_cap', {
    p_user_id: user?.id ?? null,
    p_cap_usd: capUsd,
  })
  const capRow = Array.isArray(capData) ? capData[0] : capData
  if (capRow && !capRow.allowed) {
    return NextResponse.json(
      { error: `Daily lookup limit reached ($${Number(capRow.used_usd).toFixed(2)} / $${Number(capRow.cap_usd)}). Resets at midnight UTC.` },
      { status: 429 }
    )
  }

  // Hint fingerprint — included in cache key so disambiguation retries
  // don't hit stale cache for the no-hint version of the same query.
  const hintParts = [
    hints?.address        ?? '',
    hints?.principal      ?? '',
    hints?.license_number ?? '',
    hints?.ein_last4      ?? '',
  ].join('|')
  const hintHash = hintParts.replace(/\|/g, '')
    ? createHash('md5').update(hintParts).digest('hex')
    : ''

  // Cache check (skip enterprise — always fresh)
  if (tier !== 'enterprise') {
    const { data: cached } = await admin.rpc('get_cached_trust_report', {
      p_contractor: name,
      p_state: state,
      p_tier: tier,
      p_hint_hash: hintHash,
    })
    if (cached) {
      return NextResponse.json({ ...cached, cached: true })
    }
  }

  // Run verification
  const searches: string[] = []
  let report: any
  let costUsd = 0
  let cacheReadTokens = 0
  let cacheCreationTokens = 0

  try {
    const result = await runFreeTier(name, sCity, state, q => searches.push(q), hints)
    report              = result.report
    costUsd             = result.costUsd
    cacheReadTokens     = result.cacheReadTokens
    cacheCreationTokens = result.cacheCreationTokens
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

    await admin.from('trust_api_usage').insert({
      user_id: user?.id ?? null,
      report_id: saved?.id ?? null,
      api_provider: 'anthropic',
      searches_used: searches.length,
      cost_usd: costUsd,
      status: 'success',
    })

    if (tier !== 'enterprise') {
      await admin.rpc('set_cached_trust_report', {
        p_contractor: name,
        p_state: state,
        p_tier: tier,
        p_payload: report,
        p_hint_hash: hintHash,
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
    cache_read_tokens: cacheReadTokens,
    cache_creation_tokens: cacheCreationTokens,
  })
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST /api/trust' }, { status: 405 })
}
