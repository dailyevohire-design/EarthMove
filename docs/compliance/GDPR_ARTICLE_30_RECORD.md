# Records of Processing Activities — GDPR Article 30

**Controller / Processor:** Earth Pro Connect LLC (acts as controller for own users; processor for customer-uploaded data)
**EU Representative:** Not currently required (no targeted EU activity); to be appointed before any EU customer onboarding
**DPO:** Not currently required; Security Officer designated as privacy contact
**Last updated:** 2026-05-15

## Processing activity 1: Marketplace transactions

- **Purpose:** Facilitate aggregate material orders between buyers and suppliers
- **Lawful basis:** Article 6(1)(b) — performance of a contract
- **Data subjects:** GCs, drivers, suppliers, customer admins
- **Data categories:** identity, contact, location, financial transaction data
- **Recipients:** Stripe (payments), Twilio (SMS), Inngest (workflows)
- **Retention:** 7 years (financial records) per legal obligation
- **International transfers:** None within scope (data stays in US for US-only operation)
- **TOMs:** Encryption at rest, TLS in transit, RLS, audit logs

## Processing activity 2: Groundcheck trust reports

- **Purpose:** Synthesize publicly-available business records into verification reports
- **Lawful basis:** Article 6(1)(f) — legitimate interests (consumer protection); reports cover business entities, not individuals
- **Data subjects:** Business entities (not GDPR-protected) primarily; minimal individual data via officer records (DPIA exemption — public records republished)
- **Data categories:** business registration, license, BBB, OSHA, court records
- **Recipients:** Anthropic (synthesis), Perplexity (search)
- **Retention:** Indefinite for public records reflection; 90 days for synthesis intermediates
- **International transfers:** N/A
- **TOMs:** Append-only audit on report changes, sentinel-wrapped evidence, anomaly detection

## Processing activity 3: User account & authentication

- **Purpose:** Authenticate users; enable platform access
- **Lawful basis:** Article 6(1)(b) — performance of a contract
- **Data subjects:** All platform users
- **Data categories:** email, hashed credentials, MFA factors, session metadata
- **Recipients:** Supabase (auth provider)
- **Retention:** Active for account lifetime + 1 year after deactivation
- **International transfers:** N/A
- **TOMs:** Magic link + optional MFA, session pinning, failed-auth lockout

## Processing activity 4: SMS dispatch & TCPA evidence

- **Purpose:** Coordinate haul dispatch with drivers; manage delivery exceptions
- **Lawful basis:** Article 6(1)(a) — consent (with PEWC evidence retained)
- **Data subjects:** Drivers, suppliers
- **Data categories:** phone E.164, message content, GPS location
- **Recipients:** Twilio
- **Retention:** 5 years (TCPA consent evidence)
- **International transfers:** N/A
- **TOMs:** Consent ledger with disclosure hash, IP, UA; opt-out flow

## Processing activity 5: Security monitoring

- **Purpose:** Detect and respond to security incidents
- **Lawful basis:** Article 6(1)(f) — legitimate interests (security of the network and information systems)
- **Data subjects:** All users + visitors
- **Data categories:** IP, user agent, timestamps, action records
- **Recipients:** None (internal only)
- **Retention:** 1 year (security logs), 7 years (admin actions for audit retention)
- **International transfers:** N/A
- **TOMs:** Append-only at DB layer, Merkle-chained admin actions, RLS

## Data subject rights fulfillment

- **Right of access (Art 15):** `/api/dsar/request` (30-day SLA)
- **Right of rectification (Art 16):** `/dsar` form
- **Right of erasure (Art 17):** `/api/dsar/erasure` (soft anonymize or hard delete)
- **Right to restriction (Art 18):** `/dsar` form
- **Right to portability (Art 20):** `/api/dsar/request` returns JSONB export
- **Right to object (Art 21):** `/dsar` form
- **Automated decision-making (Art 22):** No solely-automated decisions with legal effect; Groundcheck scores are advisory, not determinative

## Breach notification process

- Confirmed personal data breach → 72-hour notification to supervisory authority (Art 33)
- High-risk breach to data subjects → undue delay (Art 34)
- Tracked in `compliance.incidents` with `customer_notification_required` and `regulator_notification_required` flags
