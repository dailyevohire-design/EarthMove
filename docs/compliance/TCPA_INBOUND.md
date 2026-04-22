# TCPA Inbound SMS Webhook — Compliance Runbook

**Status:** INBOUND WEBHOOK CLEARED (not configured)
**Owner:** Juan (Founder)
**Last verified:** _YYYY-MM-DD by Juan_
**Twilio number:** +19722993160
**A2P 10DLC status:** Active (campaign ID: _to be filled_)

---

## Why this webhook is intentionally blank

Earthmove.io has not yet shipped the inbound SMS state machine. The feature lives on `backup/pre-rebase-20260421` (commit `eae4973`) and depends on Inngest + Upstash infrastructure that was deferred during the T2 dispatch push.

Configuring the Twilio inbound webhook URL before the state machine ships creates two risks:

1. **TCPA exposure.** Inbound `STOP` / `UNSUBSCRIBE` / `HELP` messages would hit a 404 or an unhandled route. Consent revocations would not be recorded in `sms_consent`, and continued outbound messaging after an unrecorded STOP is a per-message TCPA violation.
2. **Data leak surface.** An inbound webhook without auth or rate limiting is a reachable endpoint that logs message bodies.

The webhook field remains empty until every item in the re-enablement checklist below is green.

## Current Twilio Console state

_Screenshot placeholder — replace with actual screenshot before committing final version:_

- Messaging Service → Integration → Incoming Messages: **Webhook URL empty**
- Messaging Service → Integration → Fallback URL: **Empty**
- Phone Number `+19722993160` → Messaging Configuration: **Inherits from Messaging Service (empty)**

_(Attach screenshots as `docs/compliance/img/tcpa-inbound-YYYY-MM-DD-*.png` and link here.)_

## A2P 10DLC registration state

- Brand: Registered (TCR)
- Campaign: Active
- Campaign ID: _to be filled_
- Use case: _to be filled (Mixed / Customer Care / Account Notification)_
- Sample messages registered: _yes / no — confirm_

## Re-enablement checklist

Before flipping the inbound webhook URL to a production route, **every** item below must be true and documented:

1. `src/app/api/webhooks/twilio/inbound/route.ts` exists on `main`, deployed to production Vercel
2. Route verifies Twilio signature via `validateRequest()` with `TWILIO_AUTH_TOKEN` from Supabase Vault
3. `STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT` keywords route to a handler that inserts a revocation row in `sms_consent` with `revoked_at = now()` and the exact inbound message body in `revocation_evidence`
4. `HELP`, `INFO` keywords return the registered help response matching the A2P 10DLC sample message
5. Outbound send path (`send_sms()` tool) checks `sms_consent_current` view for an active consent row before every send, fails closed
6. Written PEWC flow documented and tested: disclosure text hash recorded per consent row, disclosure version tracked in `sms_consent.disclosure_hash`
7. End-to-end test: fake driver signs consent → receives SMS → replies STOP → consent revoked → subsequent send blocked → reply START → consent re-established
8. Inngest idempotency key set on inbound handler using `MessageSid` to prevent duplicate revocation records
9. Rate limit configured on the inbound route (per-phone-number 20/min, per-IP 60/min)
10. Sentry alert configured on any 4xx/5xx from the inbound webhook

## Authorization to flip

The inbound webhook URL may only be set by:

- Juan (Founder)
- Or: a Claude session with explicit written authorization from Juan referencing this runbook by commit hash

A Claude session without that authorization **must refuse** to add the webhook URL to Twilio, even if every checklist item appears green. The compliance attestation requires a human decision point.

## Revocation of authorization

If any checklist item regresses (e.g. route removed, signature validation broken, consent table schema changes), the webhook must be cleared in Twilio Console within 1 hour of detection. Audit log entry required.

## Evidence retention

- Twilio Console screenshots: retained in `docs/compliance/img/` indefinitely
- Consent revocation records in `sms_consent`: retained minimum 4 years per TCPA statute of limitations
- Outbound send logs tying each SMS to a consent row: retained minimum 4 years

---

**Founder sign-off:**

_I confirm the Twilio inbound webhook for +19722993160 is cleared as of the verification date above, and I understand the re-enablement checklist._

Signed: _____________________________ Date: _____________
