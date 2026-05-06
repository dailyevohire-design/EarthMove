-- 222_webhook_events_idempotency.sql
-- Inbound-webhook idempotency ledger. Stripe retries on any 5xx/timeout;
-- without this, a webhook handler that creates an order then errors before
-- returning 200 will replay end-to-end on retry — double-dispatch risk.
--
-- Pattern in handler:
--   const { error } = await supabase.from('webhook_events')
--     .insert({ event_id: stripeEvent.id, source: 'stripe' });
--   if (error?.code === '23505') return new Response('ok', { status: 200 });
--   // ...do the work...
--
-- Applied to prod via MCP 2026-05-06 prior to commit. Idempotent re-run safe.

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id    text        PRIMARY KEY,
  source      text        NOT NULL CHECK (source IN ('stripe','twilio','inngest','resend')),
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_hash text
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_source_received
  ON webhook_events (source, received_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_service_role_all ON webhook_events;
CREATE POLICY webhook_events_service_role_all ON webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE webhook_events IS
  'Idempotency ledger for inbound webhooks. Insert event_id first; PK collision means duplicate retry — return 200 immediately.';
