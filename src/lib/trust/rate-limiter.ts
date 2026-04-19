import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Validate env var shape at module load so malformed values fail the build loudly
 * instead of throwing a cryptic URL parser error deep in the Upstash client.
 * Does NOT require the vars to be set — missing is a runtime problem, caught in getRedis().
 */
function validateEnvShape() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url !== undefined) {
    if (url.startsWith('"') || url.endsWith('"') || url.startsWith("'") || url.endsWith("'")) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL contains literal quote characters — strip quotes in the Vercel dashboard.'
      )
    }
    if (url && !url.startsWith('https://')) {
      throw new Error(
        `UPSTASH_REDIS_REST_URL must start with https:// — got: ${url.slice(0, 30)}...`
      )
    }
  }

  if (token !== undefined) {
    if (token.startsWith('"') || token.endsWith('"') || token.startsWith("'") || token.endsWith("'")) {
      throw new Error(
        'UPSTASH_REDIS_REST_TOKEN contains literal quote characters — strip quotes in the Vercel dashboard.'
      )
    }
  }
}

validateEnvShape()

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error(
      `Upstash env missing at runtime. URL present=${!!url} TOKEN present=${!!token}. ` +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel → Settings → Environment Variables → Production.'
    )
  }
  _redis = new Redis({ url, token })
  return _redis
}

const cache = new Map()

let _freeRateLimiter: Ratelimit | null = null
let _proRateLimiter: Ratelimit | null = null

export function getRateLimiter(tier: string): Ratelimit {
  if (tier === 'pro' || tier === 'enterprise') {
    if (!_proRateLimiter) {
      _proRateLimiter = new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        prefix: 'rl:trust:pro',
        ephemeralCache: cache,
      })
    }
    return _proRateLimiter
  }
  if (!_freeRateLimiter) {
    _freeRateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'rl:trust:free',
      ephemeralCache: cache,
    })
  }
  return _freeRateLimiter
}

export async function checkDailyCostCap(
  userId: string,
  tier: string
): Promise<{ allowed: boolean; used: number; cap: number }> {
  const caps: Record<string, number> = { free: 2.0, pro: 25.0, enterprise: 200.0 }
  const cap = caps[tier] ?? 2.0
  const key = `cost:${userId}:${new Date().toISOString().slice(0, 10)}`
  const used = parseFloat((await getRedis().get<string>(key)) ?? '0')
  return { allowed: used < cap, used, cap }
}

export async function recordCost(userId: string, costUsd: number): Promise<void> {
  const redis = getRedis()
  const key = `cost:${userId}:${new Date().toISOString().slice(0, 10)}`
  await redis.incrbyfloat(key, costUsd)
  await redis.expire(key, 86400 * 2)
}

let _trustLimiter: Ratelimit | null = null
/**
 * Check rate limit for a given identifier (IP, user ID, contractor query, etc.).
 * Returns { success, limit, remaining, reset } from Upstash.
 */
export async function checkTrustRateLimit(identifier: string) {
  if (!_trustLimiter) {
    _trustLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      analytics: true,
      prefix: 'gc:trust',
    })
  }
  return _trustLimiter.limit(identifier)
}
