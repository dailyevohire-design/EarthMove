# ADR 0002 — Append-only audit tables enforced at DB layer

**Status:** Accepted · **Date:** 2026-05-15

## Context
Audit logs must survive application compromise. "Immutable at the application layer" is not credible to auditors or to a compromised app instance. A compromised admin or stolen service-role key shouldn't be able to rewrite history.

## Decision
For audit tables (`security.admin_actions`, `compliance.consent_records`, `compliance.backup_verifications`, `compliance.training_log`, `trust_report_audit`, `trust_score_history`):
1. `REVOKE UPDATE, DELETE FROM service_role, authenticated, anon, PUBLIC`
2. `BEFORE UPDATE` and `BEFORE DELETE` triggers raising `insufficient_privilege` exception
3. `security.admin_actions` additionally has Merkle hash chain (`prev_hash` + `row_hash`) computed per insert

## Consequences
- A compromised app, stolen service-role key, or rogue DBA cannot rewrite history
- Tamper-evidence available via `security.fn_verify_admin_chain()` from any point in time
- Schema migrations to audit tables require coordinated approach (drop trigger, alter, recreate trigger)
- Rollback of bad audit data requires PITR to a pre-write timestamp, leaving an obvious gap

## Alternatives considered
- Write-once cloud bucket (S3 Object Lock) — rejected; high integration cost for current scale
- Blockchain anchoring — rejected as primary mechanism; planned for future as supplementary signal
