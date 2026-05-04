/**
 * Token-bucket rate limiter for external-API client-side throttling.
 *
 * Designed for scrapers that hit shared-quota public APIs (SAM.gov, etc.).
 * Each instance is keyed to a specific source — do not share buckets across sources.
 */

interface RateLimiterOpts {
  name: string
  maxPerMinute: number
}

export class RateLimiter {
  private readonly intervalMs: number
  private nextAvailableMs: number = 0

  constructor(opts: RateLimiterOpts) {
    if (opts.maxPerMinute <= 0) throw new Error('maxPerMinute must be > 0')
    this.intervalMs = Math.ceil(60_000 / opts.maxPerMinute)
  }

  async acquire(): Promise<void> {
    const now = Date.now()
    if (this.nextAvailableMs <= now) {
      this.nextAvailableMs = now + this.intervalMs
      return
    }
    const waitMs = this.nextAvailableMs - now
    this.nextAvailableMs += this.intervalMs
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }

  /** Test-only: reset throttle state to fresh. */
  reset(): void {
    this.nextAvailableMs = 0
  }
}

/**
 * Tiny LRU+TTL cache for per-name idempotency on idempotent external calls.
 */
export class TtlCache<V> {
  private readonly maxEntries: number
  private readonly ttlMs: number
  private readonly map = new Map<string, { value: V; expiresAtMs: number }>()

  constructor(maxEntries: number, ttlMs: number) {
    this.maxEntries = maxEntries
    this.ttlMs = ttlMs
  }

  get(key: string): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (entry.expiresAtMs <= Date.now()) {
      this.map.delete(key)
      return undefined
    }
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value
      if (oldestKey !== undefined) this.map.delete(oldestKey)
    }
    this.map.set(key, { value, expiresAtMs: Date.now() + this.ttlMs })
  }

  /** Test-only: drop all entries. */
  clear(): void {
    this.map.clear()
  }
}
