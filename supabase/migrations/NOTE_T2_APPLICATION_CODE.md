# T2 Application Code — Driver PWA Entry Points

Files shipped by this commit:
- src/lib/driver/tokens.ts
- src/lib/driver/rate-limiter.ts
- src/lib/driver/anti-spoof.ts
- src/lib/compliance/pewc-text.ts
- src/app/api/driver/session/route.ts
- src/app/api/driver/ping/route.ts

Env needed (add to .env.local and Vercel):
- No new env — reuses SUPABASE_SERVICE_ROLE_KEY + existing Upstash keys

Auth model:
- Opaque 32-byte bearer tokens, base64url, sha256 at rest.
- /driver/session sets HttpOnly SameSite=Strict cookie `em_driver_session`.
- /driver/ping reads cookie, no Authorization header.

Anti-spoof:
- Cheap gates run sync on ping insert: velocity (>85mph), teleport (>5km in <30s), clock_skew (>60s).
- anomaly_flags always populated: empty array `{}` when clean, otherwise the flags.
- Expensive gates (straight-line, ASN mismatch) deferred to Inngest worker (separate job).
