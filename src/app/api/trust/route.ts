import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { validateInput } from '@/lib/trust/prompt-guards'
import { getRateLimiter, checkDailyCostCap, checkAnonDailyCap } from '@/lib/trust/rate-limiter'
import { runFreeTier } from '@/lib/trust/trust-engine'
import { findPlaceAndReviews } from '@/lib/trust/google-places'
import { inngest } from '@/lib/inngest'

export const runtime = 'nodejs'
export const maxDuration = 180

const ENTITY_SUFFIX_RE = /\b(LLC|L\.L\.C\.?|INC|INCORPORATED|CORP|CORPORATION|LTD|LIMITED|CO\.?|COMPANY|GROUP|HOLDINGS|ENTERPRISES|LP|LLP|PLLC|PC|P\.C\.|ASSOCIATES|PARTNERS|SOLUTIONS|SERVICES|CONSTRUCTION|CONTRACTING|BUILDERS|EXCAVATION|GRADING|HAULING|MATERIALS|AGGREGATES)\b/i

// Resolve the user's trust tier server-side from v_trust_entitlement. The
// request body's tier is a *requested* tier (used for credit-redemption
// branch selection); never trust it for cap enforcement.
async function resolveTrustTier(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string> {
  try {
    const { data, error } = await admin
      .from('v_trust_entitlement')
      .select('plan_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[TrustAPI] resolveTrustTier query error — defaulting to free', {
        userId, err: error.message,
      })
      return 'free'
    }
    return data?.plan_id ?? 'free'
  } catch (err) {
    console.error('[TrustAPI] resolveTrustTier threw — defaulting to free', {
      userId, err: err instanceof Error ? err.message : String(err),
    })
    return 'free'
  }
}

