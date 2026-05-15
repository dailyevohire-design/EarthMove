# ISO/IEC 27001:2022 Annex A — Control Mapping

**Standard version:** ISO/IEC 27001:2022 (Annex A 93 controls, 4 themes)
**Last updated:** 2026-05-15

## A.5 — Organizational controls (37 controls)

| Control | Title | Status | Implementation |
|---|---|---|---|
| A.5.1 | Policies for information security | ✓ | `docs/policies/information-security-policy.md` |
| A.5.7 | Threat intelligence | ✓ | Honeypot network, canary listings, RLS regression scanner |
| A.5.10 | Acceptable use of information and other associated assets | ✓ | `docs/policies/acceptable-use-policy.md` |
| A.5.12 | Classification of information | ✓ | `compliance.data_classifications` |
| A.5.13 | Labelling of information | ✓ | Classification + lawful basis stored per column |
| A.5.15 | Access control | ✓ | `docs/policies/access-control-policy.md` + RLS |
| A.5.16 | Identity management | ✓ | Supabase Auth + profiles.role |
| A.5.17 | Authentication information | In progress | MFA available; admin enrollment required (currently 0/1) |
| A.5.19 | Information security in supplier relationships | ✓ | `docs/policies/vendor-management-policy.md` + subprocessor inventory |
| A.5.20 | Addressing information security within supplier agreements | ✓ | DPA template + executed agreements |
| A.5.24 | Information security incident management planning and preparation | ✓ | `docs/policies/incident-response-plan.md` |
| A.5.25 | Assessment and decision on information security events | ✓ | Severity classification SEV1-SEV4 + intervention_cards |
| A.5.26 | Response to information security incidents | ✓ | Runbook per severity; commander assignment |
| A.5.29 | Information security during disruption | ✓ | `docs/policies/business-continuity-plan.md` |
| A.5.34 | Privacy and protection of PII | ✓ | Privacy Policy + DSAR endpoints + retention enforcement |

## A.6 — People controls (8 controls)

| Control | Title | Status | Implementation |
|---|---|---|---|
| A.6.1 | Screening | ✓ (policy) | Documented for future hires |
| A.6.3 | Information security awareness, education and training | ✓ | `compliance.training_log` + annual refresher cadence |
| A.6.4 | Disciplinary process | ✓ | Documented in Acceptable Use Policy |

## A.7 — Physical controls (14 controls)

Largely inherited from Supabase (AWS us-east-1) and Vercel. SOC 2 Type II reports available for each. Earth Pro Connect operates no on-premises infrastructure handling customer data.

## A.8 — Technological controls (34 controls)

| Control | Title | Status | Implementation |
|---|---|---|---|
| A.8.1 | User end point devices | ✓ (policy) | Endpoint management for future hires |
| A.8.2 | Privileged access rights | ✓ | RLS + requireAdmin + admin_actions audit |
| A.8.3 | Information access restriction | ✓ | RLS default-deny on every public table |
| A.8.4 | Access to source code | ✓ | GitHub private repos + branch protection |
| A.8.5 | Secure authentication | ✓ | Magic link + TOTP MFA |
| A.8.6 | Capacity management | ✓ | Vercel autoscaling + Supabase usage monitoring |
| A.8.7 | Protection against malware | ✓ | Inherited from cloud hosts + CSP + dependency scanning |
| A.8.8 | Management of technical vulnerabilities | ✓ | Dependabot + Snyk + Semgrep + CodeQL |
| A.8.9 | Configuration management | ✓ | Infrastructure-as-code via Vercel + Supabase MCP migrations |
| A.8.10 | Information deletion | ✓ | `/api/dsar/erasure` + `compliance.erase_user_data()` |
| A.8.11 | Data masking | Partial | Soft-anonymize on erasure; field-level encryption helper for sensitive cols |
| A.8.12 | Data leakage prevention | ✓ | Canary network + watermarked PDFs + scrape detection |
| A.8.13 | Information backup | ✓ | Daily Supabase PITR + heartbeat verification |
| A.8.14 | Redundancy of information processing facilities | ✓ | Vercel global edge + Supabase managed redundancy |
| A.8.15 | Logging | ✓ | Append-only audit tables + Merkle chain |
| A.8.16 | Monitoring activities | ✓ | Realtime push to operator queue + security command center |
| A.8.20 | Networks security | ✓ | TLS + WAF (Vercel) + CSP + DDoS protection |
| A.8.21 | Security of network services | ✓ | Supabase managed network + Vercel managed |
| A.8.22 | Segregation of networks | ✓ | Service role separation + RLS per role |
| A.8.23 | Web filtering | N/A | No outbound user-controlled fetches in production paths |
| A.8.24 | Use of cryptography | ✓ | `docs/policies/encryption-key-management.md` |
| A.8.25 | Secure development life cycle | ✓ | ADRs + CI/CD gates + code review |
| A.8.26 | Application security requirements | ✓ | OWASP Top 10 mapping + threat model |
| A.8.27 | Secure system architecture and engineering principles | ✓ | ADRs document key decisions; defense in depth |
| A.8.28 | Secure coding | ✓ | Semgrep + CodeQL + branch protection + code review |
| A.8.29 | Security testing in development and acceptance | ✓ | tsc + eslint + automated checks pre-merge |
| A.8.30 | Outsourced development | N/A | All development in-house |
| A.8.31 | Separation of development, test, and production environments | ✓ | Separate Vercel + Supabase projects |
| A.8.32 | Change management | ✓ | `docs/policies/change-management-policy.md` + admin_actions audit |
| A.8.33 | Test information | ✓ | Synthetic test data only; no production data in dev |
