# Runbook — Data breach response

## Definition

A breach is any unauthorized access, acquisition, or disclosure of user data or contractor data. Examples:
- Stolen Supabase service role key.
- Stolen Stripe secret key.
- SQL injection vulnerability actively exploited.
- RLS bypass actively exploited.
- Supply-chain compromise (malicious package update).
- Lost / stolen engineering laptop with .env secrets.

## Phase 1 — Identify (first 1 hour)

1. Preserve evidence. **Do not delete anything.** Freeze affected records (set `*_locked_at` if needed). Screenshots of the reporting surface.
2. Convene response team: Juan + on-call engineer + legal contact.
3. Assess scope:
   - What data classes are implicated? (user emails, payment metadata, contractor records, auth tokens)
   - How many users?
   - When did the exposure start? How long has it been open?
   - Is the exploit still active?

## Phase 2 — Contain (next 2 hours)

1. **Rotate all secrets** that may be exposed:
   - Supabase service role key (dashboard → Settings → API → Generate new key, then update Vercel env).
   - Stripe secret + webhook secret (dashboard → Developers → API Keys → Roll).
   - Anthropic API key.
   - Twilio auth token.
   - `GROUNDCHECK_SHARE_JWT_SECRET` (this invalidates all active share links — that's fine).
   - Inngest event + signing keys.
2. **Invalidate all active sessions** — Supabase auth admin → Sign out all users.
3. If an attacker has a live session or API key, deploy a patch that blocks the attack vector (e.g., a new RLS policy) BEFORE key rotation — otherwise they get a warning to exfiltrate faster.

## Phase 3 — Notify (within 72 hours per most breach-notification statutes)

1. **Users**: email every affected user using the template in `docs/runbook/templates/breach-notification-email.md` (TODO — Agent 10 polish). Must include:
   - Nature of the breach.
   - Data classes implicated (be specific).
   - Steps users should take (change password, monitor statements).
   - What we're doing.
   - Contact for questions.
2. **Regulators**:
   - CA AG if any CA resident affected.
   - NY AG if any NY resident affected (GBL § 899-aa).
   - Equivalent state AGs per statute.
   - Federal: if payment card data is implicated → notify Stripe immediately (they handle card-brand notifications).
3. **Sub-processors** — notify Supabase, Anthropic, Stripe if their surfaces are implicated.
4. **Press / public** — Juan coordinates. Status page post. Blog post within 72h of notification deadline.

## Phase 4 — Remediate (1-2 weeks)

1. Patch the vulnerability. Deploy + verify.
2. Root cause analysis — one written postmortem in `docs/postmortem/YYYY-MM-DD-breach.md`.
3. Offer credit monitoring to affected users (Juan approves).
4. Review similar code paths for the same class of bug.
5. Update this runbook with lessons learned.

## Phase 5 — Review (monthly going forward)

Breach scenarios reviewed quarterly by Juan + engineering. Runbook and tests updated when architecture changes.

## Contact

- Juan — <Juan's email/phone, fill at onboarding>
- Legal counsel — <Counsel's contact, fill at onboarding>
- Supabase support — https://supabase.com/support (priority tier if enterprise)
- Stripe fraud / breach — https://stripe.com/contact

## Owner
Primary: Juan. Secondary: Engineering on-call + counsel.
