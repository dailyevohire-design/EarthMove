import { createAdminClient } from '@/lib/supabase/server'

// Tier-aware rate limits (per 60s window). Preserves free=5/min, pro=20/min from
// the prior Upstash implementation.
const TIER_RATE_LIMITS: Record<string, { max: number; windowSeconds: number }> = {
  free:       { max: 5,  windowSeconds: 60 },
  pro:        { max: 20, windowSeconds: 60 },
  enterprise: { max: 20, windowSeconds: 60 },
}

// Daily cost caps (USD). Preserves values from the prior Upstash implementation.
const TIER_COST_CAPS: Record<string, number> = {
  free:       2.0,
  pro:        25.0,
  enterprise: 200.0,
}

// Upstash-compatible result shape. /api/trust/route.ts destructures { success }.
interface RateLimitResult {
  success:   boolean
  limit:     number
  remaining: number
  reset:     number  // ms since epoch
}

interface TierLimiter {
  limit(identifier: string): Promise<RateLimitResult>
}

function buildLimiter(tier: string): TierLimiter {
  const cfg = TIER_RATE_LIMITS[tier] ?? TIER_RATE_LIMITS.free
  return {
    async limit(identifier: string): Promise<RateLimitResult> {
      const db = createAdminClient()
      const { data, error } = await db.rpc('check_trust_rate_limit', {
        p_identifier:     identifier,
        p_bucket:         tier,
        p_max_requests:   cfg.max,
        p_window_seconds: cfg.windowSeconds,
      })
      if (error) throw new Error(`check_trust_rate_limit failed: ${error.message}`)
      const row = Array.isArray(data) ? data[0] : data
      return {
        success:   Boolean(row?.allowed),
        limit:     cfg.max,
        remaining: Number(row?.remaining ?? 0),
        reset:     row?.reset_at
          ? new Date(row.reset_at).getTime()
          : Date.now() + cfg.windowSeconds * 1000,
      }
    },
  }
}

const _limiters: Record<string, TierLimiter> = {}

export function getRateLimiter(tier: string): TierLimiter {
  const key = TIER_RATE_LIMITS[tier] ? tier : 'free'
  if (!_limiters[key]) _limiters[key] = buildLimiter(key)
  return _limiters[key]
}

export async function checkDailyCostCap(
  userId: string,
  tier: string
): Promise<{ allowed: boolean; used: number; cap: number }> {
  const cap = TIER_COST_CAPS[tier] ?? TIER_COST_CAPS.free
  const db = createAdminClient()
  const { data, error } = await db.rpc('check_trust_daily_cost_cap', {
    p_user_id: userId,
    p_cap_usd: cap,
  })
  if (error) throw new Error(`check_trust_daily_cost_cap failed: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: Boolean(row?.allowed),
    used:    Number(row?.used_usd ?? 0),
    cap:     Number(row?.cap_usd ?? cap),
  }
}

/**
 * No-op. Cost is recorded by /api/trust/route.ts inserting directly into
 * trust_api_usage. Kept for API compatibility with callsites.
 * check_trust_daily_cost_cap RPC sums trust_api_usage.cost_usd for enforcement.
 */
export async function recordCost(_userId: string, _costUsd: number): Promise<void> {
  return
}

/**
 * Check rate limit for a given identifier using a shared 'gc:trust' bucket.
 * Returns Upstash-compatible shape.
 */
export async function checkTrustRateLimit(identifier: string): Promise<RateLimitResult> {
  const max = 10
  const windowSeconds = 60
  const db = createAdminClient()
  const { data, error } = await db.rpc('check_trust_rate_limit', {
    p_identifier:     identifier,
    p_bucket:         'gc:trust',
    p_max_requests:   max,
    p_window_seconds: windowSeconds,
  })
  if (error) throw new Error(`check_trust_rate_limit failed: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  return {
    success:   Boolean(row?.allowed),
    limit:     max,
    remaining: Number(row?.remaining ?? 0),
    reset:     row?.reset_at
      ? new Date(row.reset_at).getTime()
      : Date.now() + windowSeconds * 1000,
  }
}
