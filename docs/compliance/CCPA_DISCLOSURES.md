# CCPA / CPRA Disclosures

**Last updated:** 2026-05-15
**Effective for:** California consumers under California Consumer Privacy Act of 2018 as amended by CPRA

## Categories of personal information collected (preceding 12 months)

| CCPA category | Examples | Collected? | Sources |
|---|---|---|---|
| Identifiers | name, email, phone, IP | Yes | Direct from consumer + cookies |
| Customer records | account info, financial info | Yes | Direct + Stripe |
| Commercial information | order history | Yes | Platform usage |
| Internet activity | browsing, interactions | Yes | Cookies + server logs |
| Geolocation | precise location (drivers) | Yes (drivers only) | Driver app with consent |
| Audio/electronic | SMS messages | Yes | Twilio (with consent) |
| Inferences | preferences, risk scores | Yes | Derived from above |

## Purposes

Order fulfillment · authentication · fraud prevention · regulatory compliance · service improvement

## Sale / share of personal information

**We do not sell personal information** for monetary consideration. We do not share personal information for cross-context behavioral advertising.

## Rights under CCPA / CPRA

- **Right to know** — `/api/dsar/request` returns categories + specific pieces (Section 1798.110/.115)
- **Right to delete** — `/api/dsar/erasure` (Section 1798.105)
- **Right to correct** — `/dsar` form rectification request (Section 1798.106)
- **Right to portability** — JSONB export via `/api/dsar/request`
- **Right to opt out of sale/sharing** — Not applicable (we do not sell/share)
- **Right to limit sensitive PI use** — `/dsar` form (Section 1798.121)
- **Right to non-discrimination** — We do not discriminate against consumers exercising rights

## How to exercise rights

`/dsar` form or email `privacy@earthmove.io`. Two-factor verification required. Response within 45 days (extendable to 90).
