-- 216_trust_alert_dispatches
--
-- Append-only dispatch queue + audit trail. One row per dispatch attempt
-- (subscription × evidence × channel). idempotency_key UNIQUE prevents
-- duplicate alerts when the Inngest worker retries (key includes
-- evidence_id + subscription_id + channel).
--
-- Status lifecycle:
--   pending → sent              (channel dispatcher succeeded)
--   pending → failed            (channel dispatcher errored — retry per status)
--   pending → suppressed        (channel-side gate refused, e.g. SMS without PEWC)

CREATE TABLE IF NOT EXISTS trust_alert_dispatches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   uuid NOT NULL REFERENCES trust_watch_subscriptions(id) ON DELETE CASCADE,
  evidence_id       uuid REFERENCES trust_evidence(id) ON DELETE SET NULL,
  trigger_type      text NOT NULL CHECK (trigger_type IN ('finding_type','score_drop','manual')),
  payload           jsonb NOT NULL,
  channel           text NOT NULL CHECK (channel IN ('email','sms','in_app')),
  dispatch_status   text NOT NULL CHECK (dispatch_status IN ('pending','sent','failed','suppressed')) DEFAULT 'pending',
  idempotency_key   text NOT NULL UNIQUE,
  sent_at           timestamptz,
  failed_at         timestamptz,
  failure_reason    text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tad_subscription_pending
  ON trust_alert_dispatches(subscription_id) WHERE dispatch_status = 'pending';

-- Service-role only access; users never directly read or write dispatch rows.
-- (No RLS policies — RLS not enabled, equivalent to deny-all-public.)
