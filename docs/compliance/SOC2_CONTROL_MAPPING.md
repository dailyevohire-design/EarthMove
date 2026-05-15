# SOC 2 Trust Services Criteria — Control Mapping

**Period covered:** 2026-05-15 → present
**Trust Services categories in scope:** Security (mandatory), Confidentiality, Privacy, Availability
**Processing Integrity:** in scope for marketplace order processing
**Last updated:** 2026-05-15

## Summary

This document maps the SOC 2 Trust Services Criteria (TSC) 2017 (revised 2022) to our implemented controls. It is the primary artifact a SOC 2 auditor or enterprise vendor reviewer will consume.

## CC — Common Criteria

| Criterion | Description | Implementation | Evidence |
|---|---|---|---|
| CC1.1 | Commits to integrity and ethical values | Information Security Policy + Acceptable Use Policy signed by founder; annual review | `docs/policies/information-security-policy.md` |
| CC1.5 | Holds individuals accountable | Acceptable Use Policy + admin_actions audit log; Merkle-chained tamper-evidence | `security.admin_actions`, `/admin/compliance/integrity` |
| CC2.1 | Communicates information to support functioning of internal controls | Trust Center publishes policies, controls, subprocessor list; admin dashboards surface drift | `/trust-center`, `/admin/compliance` |
| CC4.2 | Evaluates and communicates internal control deficiencies | Vulnerability Disclosure Policy + audit_attestations table | `docs/compliance/VULNERABILITY_DISCLOSURE_POLICY.md`, `compliance.audit_attestations` |
| CC6.1 | Logical access security software, infrastructure, and architectures | Supabase Auth, RLS on every public table, MFA enforcement helper, IP allowlist for admin routes | RLS policies, `security.fn_is_admin`, `requireAdmin()` |
| CC6.2 | Authorizes new internal and external users | requireAdmin server actions, role assignment via auth.users + profiles.role, quarterly access reviews | `compliance.access_reviews` (4 scheduled), `security.admin_actions` |
| CC6.3 | Authorizes, modifies, or removes access based on authorized changes | Access review function + admin_actions audit trail; offboarding checklist in IR plan | `compliance.access_reviews`, `security.admin_actions` |
| CC6.6 | Implements logical access controls on infrastructure | RLS default-deny on 147 public tables, service_role separation, append-only audit tables | `security.v_rls_status` (nightly scan) |
| CC6.7 | Authorized and encrypted data transmission | TLS 1.2+ with HSTS preload; HMAC-SHA256 (Stripe), HMAC-SHA1 (Twilio) webhook verification | CSP headers, `verifyTwilioRequest` |
| CC6.8 | Prevents/detects/acts on introduction of unauthorized software | CI/CD security gates (Snyk, Semgrep, CodeQL, Dependabot); secret scanning; SBOM | `.github/workflows/security-scan.yml` |
| CC7.1 | Detects security events using monitoring | Honeypot endpoints, injection sanitizer, GPS spoof gate, trust score anomaly, RLS regression alert | `security.honeypot_hits`, `security.ai_injection_attempts`, `/admin/security` |
| CC7.2 | Monitors system components and operations | Inngest workers, Sentry, security command center with Realtime push | `/admin/security`, `/admin/command` |
| CC7.3 | Evaluates security events to determine if a security incident has occurred | Bridge triggers raise intervention cards; severity-classified; commander assigned | `public.intervention_cards`, `compliance.incidents` |
| CC7.4 | Responds to identified security incidents | Incident Response Plan; SEV1-SEV4 playbooks; 72-hour notification SLA | `docs/policies/incident-response-plan.md`, `compliance.incidents` |
| CC7.5 | Recovers from identified security incidents | Business Continuity Plan; PITR backups; quarterly restore drills | `docs/policies/business-continuity-plan.md`, `compliance.restore_drills` |
| CC8.1 | Authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes | Change Management Policy; admin_actions audit; ADRs for architectural changes | `compliance.architecture_decisions` (5 records), `docs/adrs/` |
| CC9.2 | Assesses and manages risks associated with vendors | Vendor Management Policy; subprocessor inventory with risk tier; annual reassessment | `compliance.subprocessors` (15 records), `compliance.vendor_assessments` |

## C — Confidentiality

| Criterion | Implementation | Evidence |
|---|---|---|
| C1.1 | Data Classification Policy; 19 PII columns tagged with classification, retention, lawful basis | `compliance.data_classifications` |
| C1.2 | Retention enforcement via documented retention periods + manual purge processes (automated purge on roadmap) | `docs/policies/data-retention-policy.md` |

## A — Availability

| Criterion | Implementation | Evidence |
|---|---|---|
| A1.1 | Capacity planning via Supabase usage metrics; Vercel autoscaling | Vercel/Supabase dashboards |
| A1.2 | Backups verified daily via heartbeat; quarterly restore drills | `compliance.backup_verifications`, `compliance.restore_drills` |
| A1.3 | DR plan with RTO 4h / RPO 15min | `docs/policies/business-continuity-plan.md` |

## P — Privacy

| Criterion | Implementation | Evidence |
|---|---|---|
| P1.1 | Privacy Policy + Privacy Notice at collection | `docs/policies/privacy-policy.md` |
| P2.1 | Consent obtained for personal data processing; TCPA PEWC for SMS | `public.sms_consent`, `compliance.consent_records` |
| P3.1 | Personal data collected consistent with notice | Data Classification table maps purpose to lawful basis |
| P4.0 | Use, retention, and disposal | Retention periods enforced; DSAR + erasure endpoints live | `compliance.dsar_requests`, `compliance.erasure_requests` |
| P5.0 | Access to personal data | DSAR endpoint `/api/dsar/request`; 30-day SLA | `/dsar` |
| P6.0 | Disclosure to third parties | Subprocessor list published | `/trust-center/subprocessors` |
| P7.0 | Quality | Rectification request available via DSAR | `/dsar` |
| P8.0 | Monitoring and enforcement | Incident log + breach notification SLA | `compliance.incidents` |

## PI — Processing Integrity

| Criterion | Implementation | Evidence |
|---|---|---|
| PI1.1 | Input integrity verified — webhook HMAC, prompt injection sanitizer, GPS spoof gate | `verifyTwilioRequest`, `sanitizeEvidence`, `checkGpsAnomaly` |
| PI1.4 | Output integrity — trust report watermarking, audit chain hashing | `watermarkPdfText`, `security.fn_verify_admin_chain` |
| PI1.5 | Error handling and idempotency | webhook_events idempotency table, Inngest retry semantics | `public.webhook_events` |
