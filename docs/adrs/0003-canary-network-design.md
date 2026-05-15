# ADR 0003 — Canary network for exfiltration detection

**Status:** Accepted · **Date:** 2026-05-15

## Context
Aggregate pricing and trust report data are scrape targets. Detection by analyzing production data is unreliable (high false positives, can be evaded). We need a high-precision signal of confirmed exfiltration.

## Decision
Plant 6 canaries across the production database:
- 3 supplier listings (DEN, DFW, PHX) with unique placeholder phone numbers in description, `is_public=false` + `verification_status='canary'` (hidden from customers but visible to anyone with DB access or admin tool access)
- 3 trust subject canaries (synthetic LLC names) seeded as content that should never appear in legitimate scraped output

Any external contact (Twilio inbound call/SMS, SendGrid inbound email, third-party publication of the canary names) is a confirmed exfiltration signal raising a CRITICAL intervention card.

## Consequences
- Near-zero false positives — canaries shouldn't ever be touched legitimately
- Cheap to maintain (6 rows + 3 phone numbers)
- Requires real Twilio number provisioning for full effectiveness (currently 555-01xx placeholders)
- Provides probabilistic source attribution if multiple canaries hit from same channel