export async function POST(req: NextRequest) {
  const start = Date.now()

  if (req.headers.get('x-middleware-subrequest')) {
    return NextResponse.json({ error: 'malformed_request' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  // Credit-backed report SKUs (consume 1 credit from trust_credits_ledger).
  const REDEMPTION_TIERS = new Set(['standard', 'plus', 'deep_dive', 'forensic'])
  // Subset of REDEMPTION_TIERS that runs async via Inngest. 'standard' is
  // credit-backed but synchronous (Sonar+Anthropic during the request).
  const JOB_TIERS = new Set(['plus', 'deep_dive', 'forensic'])
  if (
    !['free', 'standard', 'pro'].includes(tier) &&
    !REDEMPTION_TIERS.has(tier)
  ) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  if ((tier === 'pro' || REDEMPTION_TIERS.has(tier)) && !user) {
    return NextResponse.json({ error: 'Sign in required for paid tiers' }, { status: 401 })
  }

  const admin = createAdminClient()

  const ip =
    req.headers.get('x-real-ip') ??
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
    null

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

  // Resolve tier server-side from v_trust_entitlement. Drives both rate-limit
  // bucket selection and the daily cost cap; body `tier` is a *requested* tier
  // (still used for credit-redemption branch routing) — never authoritative
  // for enforcement.
  const resolvedTier = user
    ? await resolveTrustTier(admin, user.id)
    : 'anon'
  if (user && tier !== resolvedTier) {
    console.info('[TrustAPI] requested tier differs from entitlement — using entitlement', {
      userId: user.id, requested: tier, resolved: resolvedTier,
    })
  }

  const rlKey = user?.id ?? ip ?? 'anon'
  let rlOk = false
  try {
    const limiter = getRateLimiter(resolvedTier)
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

  if (!user) {
    if (!ip) {
      console.error('[TrustAPI] anon request with no IP header — failing closed')
      return NextResponse.json({ error: 'cannot_identify_caller' }, { status: 503 })
    }
    const anonResult = await checkAnonDailyCap(ip)
    if (!anonResult.success) {
      return NextResponse.json(
        {
          error:   'anon_daily_limit_reached',
          message: "You've used your free daily search. Create a free account for unlimited free reports — no credit card required.",
          reset:   anonResult.reset,
        },
        { status: 429 }
      )
    }
  } else {
    const capResult = await checkDailyCostCap(user.id, resolvedTier)
    if (!capResult.allowed) {
      return NextResponse.json(
        {
          error:   'daily_cost_cap_reached',
          message: `Daily lookup limit reached ($${capResult.used.toFixed(2)} / $${capResult.cap.toFixed(2)}). Resets at midnight UTC.`,
          tier:    resolvedTier,
          used:    capResult.used,
          cap:     capResult.cap,
        },
        { status: 429 }
      )
    }
  }

  // Credit-backed tiers: redeem one ledger entry up front. 'standard' falls
  // through to the sync Sonar+Anthropic path below; JOB_TIERS enqueue an
  // async trust_jobs row and emit a trust/job.enqueued Inngest event,
  // returning 202 + a poll URL.
  let redeemedCreditId:        string | null = null
  let redeemedAlreadyRedeemed: boolean       = false
  let redeemedNewBalance:      number        = 0
  let idempotencyKey:          string        = ''

  if (REDEMPTION_TIERS.has(tier)) {
    idempotencyKey =
      (typeof body.idempotency_key === 'string' && body.idempotency_key.length > 0)
        ? body.idempotency_key
        : 'req:' + randomUUID()

    const { data: redeemData, error: redeemErr } = await admin.rpc('redeem_credit_atomic', {
      p_user_id:         user!.id,
      p_tier:            tier,
      p_contractor_name: name,
      p_state_code:      state,
      p_idempotency_key: idempotencyKey,
    })

    if (redeemErr) {
      const msg  = redeemErr.message ?? ''
      const code = (redeemErr as any).code
      if (code === '23514' || /INSUFFICIENT_CREDITS/i.test(msg)) {
        return NextResponse.json(
          { error: 'insufficient_credits', tier, checkout_url: '/api/trust/checkout' },
          { status: 402 }
        )
      }
      console.error('[TrustAPI] redeem_credit_atomic failed', { tier, err: msg, code })
      return NextResponse.json({ error: 'redemption_failed' }, { status: 500 })
    }

    const redeemRow = Array.isArray(redeemData) ? redeemData[0] : redeemData
    if (!redeemRow?.ledger_id) {
      console.error('[TrustAPI] redeem_credit_atomic returned no ledger_id', { redeemRow })
      return NextResponse.json({ error: 'redemption_failed' }, { status: 500 })
    }
    redeemedCreditId        = redeemRow.ledger_id
    redeemedAlreadyRedeemed = Boolean(redeemRow.already_redeemed)
    redeemedNewBalance      = Number(redeemRow.new_balance ?? 0)

    // Async branch: enqueue + Inngest send + 202. Standard falls through.
    if (JOB_TIERS.has(tier)) {
      const { data: jobData, error: jobErr } = await admin.rpc('enqueue_trust_job', {
        p_contractor_name: name,
        p_state_code:      state,
        p_city:            sCity || null,
        p_tier:            tier,
        p_user_id:         user!.id,
        p_credit_id:       redeemedCreditId,
        p_idempotency_key: 'job:' + idempotencyKey,
      })

      if (jobErr) {
        console.error('[TrustAPI] enqueue_trust_job failed', { err: jobErr.message })
        return NextResponse.json({ error: 'enqueue_failed' }, { status: 500 })
      }

      const jobRow = Array.isArray(jobData) ? jobData[0] : jobData
      if (!jobRow?.id) {
        console.error('[TrustAPI] enqueue_trust_job returned no id', { jobRow })
        return NextResponse.json({ error: 'enqueue_failed' }, { status: 500 })
      }

      // Best-effort dispatch. The job row is durable; if Inngest is
      // unavailable, a fallback dispatcher (Tranche B) can re-emit the event.
      try {
        const trustJobVersion = process.env.TRUST_JOB_VERSION === 'v2' ? 'v2' : 'v1'
        const trustEventName = trustJobVersion === 'v2' ? 'trust/job.requested.v2' : 'trust/job.enqueued'
        await inngest.send({
          name: trustEventName,
          data: { job_id: jobRow.id },
        })
      } catch (sendErr) {
        console.error('[TrustAPI] inngest.send failed (job is enqueued; can be redispatched)', sendErr)
      }

      return NextResponse.json(
        {
          status:           'queued',
          job_id:           jobRow.id,
          poll_url:         `/api/trust/jobs/${jobRow.id}`,
          already_redeemed: redeemedAlreadyRedeemed,
          new_balance:      redeemedNewBalance,
        },
        { status: 202 }
      )
    }
    // 'standard': credit redeemed, fall through to sync path below.
  }

  const hintParts = [
    hints?.address        ?? '',
    hints?.principal      ?? '',
    hints?.license_number ?? '',
    hints?.ein_last4      ?? '',
  ].join('|')
  const hintHash = hintParts.replace(/\|/g, '')
    ? createHash('md5').update(hintParts).digest('hex')
    : ''

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

  // Free-tier review enrichment: replace LLM-synthesized review fields (which
  // are unreliable on the free path) with deterministic Google Places data.
  // Null-safe — see google-places.ts. If the call returns null (missing key,
  // Places API not enabled, no match, network failure), the existing
  // LLM-synthesized values stay in report.reviews unchanged, so behavior is
  // strictly additive.
  try {
    const places = await findPlaceAndReviews({
      contractor_name: name,
      city: sCity,
      state_code: state,
    })
    if (places) {
      report.reviews = {
        ...(report.reviews ?? {}),
        average_rating: places.rating,
        total_reviews: places.total,
        sentiment: places.sentiment,
        sources: ['google_places'],
        place_id: places.place_id,
        matched_name: places.matched_name,
        matched_address: places.matched_address,
      }
    }
  } catch (placesErr) {
    console.error('[TrustAPI] google places enrichment threw (non-fatal):', placesErr)
  }

  const processingMs = Date.now() - start

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
      review_total: report.reviews?.total_reviews,
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
    report_id: savedReportId,
    searches,
    searches_performed: searches.length,
    processing_ms: processingMs,
    cached: false,
    cache_read_tokens: cacheReadTokens,
    cache_creation_tokens: cacheCreationTokens,
    credit: redeemedCreditId
      ? {
          ledger_id:        redeemedCreditId,
          already_redeemed: redeemedAlreadyRedeemed,
          new_balance:      redeemedNewBalance,
        }
      : null,
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
