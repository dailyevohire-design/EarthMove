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

// Fail-closed result — blocks the caller for 60s when the RPC is unreachable.
// Used whenever admin.rpc() returns { error } OR throws.
function denyOnError(limitMax: number): RateLimitResult {
  return {
    success:   false,
    limit:     limitMax,
    remaining: 0,
    reset:     Date.now() + 60_000,
  }
}

function buildLimiter(tier: string): TierLimiter {
  const cfg = TIER_RATE_LIMITS[tier] ?? TIER_RATE_LIMITS.free
  return {
    async limit(identifier: string): Promise<RateLimitResult> {
      try {
        const db = createAdminClient()
        const { data, error } = await db.rpc('check_trust_rate_limit', {
          p_identifier:     identifier,
          p_bucket:         tier,
          p_max_requests:   cfg.max,
          p_window_seconds: cfg.windowSeconds,
        })
        if (error || data == null) {
          console.error('[trust-rate-limiter] rpc error — failing closed', {
            fn: 'check_trust_rate_limit', bucket: tier, identifier,
            err: error?.message ?? 'null_data',
          })
          return denyOnError(cfg.max)
        }
        const row = Array.isArray(data) ? data[0] : data
        if (row == null) return denyOnError(cfg.max)
        return {
          success:   Boolean(row.allowed),
          limit:     cfg.max,
          remaining: Number(row.remaining ?? 0),
          reset:     row.reset_at
            ? new Date(row.reset_at).getTime()
            : Date.now() + cfg.windowSeconds * 1000,
        }
      } catch (err) {
        console.error('[trust-rate-limiter] threw — failing closed', {
          fn: 'check_trust_rate_limit', bucket: tier, identifier,
          err: err instanceof Error ? err.message : String(err),
        })
        return denyOnError(cfg.max)
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
  try {
    const db = createAdminClient()
    const { data, error } = await db.rpc('check_trust_daily_cost_cap', {
      p_user_id: userId,
      p_cap_usd: cap,
    })
    if (error || data == null) {
      console.error('[trust-rate-limiter] cost-cap rpc error — failing closed', {
        fn: 'check_trust_daily_cost_cap', userId, tier,
        err: error?.message ?? 'null_data',
      })
      return { allowed: false, used: cap, cap }
    }
    const row = Array.isArray(data) ? data[0] : data
    if (row == null) return { allowed: false, used: cap, cap }
    return {
      allowed: Boolean(row.allowed),
      used:    Number(row.used_usd ?? 0),
      cap:     Number(row.cap_usd ?? cap),
    }
  } catch (err) {
    console.error('[trust-rate-limiter] cost-cap threw — failing closed', {
      fn: 'check_trust_daily_cost_cap', userId, tier,
      err: err instanceof Error ? err.message : String(err),
    })
    return { allowed: false, used: cap, cap }
  }
}

/**
 * Shared 'gc:trust' bucket rate check. Fails closed on any error.
 */
export async function checkTrustRateLimit(identifier: string): Promise<RateLimitResult> {
  const max = 10
  const windowSeconds = 60
  try {
    const db = createAdminClient()
    const { data, error } = await db.rpc('check_trust_rate_limit', {
      p_identifier:     identifier,
      p_bucket:         'gc:trust',
      p_max_requests:   max,
      p_window_seconds: windowSeconds,
    })
    if (error || data == null) {
      console.error('[trust-rate-limiter] shared rpc error — failing closed', {
        fn: 'check_trust_rate_limit', bucket: 'gc:trust', identifier,
        err: error?.message ?? 'null_data',
      })
      return denyOnError(max)
    }
    const row = Array.isArray(data) ? data[0] : data
    if (row == null) return denyOnError(max)
    return {
      success:   Boolean(row.allowed),
      limit:     max,
      remaining: Number(row.remaining ?? 0),
      reset:     row.reset_at
        ? new Date(row.reset_at).getTime()
        : Date.now() + windowSeconds * 1000,
    }
  } catch (err) {
    console.error('[trust-rate-limiter] shared threw — failing closed', {
      fn: 'check_trust_rate_limit', bucket: 'gc:trust', identifier,
      err: err instanceof Error ? err.message : String(err),
    })
    return denyOnError(max)
  }
}
