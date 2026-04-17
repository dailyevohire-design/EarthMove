-- 019_driver_dashboard_v2.sql
-- Driver dashboard v2: phase machine + append-only event log + UI prefs.
-- Visual spec: design/mockups/driver-dashboard-v2.html
-- Pivots off internal public.dispatches (Sarah/Jesse external project shelved).

-- ─────────────────────────────────────────────────────────────
-- 1. dispatches.current_phase
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.dispatches
  ADD COLUMN current_phase TEXT NOT NULL DEFAULT 'ready'
  CHECK (current_phase IN ('ready','en_route_pickup','loading','en_route_site','dumped','ticket_submitted'));

CREATE INDEX idx_dispatches_driver_phase ON public.dispatches (driver_id, current_phase)
  WHERE current_phase NOT IN ('ticket_submitted');

-- ─────────────────────────────────────────────────────────────
-- 2. dispatch_events (append-only log)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.dispatch_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id   uuid NOT NULL REFERENCES public.dispatches(id) ON DELETE CASCADE,
  driver_id     uuid NOT NULL REFERENCES public.drivers(id)    ON DELETE CASCADE,
  phase         TEXT NOT NULL CHECK (phase IN ('ready','en_route_pickup','loading','en_route_site','dumped','ticket_submitted')),
  ts            timestamptz NOT NULL DEFAULT now(),
  lat           numeric,
  lng           numeric,
  source        text        NOT NULL DEFAULT 'driver_app',
  payload       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_events_dispatch_ts ON public.dispatch_events (dispatch_id, ts DESC);
CREATE INDEX idx_dispatch_events_driver_ts   ON public.dispatch_events (driver_id,  ts DESC);

ALTER TABLE public.dispatch_events ENABLE ROW LEVEL SECURITY;

-- driver identity: drivers.user_id = auth.uid()
CREATE POLICY dispatch_events_driver_select ON public.dispatch_events
  FOR SELECT TO authenticated
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY dispatch_events_driver_insert ON public.dispatch_events
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
    AND source = 'driver_app'
  );

CREATE POLICY dispatch_events_service_all ON public.dispatch_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Append-only: no UPDATE/DELETE policies for authenticated.

-- ─────────────────────────────────────────────────────────────
-- 3. driver_preferences.ui_prefs
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.driver_preferences
  ADD COLUMN ui_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.driver_preferences.ui_prefs IS
  'Ephemeral client UI state: glove_mode, dark_mode, offline_mode_shown, last_language, earnings_moment_seen_count. Operational prefs stay in their dedicated columns.';

-- ─────────────────────────────────────────────────────────────
-- 4. Trigger: sync dispatches.current_phase on event insert
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_dispatch_phase() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.dispatches SET
    current_phase = NEW.phase,
    updated_at    = now(),
    completed_at  = CASE WHEN NEW.phase = 'ticket_submitted' THEN now() ELSE completed_at END,
    status        = CASE WHEN NEW.phase = 'ticket_submitted' THEN 'completed' ELSE status END
  WHERE id = NEW.dispatch_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_dispatch_phase AFTER INSERT ON public.dispatch_events
  FOR EACH ROW EXECUTE FUNCTION public.sync_dispatch_phase();
