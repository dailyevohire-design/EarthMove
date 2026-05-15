# ADR 0005 — Postgres-backed rate limiter, not Redis

**Status:** Accepted · **Date:** 2026-05-15

## Context
Industry default for rate limiting is Redis (token bucket / sliding window). Adds an external dependency, another system to secure and monitor, another credential to rotate. At our scale the Postgres we already operate has ample headroom.

## Decision
Implement sliding-window rate limiting via `security.rate_buckets` table + `security.fn_rate_check(key, window_sec, limit)` function called from every rate-sensitive route. Stale buckets purged daily via cron. Upstash Redis remains used only as ephemeral cache for the photo visualizer.

## Consequences
- One fewer system to monitor, secure, pay for, and back up
- Rate-limit state visible via SQL (trivial debugging)
- Throughput more than sufficient at current scale; rate_buckets table small (a few KB)
- Revisit at >10k req/s sustained — at that point Redis or PG with LISTEN/NOTIFY becomes warranted
- Buckets table contributes to Supabase row count (negligible)

## Alternatives considered
- Upstash Redis sliding window — rejected; adds dependency for marginal benefit at our scale
- Vercel Edge Config — rejected; doesn't support write-heavy rate-counter workload
- In-memory per-instance counter — rejected; doesn't share across Vercel function instances
