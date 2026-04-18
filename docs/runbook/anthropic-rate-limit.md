# Runbook — Anthropic rate limit / API outage

## Detection

- **Primary**: sustained 429 / 529 from the Anthropic SDK, surfacing in server logs as `[TrustAPI] …` errors OR Inngest function failures tagged with the relevant function ids.
- **Secondary**: Anthropic status page — https://status.anthropic.com.
- **User-visible**: Standard + Plus report generation times out; the teaser page says "No Groundcheck report yet — try again shortly."

## Kill switches (in escalation order)

1. **Pause the pre-warm cron** — background work first. Inngest dashboard → `prewarm-daily` → Pause.
2. **Pause per-watch sweep** — Inngest → `prehire-watch-sweep` → Pause. Users lose daily alerts temporarily; emails to affected users with ETA.
3. **Reduce Plus tier to Standard search budget** — edit `TIER_CONFIG.plus.maxSearches` to 10 temporarily. Customer communication via status page; refund any Plus purchase in the outage window.
4. **Stop serving new reports** — gate `runTrustEngine` behind a feature flag; return a 503 with a "service degraded" body. Report pages fall back to cached-or-nothing.

## Mitigations

- Per-tier cache TTLs (migration 022) reduce regen pressure: Standard 30d, Plus 14d, Deep Dive 14d, Forensic 7d. During outage, the public teaser serves cached reports when available.
- Budget-mode on sweeps (Agent 6) halves search count on re-runs.
- Pre-warm fan-out is rate-limited at Inngest (concurrency 5, throttle 30/1m) so we don't compound the outage by self-DoSing.

## Recovery

1. Unpause functions in reverse order: sweep → pre-warm.
2. Check `audit_events WHERE event_type='prewarm.cache_hit'` before and after — should trend DOWN as stale reports get refreshed.
3. Monitor Anthropic dashboard spend — if the outage drove a burst, Inngest's throttle should have held.

## Customer communication

- Status page post before any user-visible degradation if we anticipate >15 min.
- Email affected Pre-Hire Watch subscribers if sweep paused > 2 days.
- Credits ledger is untouched — users keep what they paid for. Expired report_access windows during the outage get extended by ops via a service-role SQL update + `audit_events` entry.

## Owner
Primary: Engineering on-call. Secondary: Juan.
