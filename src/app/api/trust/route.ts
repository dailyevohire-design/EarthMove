import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { validateInput } from '@/lib/trust/prompt-guards'
import { getRateLimiter } from '@/lib/trust/rate-limiter'
import { runFreeTier } from '@/lib/trust/trust-engine'

export const runtime = 'nodejs'
export const maxDuration = 180

// P0-7. Minimal entity-suffix heuristic. A non-match rejects the query as an
// individual (natural-person) lookup, routing the user to Checkr rather than
// running a Claude search against a real person's name. Word-boundary match
// so "COMPANY OF FLORIDA" still triggers on COMPANY.
const ENTITY_SUFFIX_RE = /\b(LLC|L\.L\.C\.?|INC|INCORPORATED|CORP|CORPORATION|LTD|LIMITED|CO\.?|COMPANY|GROUP|HOLDINGS|ENTERPRISES|LP|LLP|PLLC|PC|P\.C\.|ASSOCIATES|PARTNERS|SOLUTIONS|SERVICES|CONSTRUCTION|CONTRACTING|BUILDERS|EXCAVATION|GRADING|HAULING|MATERIALS|AGGREGATES)\b/i

export async function POST(req: NextRequest) {
  const start = Date.now()

  // CVE-2025-29927 defense-in-depth: reject any request carrying the
  // middleware-subrequest header. Next 16 blocks this at the framework level;
  // this is layer 2.
  if (req.headers.get('x-middleware-subrequest')) {
    return NextResponse.json({ error: 'malformed_request' }, { status: 400 })
  }

  // Re-verify auth inside handler (CVE-2025-29927 hardening — never trust middleware alone)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Server-side activeness check. Anonymous free-tier callers are preserved by
  // the !user skip — no profile lookup happens for them.
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()
    if (profileError || !profile) {
      return NextResponse.json({ error: 'profile_not_found' }, { status: 403 })
    }
    if (!profile.is_active) {
      return NextResponse.json({ error: 'account_inactive' }, { status: 403 })
    }
  }

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

  // Admin client for cache, audit log, and writes (bypasses RLS)
  const admin = createAdminClient()

  const ip =
    req.headers.get('x-real-ip') ??
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
    null

  // P0-7. FCRA / entity-type gate. Reject anything without a business-entity
  // suffix before spending any tokens. Log every rejection to trust_audit_log
  // so legal has a paper trail of queries we refused. Non-blocking on audit
  // write failure — the rejection itself is the safety property.
  const nameForClassification = name.replace(/[.,]/g, ' ')
  const looksLikeEntity = ENTITY_SUFFIX_RE.test(nameForClassification)
  if (!looksLikeEntity) {
    try {
      await admin.from('trust_audit_log').insert({
        actor_user_id: user?.id ?? null,
        actor_role:    user ? 'authenticated' : 'anon',
        action:        'individual_lookup_rejected',
        target_type:   'trust_query',
        target_id:     null,
        after_state:   { contractor_name: name, city: sCity, state, tier },
        reason:        'no_entity_suffix_detected',
        ip_address:    ip,
      })
    } catch (auditErr) {
      console.error('[TrustAPI] audit log write failed (non-fatal)', auditErr)
    }
    return NextResponse.json({
      error:      'individual_lookup_requires_checkr',
      message:    'Background checks on individuals are handled through our verified partner. Entity lookups (LLC, Corp, etc.) are supported here.',
      checkr_url: process.env.CHECKR_PARTNER_URL ?? null,
    }, { status: 422 })
  }

  // Rate limiting — P0-1. The limiter now fails closed internally (rate-limiter.ts
  // catches RPC errors and returns { success: false }). Wrap in try/catch as a
  // belt-and-suspenders guard against library-level throws.
  const rlKey = user?.id ?? ip ?? 'anon'
  let rlOk = false
  try {
    const limiter = getRateLimiter(tier)
    const { success } = await limiter.limit(rlKey)
    rlOk = success
  } catch (rlErr) {
    console.error('[TrustAPI] rate limiter threw — failing closed', rlErr)
    return NextResponse.json(
      { error: 'rate_limiter_unavailable' },
      { status: 503 }
    )
  }
  if (!rlOk) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before running another report.' },
      { status: 429 }
    )
  }

  // P0-2. Daily cost cap — fail CLOSED on RPC error. Previously if
  // admin.rpc() returned { data: null, error: ... } the short-circuit
  // `capRow && !capRow.allowed` skipped the check and the request
  // proceeded to Claude. Read `error` explicitly and 503 on any anomaly.
  const capUsd = user
    ? Number(process.env.TRUST_USER_DAILY_CAP_USD ?? '25')
    : Number(process.env.TRUST_ANON_DAILY_CAP_USD ?? '50')
  const { data: capData, error: capErr } = await admin.rpc('check_trust_daily_cost_cap', {
    p_user_id: user?.id ?? null,
    p_cap_usd: capUsd,
  })
  if (capErr || capData == null) {
    console.error('[TrustAPI] cost cap rpc error — failing closed', {
      err: capErr?.message ?? 'null_data',
    })
    return NextResponse.json({ error: 'cost_cap_unavailable' }, { status: 503 })
  }
  const capRow = Array.isArray(capData) ? capData[0] : capData
  if (capRow == null) {
    return NextResponse.json({ error: 'cost_cap_unavailable' }, { status: 503 })
  }
  if (!capRow.allowed) {
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
  let tokensIn = 0
  let tokensOut = 0
  let cacheReadTokens = 0
  let cacheCreationTokens = 0
  let piiHits: string[] = []

  try {
    const result = await runFreeTier(name, sCity, state, q => searches.push(q), hints)
    report              = result.report
    costUsd             = result.costUsd
    tokensIn            = result.tokensIn
    tokensOut           = result.tokensOut
    cacheReadTokens     = result.cacheReadTokens
    cacheCreationTokens = result.cacheCreationTokens
    piiHits             = result.piiHits
  } catch (err: any) {
    console.error('[TrustAPI]', err.message)
    return NextResponse.json({ error: err.message ?? 'Verification failed' }, { status: 500 })
  }

  const processingMs = Date.now() - start

  // Persist + cache (non-fatal)
  let savedReportId: string | null = null
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

    savedReportId = saved?.id ?? null

    await admin.from('trust_api_usage').insert({
      user_id: user?.id ?? null,
      report_id: savedReportId,
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

  // P1-12. If the PII scrubber fired, log to audit with the persisted
  // report id (if any) so legal can trace which report had signals.
  if (piiHits.length > 0) {
    try {
      await admin.from('trust_audit_log').insert({
        actor_user_id: user?.id ?? null,
        actor_role:    user ? 'authenticated' : 'anon',
        action:        'pii_scrubbed',
        target_type:   'trust_report',
        target_id:     savedReportId,
        after_state:   { pii_hits: piiHits, contractor_name: name, state },
        reason:        null,
        ip_address:    ip,
      })
    } catch (auditErr) {
      console.error('[TrustAPI] pii audit log write failed (non-fatal)', auditErr)
    }
  }

  return NextResponse.json({
    ...report,
    searches,
    searches_performed: searches.length,
    processing_ms: processingMs,
    cached: false,
    cache_read_tokens: cacheReadTokens,
    cache_creation_tokens: cacheCreationTokens,
    meta: {
      cost_usd:              Number(costUsd.toFixed(4)),
      tokens_in:             tokensIn,
      tokens_out:            tokensOut,
      cache_read_tokens:     cacheReadTokens,
      cache_creation_tokens: cacheCreationTokens,
      searches_performed:    searches.length,
      processing_ms:         processingMs,
      pii_hits:              piiHits,
    },
  })
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST /api/trust' }, { status: 405 })
}
