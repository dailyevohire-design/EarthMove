-- 217_trust_alert_dispatches_rls
--
-- PR #10 review blocker fix. Migration 216 created trust_alert_dispatches
-- without RLS — the comment claimed "service-role only" but with RLS
-- disabled, authenticated users could SELECT/INSERT/UPDATE/DELETE
-- arbitrary rows: enumerate other users' alert history by subscription_id,
-- INSERT dispatches with status='sent' to suppress legitimate alerts via
-- idempotency_key collision, manipulate dispatch_status.
--
-- Writes only via service_role (Inngest worker onTrustEvidenceAppended)
-- which bypasses RLS by design. Authenticated users have read-only access
-- to dispatches for subscriptions they own.

ALTER TABLE trust_alert_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tad_owner_select ON trust_alert_dispatches;
CREATE POLICY tad_owner_select ON trust_alert_dispatches
  FOR SELECT TO authenticated
  USING (subscription_id IN (
    SELECT id FROM trust_watch_subscriptions
    WHERE user_id = auth.uid()
  ));

-- No INSERT/UPDATE/DELETE policies = denied for authenticated.
-- service_role bypasses RLS naturally for the Inngest worker path.
