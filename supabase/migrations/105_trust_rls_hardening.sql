-- P0-5. Drop the policy that lets any authenticated user read trust_cache.
-- Application code always goes through get_cached_trust_report /
-- set_cached_trust_report under service_role; no legitimate caller needs
-- direct SELECT on the table. This plugs a paid-content bypass / PII leak.
DROP POLICY IF EXISTS trust_cache_authenticated_read ON public.trust_cache;

-- P1-9. Drop the (text, character, text) overload of get_cached_trust_report.
-- Migration 103 dropped (text, text, text) but missed the older character
-- variant, which has no pinned search_path. Removing it eliminates the
-- unpinned code path and an overload-ambiguity footgun.
DROP FUNCTION IF EXISTS public.get_cached_trust_report(text, character, text);

-- P1-8. Re-create grant_credit_from_stripe_event as SECURITY DEFINER with
-- pinned search_path. Body is preserved verbatim (same validation, same
-- idempotency, same unique_violation race handler). Re-apply EXECUTE grants
-- so only service_role can call it.
CREATE OR REPLACE FUNCTION public.grant_credit_from_stripe_event(
  p_stripe_event_id           text,
  p_event_type                text,
  p_user_id                   uuid,
  p_tier                      text,
  p_amount_cents              integer,
  p_stripe_session_id         text    DEFAULT NULL,
  p_stripe_payment_intent_id  text    DEFAULT NULL,
  p_stripe_customer_id        text    DEFAULT NULL,
  p_credit_validity_days      integer DEFAULT 90,
  p_payload                   jsonb   DEFAULT '{}'::jsonb
) RETURNS trust_credits_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_event  trust_stripe_events;
  v_credit trust_credits_ledger;
BEGIN
  IF p_stripe_event_id IS NULL OR BTRIM(p_stripe_event_id) = '' THEN
    RAISE EXCEPTION 'stripe_event_id required';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;
  IF p_tier NOT IN ('standard','plus','deep_dive','forensic') THEN
    RAISE EXCEPTION 'tier must be one of: standard, plus, deep_dive, forensic (got %)', p_tier;
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount_cents must be positive';
  END IF;
  IF p_credit_validity_days < 1 OR p_credit_validity_days > 3650 THEN
    RAISE EXCEPTION 'credit_validity_days must be between 1 and 3650';
  END IF;

  SELECT * INTO v_event
  FROM trust_stripe_events
  WHERE stripe_event_id = p_stripe_event_id;

  IF FOUND THEN
    IF v_event.credit_id IS NOT NULL THEN
      SELECT * INTO v_credit
      FROM trust_credits_ledger
      WHERE id = v_event.credit_id;
      IF FOUND THEN RETURN v_credit; END IF;
    END IF;
    RAISE EXCEPTION 'event % already processed but credit missing (id=%)',
      p_stripe_event_id, v_event.credit_id;
  END IF;

  INSERT INTO trust_credits_ledger (
    user_id, tier, balance_delta, reason,
    stripe_checkout_session_id, stripe_payment_intent_id,
    granted_at, expires_at, idempotency_key,
    source_metadata
  ) VALUES (
    p_user_id, p_tier, 1, 'stripe_purchase',
    p_stripe_session_id, p_stripe_payment_intent_id,
    NOW(), NOW() + (p_credit_validity_days || ' days')::INTERVAL,
    p_stripe_event_id,
    jsonb_build_object(
      'event_type',   p_event_type,
      'amount_cents', p_amount_cents,
      'customer_id',  p_stripe_customer_id
    )
  ) RETURNING * INTO v_credit;

  INSERT INTO trust_stripe_events (
    stripe_event_id, event_type, user_id, tier, amount_cents,
    stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id,
    credit_id, payload
  ) VALUES (
    p_stripe_event_id, p_event_type, p_user_id, p_tier, p_amount_cents,
    p_stripe_session_id, p_stripe_payment_intent_id, p_stripe_customer_id,
    v_credit.id, COALESCE(p_payload, '{}'::JSONB)
  );

  RETURN v_credit;

EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_event
  FROM trust_stripe_events
  WHERE stripe_event_id = p_stripe_event_id;
  IF FOUND AND v_event.credit_id IS NOT NULL THEN
    SELECT * INTO v_credit
    FROM trust_credits_ledger
    WHERE id = v_event.credit_id;
    IF FOUND THEN RETURN v_credit; END IF;
  END IF;
  RAISE;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.grant_credit_from_stripe_event(text, text, uuid, text, integer, text, text, text, integer, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_credit_from_stripe_event(text, text, uuid, text, integer, text, text, text, integer, jsonb) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.grant_credit_from_stripe_event(text, text, uuid, text, integer, text, text, text, integer, jsonb) TO service_role;

-- P1-10. trust_reports was cmd=ALL with qual only — any signed-in user could
-- forge rows matching their own user_id. Narrow to SELECT; INSERT/UPDATE/DELETE
-- go through service_role via /api/trust/route.ts.
DROP POLICY IF EXISTS trust_reports_own ON public.trust_reports;
CREATE POLICY trust_reports_own_select ON public.trust_reports
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- P1-10. trust_api_usage cmd=ALL let users insert cost_usd = -1000 rows to
-- clear their daily cap. Narrow to SELECT and add a non-negative check.
DROP POLICY IF EXISTS trust_usage_own ON public.trust_api_usage;
CREATE POLICY trust_usage_own_select ON public.trust_api_usage
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

ALTER TABLE public.trust_api_usage
  ADD CONSTRAINT trust_api_usage_cost_nonneg CHECK (cost_usd >= 0) NOT VALID;

-- P1-13. Entitlement-gate the public graph tables (trust_entity_edges,
-- trust_officer_links, trust_officers). Previously USING (true) — meaning
-- every anon caller would see the entire officer/overlap graph once these
-- tables populate. Today they are empty, so this is a pre-population guard.
-- Access requires a live trust_report_access grant for the associated
-- contractor. trust_officers has no direct contractor_id, so it joins via
-- trust_officer_links.

DROP POLICY IF EXISTS trust_entity_edges_public_read ON public.trust_entity_edges;
CREATE POLICY trust_entity_edges_entitled_read ON public.trust_entity_edges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trust_report_access tra
      WHERE tra.user_id = (SELECT auth.uid())
        AND tra.expires_at > now()
        AND tra.contractor_id IN (
          trust_entity_edges.from_contractor_id,
          trust_entity_edges.to_contractor_id
        )
    )
  );

DROP POLICY IF EXISTS trust_officer_links_public_read ON public.trust_officer_links;
CREATE POLICY trust_officer_links_entitled_read ON public.trust_officer_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trust_report_access tra
      WHERE tra.user_id = (SELECT auth.uid())
        AND tra.expires_at > now()
        AND tra.contractor_id = trust_officer_links.contractor_id
    )
  );

DROP POLICY IF EXISTS trust_officers_public_read ON public.trust_officers;
CREATE POLICY trust_officers_entitled_read ON public.trust_officers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trust_officer_links ol
      JOIN public.trust_report_access tra ON tra.contractor_id = ol.contractor_id
      WHERE ol.officer_id = trust_officers.id
        AND tra.user_id = (SELECT auth.uid())
        AND tra.expires_at > now()
    )
  );
