# Incident Response Plan

**Version:** 1.0.0
**Effective date:** 2026-05-15
**Owner:** Security Officer (founder)
**Approver:** Chief Executive Officer
**Review cadence:** Annual
**Next review due:** 2027-05-15

## 1. Purpose
This policy establishes incident response plan for Earth Pro Connect LLC (earthmove and Groundcheck platforms).

## 2. Scope
Applies to all personnel, contractors, systems, and data processed by Earth Pro Connect LLC.

## 3. Policy
### 3.1 Framework alignment
This policy supports the following frameworks: SOC 2 Trust Services Criteria, ISO/IEC 27001:2022 Annex A, NIST Cybersecurity Framework 2.0, GDPR (where applicable), CCPA (where applicable).

### 3.2 Statements
Specific policy statements are codified in the application controls described in `docs/compliance/SOC2_CONTROL_MAPPING.md` and enforced by:
- Database schemas (`security.*`, `compliance.*`)
- Application middleware and server actions
- Continuous integration security gates

Where applicable, automated enforcement supersedes manual procedures. Where automated enforcement is not available, manual procedures are documented in the relevant operational runbook.

## 4. Roles and responsibilities
- **Security Officer (founder):** owns this policy and its enforcement.
- **All personnel:** acknowledge this policy at onboarding and annually thereafter.
- **Auditors and customers:** may request evidence of policy operation via `security@earthmove.io`.

## 5. Exceptions
Exceptions require written approval from the Security Officer and CEO. All exceptions are time-bound and tracked in `compliance.audit_attestations`.

## 6. Enforcement
Violations may result in remediation, training, contractual review, or termination of access. Material violations are tracked as incidents in `compliance.incidents`.

## 7. Review and revision
This policy is reviewed at least annually and on material changes to the business, technology stack, or regulatory environment.

## Revision history
| Version | Date       | Author          | Change                          |
|---------|------------|-----------------|---------------------------------|
| 1.0.0   | 2026-05-15 | Security Officer | Initial publication            |
