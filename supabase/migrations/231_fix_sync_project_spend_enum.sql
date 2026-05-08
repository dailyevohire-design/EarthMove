-- Fix sync_project_spend trigger function: replaced 'completed' with 'delivered'.
--
-- Bug: the function compared NEW.status / OLD.status to literal 'completed',
-- which is not a valid order_status enum value (enum members are
-- pending_payment, payment_failed, confirmed, dispatched, delivered, cancelled,
-- refunded). Postgres validates enum literal casts at plan time, so the
-- function failed to plan and every INSERT into orders that reached this
-- AFTER trigger raised:
--   ERROR 22P02: invalid input value for enum order_status: "completed"
--
-- Combined with the scheduled_requires_date constraint bug fixed in commit
-- 94b0bf0, this is why /checkout/create-session has been returning "Failed
-- to create order" for the last week (0 successful orders in 7 days at the
-- time this was authored).
--
-- The trigger function and trigger were originally added to live DB without
-- a migration file (more schema drift). This migration documents both: the
-- function with the corrected enum literal AND the trigger creation guarded
-- by an EXISTS check so prod is a no-op and a fresh build registers it.
--
-- Replaced 'completed' → 'delivered' (the enum's terminal positive state).
-- This matches mission_on_real_order which already gates on
-- ('confirmed','dispatched','delivered') and treats delivered as completion.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_project_spend()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  delta bigint := 0;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.project_id IS NOT NULL AND NEW.status = 'delivered' THEN
    delta := ROUND(COALESCE(NEW.total_amount, 0) * 100);
    UPDATE public.projects SET spend_cents = spend_cents + delta, updated_at = now()
    WHERE id = NEW.project_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- transitioning into delivered
    IF (OLD.status IS DISTINCT FROM 'delivered') AND NEW.status = 'delivered' AND NEW.project_id IS NOT NULL THEN
      delta := ROUND(COALESCE(NEW.total_amount, 0) * 100);
      UPDATE public.projects SET spend_cents = spend_cents + delta, updated_at = now()
      WHERE id = NEW.project_id;
    -- transitioning out of delivered (refund)
    ELSIF OLD.status = 'delivered' AND NEW.status IS DISTINCT FROM 'delivered' AND OLD.project_id IS NOT NULL THEN
      delta := ROUND(COALESCE(OLD.total_amount, 0) * 100);
      UPDATE public.projects SET spend_cents = GREATEST(0, spend_cents - delta), updated_at = now()
      WHERE id = OLD.project_id;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- Idempotent trigger guard: prod no-op (already exists), fresh build creates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_sync_project_spend' AND c.relname = 'orders'
  ) THEN
    CREATE TRIGGER trg_sync_project_spend
      AFTER INSERT OR UPDATE ON public.orders
      FOR EACH ROW EXECUTE FUNCTION sync_project_spend();
  END IF;
END $$;

COMMIT;
