import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const cache = new Map()

export const freeRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'rl:trust:free',
  ephemeralCache: cache,
})

export const proRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'rl:trust:pro',
  ephemeralCache: cache,
})

export async function checkDailyCostCap(
  userId: string,
  tier: string
): Promise<{ allowed: boolean; used: number; cap: number }> {
  const caps: Record<string, number> = { free: 2.0, pro: 25.0, enterprise: 200.0 }
  const cap = caps[tier] ?? 2.0
  const key = `cost:${userId}:${new Date().toISOString().slice(0, 10)}`
  const used = parseFloat((await redis.get<string>(key)) ?? '0')
  return { allowed: used < cap, used, cap }
}

export async function recordCost(userId: string, costUsd: number): Promise<void> {
  const key = `cost:${userId}:${new Date().toISOString().slice(0, 10)}`
  await redis.incrbyfloat(key, costUsd)
  await redis.expire(key, 86400 * 2)
}

export function getRateLimiter(tier: string) {
  if (tier === 'pro' || tier === 'enterprise') return proRateLimiter
  return freeRateLimiter
}
