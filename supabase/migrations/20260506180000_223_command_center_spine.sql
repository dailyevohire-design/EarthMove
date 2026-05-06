-- 223_command_center_spine.sql
-- Foundation tables for the operator command center: append-only event ledger,
-- intervention card queue, per-card audit log. RLS uses the existing is_admin()
-- function. Writes through service_role only (Inngest, webhooks); admins read.
--
-- Applied to prod via MCP 2026-05-06 prior to commit. Idempotent re-run safe.
-- Commit 1 of 3 for the command center build (spine → pager → ops console).

-- entity_events: append-only ledger
CREATE TABLE IF NOT EXISTS public.entity_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL CHECK (entity_type IN (
                 'order','customer','gc','driver','dispatch','session','system','supplier')),
  entity_id    uuid,
  event_type   text NOT NULL,
  severity     text NOT NULL DEFAULT 'info'
                 CHECK (severity IN ('debug','info','warn','critical')),
  source       text NOT NULL CHECK (source IN (
                 'web','stripe','twilio','inngest','manual','system')),
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id     uuid,
  session_id   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_events_entity_recent
  ON public.entity_events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_events_recent
  ON public.entity_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_events_alerting
  ON public.entity_events (created_at DESC)
  WHERE severity IN ('warn','critical');
CREATE INDEX IF NOT EXISTS idx_entity_events_event_type
  ON public.entity_events (event_type, created_at DESC);

ALTER TABLE public.entity_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_events_admin_read ON public.entity_events;
CREATE POLICY entity_events_admin_read ON public.entity_events
  FOR SELECT TO authenticated USING (is_admin());

COMMENT ON TABLE public.entity_events IS
  'Append-only event ledger powering the command-center intervention engine. Writes via service_role only; admins read.';

-- intervention_cards: ops queue
CREATE TABLE IF NOT EXISTS public.intervention_cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key        text NOT NULL,
  entity_type     text NOT NULL CHECK (entity_type IN (
                    'order','customer','gc','driver','dispatch','session','system','supplier')),
  entity_id       uuid,
  severity        text NOT NULL CHECK (severity IN ('info','warn','critical')),
  title           text NOT NULL,
  body            text,
  ai_summary      text,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','claimed','snoozed','resolved','dismissed')),
  claimed_by      uuid REFERENCES auth.users(id),
  claimed_at      timestamptz,
  snoozed_until   timestamptz,
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id),
  resolution_note text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedup_key       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_intervention_cards_dedup_open
  ON public.intervention_cards (dedup_key)
  WHERE dedup_key IS NOT NULL AND status IN ('open','claimed','snoozed');

CREATE INDEX IF NOT EXISTS idx_intervention_cards_queue
  ON public.intervention_cards (severity, created_at DESC)
  WHERE status IN ('open','claimed');
CREATE INDEX IF NOT EXISTS idx_intervention_cards_entity
  ON public.intervention_cards (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_intervention_cards_snoozed
  ON public.intervention_cards (snoozed_until)
  WHERE status = 'snoozed';

DROP TRIGGER IF EXISTS trg_intervention_cards_updated_at ON public.intervention_cards;
CREATE TRIGGER trg_intervention_cards_updated_at
  BEFORE UPDATE ON public.intervention_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.intervention_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intervention_cards_admin_all ON public.intervention_cards;
CREATE POLICY intervention_cards_admin_all ON public.intervention_cards
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE public.intervention_cards IS
  'Ops queue. One row per rule firing. Snooze/resolve via /admin/command. Dedup key prevents the same rule from firing twice on the same entity while a prior card is open.';

-- intervention_actions: per-card audit log
CREATE TABLE IF NOT EXISTS public.intervention_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES public.intervention_cards(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES auth.users(id),
  action_kind text NOT NULL CHECK (action_kind IN (
                'claim','snooze','resolve','dismiss','sms','email','call','note')),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intervention_actions_card
  ON public.intervention_actions (card_id, created_at DESC);

ALTER TABLE public.intervention_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intervention_actions_admin_all ON public.intervention_actions;
CREATE POLICY intervention_actions_admin_all ON public.intervention_actions
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE public.intervention_actions IS
  'Append-only audit per intervention card: claim, snooze, resolve, sms, email, call, note.';
