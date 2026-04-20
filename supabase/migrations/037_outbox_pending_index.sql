-- 037_outbox_pending_index.sql
-- Partial index to accelerate outbox worker polling query:
--   SELECT ... FROM outbox_events WHERE evt_status = 'pending' ORDER BY created_at ASC LIMIT 20
-- Partial form keeps the index tiny (only pending rows, which drain quickly).

CREATE INDEX IF NOT EXISTS outbox_events_pending_created_at_idx
  ON public.outbox_events (created_at ASC)
  WHERE evt_status = 'pending';
