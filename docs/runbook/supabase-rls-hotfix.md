# Runbook — Supabase RLS policy hotfix

## When to use

- Auditor finds an RLS gap (user B can read user A data).
- Policy change for a new feature needs to ship without breaking existing queries.
- Counsel requires tighter read restriction on a table.

**Iron rule**: never `DROP POLICY` in production without a rollback path in the same migration.

## Shadow-policy pattern

1. **Create the new policy under a distinct name** alongside the existing one:
   ```sql
   CREATE POLICY "trust_reports_own_v2" ON trust_reports
     FOR SELECT USING (...new predicate...);
   ```
2. **Do NOT drop the old policy yet.** Supabase's policies are additive for SELECT — a row is visible if ANY policy allows. The new policy can only ADD access; if it subtracts, users who relied on the old predicate lose access at cutover.
3. **Run shadow queries** against production from a service-role admin session to confirm every "expected accessible" row is visible under the new policy.
4. **Deploy the app** — code paths that depend on the old predicate still work because both policies apply.
5. **Drop the old policy** in a follow-up migration:
   ```sql
   DROP POLICY "trust_reports_own" ON trust_reports;
   ```
6. **Rename the new policy** to the canonical name for cleanliness (optional).

## Rollback

Every policy change ships with a reverse SQL. `DROP POLICY IF EXISTS "…_v2"` and re-creating the original policy predicate returns to the pre-change state. Keep the reverse in `supabase/migrations/NNN_reverse.sql` — never execute in routine deploys; emergency rollback only.

## Validation after deploy

For each table whose policy changed:

```sql
-- Count rows visible to a specific user under the new policy.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '<user uuid>';
SELECT COUNT(*) FROM <table>;
```

Document the counts in the migration PR description so future auditors can verify scope.

## Owner
Primary: Engineering. Secondary: Juan.
