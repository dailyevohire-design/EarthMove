-- 215_trust_watch_subscriptions
--
-- User-subscribable per-contractor monitoring. Each row is one user
-- watching one contractor; UNIQUE (user_id, contractor_id) enforces
-- one-subscription-per-pair. RLS gates so users only see their own rows.
--
-- The notify_on_finding_types array filters which evidence row types
-- trigger an alert; default covers the "high-severity adverse" set
-- (license/sanction/phoenix/civil_judgment/osha_willful etc.).
-- notify_on_score_drop_threshold (nullable) opt-in to score-delta alerts.

CREATE TABLE IF NOT EXISTS trust_watch_subscriptions (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contractor_id                     uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  channels                          text[] NOT NULL DEFAULT ARRAY['email']::text[],
  active                            boolean NOT NULL DEFAULT true,
  notify_on_finding_types           text[] NOT NULL DEFAULT ARRAY[
    'license_revoked','license_suspended','license_disciplinary_action',
    'license_revoked_but_operating',
    'civil_judgment_against',
    'osha_willful_citation','osha_repeat_citation','osha_fatality_finding',
    'sanction_hit','phoenix_signal'
  ]::text[],
  notify_on_score_drop_threshold    smallint,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now(),
  last_alerted_at                   timestamptz,
  CONSTRAINT trust_watch_subscriptions_user_contractor_unique
    UNIQUE (user_id, contractor_id)
);

CREATE INDEX IF NOT EXISTS idx_tws_user_active
  ON trust_watch_subscriptions(user_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_tws_contractor_active
  ON trust_watch_subscriptions(contractor_id) WHERE active;

DROP TRIGGER IF EXISTS trg_tws_updated ON trust_watch_subscriptions;
CREATE TRIGGER trg_tws_updated
  BEFORE UPDATE ON trust_watch_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE trust_watch_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tws_owner_select ON trust_watch_subscriptions;
CREATE POLICY tws_owner_select ON trust_watch_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS tws_owner_insert ON trust_watch_subscriptions;
CREATE POLICY tws_owner_insert ON trust_watch_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS tws_owner_update ON trust_watch_subscriptions;
CREATE POLICY tws_owner_update ON trust_watch_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS tws_owner_delete ON trust_watch_subscriptions;
CREATE POLICY tws_owner_delete ON trust_watch_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Service role bypasses RLS for the Inngest worker that reads
-- subscriptions to dispatch alerts.
