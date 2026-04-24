-- 106_trust_checkout_redemption_backfill.sql
-- Defensive: guarantee one ledger row per Stripe checkout session to prevent double-grants
-- from Stripe webhook retries. grant_credit_from_stripe_event is already idempotent on
-- stripe_event_id, but this index is a second line of defense at the session level.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS trust_credits_ledger_stripe_session_uniq
  ON public.trust_credits_ledger (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
COMMIT;
