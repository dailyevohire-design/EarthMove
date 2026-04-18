/**
 * Rate limiters for /api/driver/* endpoints.
 * Mirrors pattern in src/lib/trust/rate-limiter.ts.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// Bootstrap: 10 attempts per 10 min per IP. Brute-force of bootstrap_token_hash is infeasible
// (256-bit space), but rate limit still protects against DDoS and token-enumeration probes.
export const driverSessionRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 m'),
  prefix: 'ratelimit:driver:session',
  analytics: true,
});

// Ping ingest: 120 per minute per session_id. 2 pings/sec ceiling — typical GPS cadence is
// one per 10-30s; burst allowance handles tunnel-exit resume.
export const driverPingRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 m'),
  prefix: 'ratelimit:driver:ping',
  analytics: true,
});
