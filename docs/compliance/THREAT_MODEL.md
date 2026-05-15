# Threat Model — Earth Pro Connect LLC

**Method:** STRIDE per-asset · **Last reviewed:** 2026-05-15 · **Next review:** 2026-08-15 (quarterly)

## Approach
For each high-value asset we enumerate threats across Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege. Each item is captured in `compliance.threat_model_items` for tracking; this document is the human-readable companion.

## Crown jewels
1. **Trust reports** (Groundcheck) — AI-generated risk scores on real businesses. Tampering = legal + reputational catastrophe
2. **Driver location data** — privacy + safety implications
3. **Admin credentials** — bypass everything
4. **Payment flow** (Stripe integration) — direct financial loss
5. **TCPA SMS consent ledger** — legal evidence under federal statute
6. **Audit log** — every other control's last line of defense

## Top 10 STRIDE items (mirrored in DB)

| # | Asset | Category | Scenario | Mitigation | Status |
|---|---|---|---|---|---|
| 1 | trust_reports | Tampering | Compromised admin rewrites score for a contractor they want to clear | DB append-only on trust_report_audit; Merkle-chained admin_actions; every score change cited; tampering breaks the chain | Implemented |
| 2 | supplier_offerings | Information disclosure | Competitor scrapes pricing via auth session or API | RLS denies anon; rate limits on listing endpoints; canary listings detect exfiltration; PDF watermarking | Implemented |
| 3 | driver location_pings | Spoofing | Driver uses GPS spoof tool to fake delivery completion | Server-side velocity / accel / accuracy / teleport gates reject suspect pings before persist; anomalies raise intervention | Implemented |
| 4 | admin credentials | Elevation of privilege | Phished admin credential grants full DB access | MFA enforcement (in progress: 0/1 enrolled), admin IP allowlist, session pinning, failed-auth lockout + IP ban | In progress |
| 5 | trust synthesis | Tampering | Adversarial scraped page contains prompt injection that manipulates AI score | sanitizeEvidence strips HTML/scripts; sentinel-wrapped evidence with system instruction; score anomaly gate flags single-evidence high scores | Implemented |
| 6 | sms_consent | Repudiation | Recipient denies consent in TCPA litigation | PEWC evidence ledger with disclosure version hash, IP, UA, timestamp; 5yr retention; never modified after write | Implemented |
| 7 | Stripe webhook | Tampering | Attacker forges Stripe webhook to mark payment received without paying | HMAC-SHA256 signature verification on raw body before any processing; webhook_events idempotency claim | Implemented |
| 8 | admin_actions | Tampering | Compromised DBA deletes evidence of their actions | DB-layer REVOKE UPDATE/DELETE + trigger raise; Merkle hash chain; verification function callable any time | Implemented |
| 9 | Twilio canary | Spoofing | Attacker forges Twilio inbound calls to fake canary hits + create alert fatigue | HMAC-SHA1 signature verification per Twilio spec; rate-limited at edge; writes only after verification | Implemented |
| 10 | Public REST endpoints | Denial of service | Attacker floods `/trust` search and burns AI API tokens at $5/MTok | Sliding-window per-IP rate limit; failed-attempt thresholds; IP ban; Vercel edge rate limiting upstream | Implemented |

## Threats accepted as residual risk
- Sophisticated nation-state attacker with multiple zero-days — out of scope for current threat model
- Insider founder coercion — single-founder operation; mitigated by external audit logs (Vercel, Stripe, Supabase all log independently)
- Quantum cryptanalysis — out of scope until NIST PQC migration timeline becomes operative

## Review cadence
Quarterly review. New components added during the quarter get a per-asset STRIDE pass before going to production.
