-- Migration 034: sms_consent
-- Applied to prod 2026-04-18 via Supabase MCP.
-- TCPA PEWC evidence ledger. Append-only — grants and revokes are both rows, never updates.
-- Supports FCC April 2025 revocation rule (10 biz days, any keyword, any language).

CREATE TABLE IF NOT EXISTS public.sms_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('grant','revoke','confirmation','dispute')),
  consent_type text NOT NULL CHECK (consent_type IN ('dispatch_only','dispatch_plus_location','marketing','carrier_location')),
  disclosure_version text,
  disclosure_text_sha256 text,
  disclosure_text_full text,
  method text NOT NULL CHECK (method IN ('web_form_checkbox','sms_reply_start','voice_ivr','written_paper','api_passthrough')),
  revocation_keyword text,
  revocation_scope text CHECK (revocation_scope IS NULL OR revocation_scope IN ('this_campaign','all_campaigns','specific_category')),
  revocation_processed_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  e_sign_attested boolean NOT NULL DEFAULT false,
  ip_inet inet,
  user_agent text,
  recorded_by text NOT NULL DEFAULT 'service',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_consent_phone_time_idx ON public.sms_consent (phone_e164, consent_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS sms_consent_revoke_idx ON public.sms_consent (phone_e164, consent_type, occurred_at DESC) WHERE event_type = 'revoke';
CREATE INDEX IF NOT EXISTS sms_consent_profile_idx ON public.sms_consent (profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_consent_driver_idx ON public.sms_consent (driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_consent_disclosure_idx ON public.sms_consent (disclosure_version, occurred_at DESC) WHERE disclosure_version IS NOT NULL;

ALTER TABLE public.sms_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY sms_consent_service_insert ON public.sms_consent FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY sms_consent_service_read ON public.sms_consent FOR SELECT TO service_role USING (true);

CREATE POLICY sms_consent_admin ON public.sms_consent FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

CREATE POLICY sms_consent_self_read ON public.sms_consent FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = (SELECT auth.uid()))
  );

CREATE OR REPLACE VIEW public.sms_consent_current AS
SELECT DISTINCT ON (phone_e164, consent_type)
  phone_e164,
  consent_type,
  event_type,
  occurred_at,
  CASE WHEN event_type = 'grant' THEN true ELSE false END AS currently_consented,
  disclosure_version,
  id AS latest_event_id
FROM public.sms_consent
WHERE event_type IN ('grant','revoke')
ORDER BY phone_e164, consent_type, occurred_at DESC;

COMMENT ON TABLE public.sms_consent IS 'TCPA PEWC evidence ledger. Append-only. Supports FCC April 2025 revocation rule. T2 migration 034.';
COMMENT ON COLUMN public.sms_consent.disclosure_text_sha256 IS 'SHA-256 of exact PEWC disclosure text shown at consent time.';
COMMENT ON COLUMN public.sms_consent.evidence IS 'Method-specific evidence bundle: IP, UA, Twilio SIDs, SHA256 hashes of inbound messages.';
COMMENT ON VIEW public.sms_consent_current IS 'Latest consent state per (phone_e164, consent_type). Query this for runtime opt-in/opt-out checks.';
