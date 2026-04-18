# Runbook — User data deletion (14-day grace)

## Normal path

1. User clicks "Delete my account" in the library (UI ships in Agent 10 follow-up) OR emails privacy@earthmove.io.
2. App calls `POST /api/privacy/delete` → writes an `audit_events` row with `event_type='privacy.deletion_requested'` and `scheduled_hard_delete_at = NOW() + 14 days`.
3. Confirmation email sent to the registered address with a cancel link.
4. User may cancel within 14 days via `DELETE /api/privacy/delete` or by replying to the email.
5. At T+14d, a scheduled Inngest job performs hard-delete across user-owned tables:
   - `trust_report_access` — delete
   - `prehire_watches` — delete (cascades to `prehire_alerts`)
   - `disputes` — delete
   - `trust_share_grants` — delete
   - `contractor_responses` — anonymize `created_by_user_id` (preserve row; responses are public content)
   - `verified_contractors` — unlink `claimed_by_user_id`; preserve business record
   - `trust_credits_ledger` — **anonymize** `user_id` to `00000000-0000-0000-0000-000000000000` (7-year accounting retention)
   - `auth.users` — delete via Supabase admin API (cascades to `profiles`)
6. Stripe customer — **archived, not deleted**. Preserves refund + tax history. Subscriptions auto-cancel on user delete via webhook.
7. Final audit row `event_type='privacy.deletion_executed'` written with table-level row counts.

## Override (manual purge for legal compliance)

Only when ordered by counsel or by statute (e.g., GDPR erasure request from the EU):

1. Engineering creates a one-off service-role script under `scripts/ops/purge-user-<user_id>.ts`.
2. Script deletes ALL rows including `trust_credits_ledger` (accounting exception documented in the runbook).
3. Script commits an `audit_events` row with `event_type='privacy.manual_purge'` + reason + ordering party.
4. Script is reviewed by Juan before execution.
5. Script is committed to git for forensic posterity.

## What deletion does NOT cover

- **Backups**: Supabase point-in-time recovery holds 7 days of backups. A backup restore WOULD reintroduce deleted data. Operational expectation: backups are treated as sealed and only restored for incident recovery, not selectively queried.
- **Audit events**: `audit_events` rows about the deletion itself are retained for accountability.
- **Contractor-facing content**: contractor responses remain public (the contractor owns them); only the `created_by_user_id` link is severed.

## Owner
Primary: Engineering. Secondary: Juan + counsel.
