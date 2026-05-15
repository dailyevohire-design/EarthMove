# CSA CAIQ Lite — Filled Responses

**Cloud Controls Matrix version:** v4.0
**Subject organization:** Earth Pro Connect LLC (earthmove + Groundcheck)
**Date filled:** 2026-05-15
**Confidence:** filled by Security Officer based on production state verified via Supabase MCP

Format: Question ID · Question · Y/N/N/A · Evidence

## AIS — Application & Interface Security

- **AIS-01.1** Are application security policies documented? **Y** · `docs/policies/information-security-policy.md` + Access Control Policy
- **AIS-02.1** Are software development lifecycle (SDLC) security requirements documented? **Y** · ADRs, threat model, CI/CD security gates
- **AIS-03.1** Is integrity checked on data inputs (parameter tampering, etc.)? **Y** · sanitizeUserInput, sanitizeEvidence, Zod schemas on API routes
- **AIS-04.1** Is input validation performed on data inputs? **Y** · INJECTION_USER + INJECTION_EVIDENCE pattern arrays

## AAC — Audit Assurance & Compliance

- **AAC-01.1** Audit plans/frequencies documented? **Y** · SOC 2 Type I scheduled Q4 2026; annual pen test Q3 2026; tracked in `compliance.audit_attestations`
- **AAC-02.1** Independent audits performed? **N (planned)** · SOC 2 Type I observation period begins Q4 2026
- **AAC-03.1** Reviews of compliance with policies? **Y** · `compliance.fn_compliance_drift_check()` runs daily

## BCR — Business Continuity & Operational Resilience

- **BCR-01.1** BCP exists? **Y** · `docs/policies/business-continuity-plan.md`
- **BCR-04.1** BCP tested? **Scheduled** · Quarterly restore drills (4 scheduled through 2027-Q1)
- **BCR-08.1** Backups tested for restorability? **Y** · `compliance.restore_drills` + daily backup heartbeat
- **BCR-10.1** Equipment redundancy? **Y** · Vercel multi-region edge; Supabase managed redundancy

## CEK — Cryptography, Encryption & Key Management

- **CEK-02.1** Encryption applied to data at rest? **Y** · AES-256-GCM (AWS KMS via Supabase)
- **CEK-03.1** Encryption applied to data in transit? **Y** · TLS 1.2+ with HSTS preload
- **CEK-09.1** Key inventory maintained? **Y** · `compliance.encryption_keys` (6 keys tracked)
- **CEK-10.1** Key rotation policy? **Y** · `docs/policies/encryption-key-management.md`; rotation dates tracked

## DSI — Data Security & Information Lifecycle Management

- **DSI-01.1** Data classification scheme? **Y** · `compliance.data_classifications` (19 columns tagged)
- **DSI-02.1** Data inventory? **Y** · 40 tables with PII surveyed; classification per column
- **DSI-04.1** Data retention/disposal policy? **Y** · `docs/policies/data-retention-policy.md` + retention_days per column
- **DSI-05.1** Data processing inventory? **Y** · `docs/compliance/GDPR_ARTICLE_30_RECORD.md`
- **DSI-06.1** Customer can request deletion? **Y** · `/dsar` + `/api/dsar/erasure`

## DCS — Datacenter Security

- **DCS-01.1** Physical perimeter security? **N/A (inherited)** · AWS via Supabase + Vercel; SOC 2 reports available from each
- **DCS-09.1** Asset management? **Y** · `compliance.data_classifications` + `compliance.subprocessors`

## GRC — Governance, Risk & Compliance

- **GRC-01.1** Information security management program? **Y** · Documented policies (13), framework alignment per policy
- **GRC-02.1** Information security policies reviewed annually? **Y** · `compliance.policies.next_review_due` enforced via drift check
- **GRC-05.1** Risk assessment performed? **Y** · `docs/compliance/THREAT_MODEL.md` + `compliance.threat_model_items` (10 STRIDE items)

## HRS — Human Resources Security

- **HRS-01.1** Background checks? **Y (policy)** · Required for all personnel pre-hire (currently solo founder; documented for future hires)
- **HRS-04.1** Security awareness training? **Y** · `compliance.training_log` tracks completion; annual refresher required
- **HRS-08.1** Acceptable use defined? **Y** · `docs/policies/acceptable-use-policy.md`

## IAM — Identity & Access Management

- **IAM-01.1** Identity and access management policy? **Y** · `docs/policies/access-control-policy.md`
- **IAM-02.1** User access provisioning process? **Y** · Supabase Auth + profiles.role assignment + admin_actions audit
- **IAM-09.1** Multi-factor authentication for privileged access? **In progress** · TOTP MFA available; enrollment for admin role required; currently 0/1 admins enrolled
- **IAM-12.1** Periodic access review? **Y** · `compliance.access_reviews` (quarterly scheduled through 2027-Q1)

## IPY — Interoperability & Portability

- **IPY-04.1** Data portability? **Y** · `/api/dsar/request` returns JSONB export per GDPR Art 20

## IVS — Infrastructure & Virtualization Security

- **IVS-01.1** Anti-malware on production? **Y (inherited)** · Vercel + Supabase host security; no customer code on shared hosts
- **IVS-06.1** Network segmentation? **Y** · No VPC peering customer→ours; Supabase project isolation
- **IVS-08.1** Production/non-production separation? **Y** · Separate Vercel projects + Supabase projects

## STA — Supply Chain Management, Transparency & Accountability

- **STA-01.1** Subprocessor list maintained? **Y** · `/trust-center/subprocessors` + `compliance.subprocessors` (15 vendors)
- **STA-02.1** Subprocessor risk assessment? **Y** · `compliance.vendor_assessments` + annual cadence enforced
- **STA-05.1** Subprocessor DPA? **Y for 14 of 15** · 1 pending (Upstash) — tracked

## TVM — Threat & Vulnerability Management

- **TVM-01.1** Vulnerability scanning? **Y** · Dependabot + Snyk + Semgrep + CodeQL weekly
- **TVM-02.1** Patch management? **Y** · Dependabot auto-PR with grouping; CI gates block on critical CVE
- **TVM-03.1** Vulnerability disclosure program? **Y** · `docs/compliance/VULNERABILITY_DISCLOSURE_POLICY.md` + `/.well-known/security.txt`
- **TVM-09.1** Penetration testing? **Scheduled** · Annual third-party · Q3 2026 first engagement

## UEM — Universal Endpoint Management

- **UEM-01.1** Endpoint management policy? **Y (operational)** · Founder-only currently; FileVault + automatic OS updates + password manager required; documented for future hires

## LOG — Logging and Monitoring

- **LOG-01.1** Logging policy? **Y** · 7-year financial retention, 1-year security retention per data classification
- **LOG-02.1** Audit logs reviewed? **Y** · Realtime alerts to operator; SIEM export endpoint for customer-side review
- **LOG-04.1** Audit log integrity? **Y** · `security.admin_actions` Merkle-chained; tamper-evident
