-- Migration 032: location_pings
-- Applied to prod 2026-04-18 via Supabase MCP.
-- Volume plan: 24 drivers now (~144K rows/day); at 1000 drivers ~6M rows/day.
-- TODO partition when count > 20M (~5 months at 1000 drivers).
-- H3 r9 cells computed in Next.js/FastAPI via h3-js/h3-py (h3-pg ext not available).

CREATE TABLE IF NOT EXISTS public.location_pings (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.driver_sessions(id) ON DELETE CASCADE,
  dispatch_id uuid REFERENCES public.dispatches(id) ON DELETE SET NULL,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geom geography(point, 4326) GENERATED ALWAYS AS
    (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
  h3_r9 bigint,
  accuracy_m real,
  speed_mps real,
  heading_deg real,
  altitude_m real,
  source text NOT NULL DEFAULT 'browser'
    CHECK (source IN ('browser','sms_geocode','carrier','manual')),
  battery_pct smallint CHECK (battery_pct IS NULL OR battery_pct BETWEEN 0 AND 100),
  anomaly_flags text[]
);

CREATE INDEX IF NOT EXISTS location_pings_dispatch_time_idx ON public.location_pings (dispatch_id, recorded_at DESC) WHERE dispatch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS location_pings_driver_time_idx ON public.location_pings (driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS location_pings_session_time_idx ON public.location_pings (session_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS location_pings_geom_idx ON public.location_pings USING gist(geom);
CREATE INDEX IF NOT EXISTS location_pings_h3_r9_idx ON public.location_pings (h3_r9) WHERE h3_r9 IS NOT NULL;
CREATE INDEX IF NOT EXISTS location_pings_anomaly_idx ON public.location_pings USING gin(anomaly_flags) WHERE anomaly_flags IS NOT NULL;

ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY location_pings_service_all ON public.location_pings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY location_pings_driver_self ON public.location_pings FOR SELECT TO authenticated
  USING (driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = (SELECT auth.uid())));

CREATE POLICY location_pings_contractor_org ON public.location_pings FOR SELECT TO authenticated
  USING (dispatch_id IN (
    SELECT dsp.id FROM public.dispatches dsp
    JOIN public.orders o ON o.id = dsp.order_id
    WHERE o.customer_id = (SELECT auth.uid()) OR o.placed_by_profile_id = (SELECT auth.uid())
  ));

CREATE POLICY location_pings_admin ON public.location_pings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

COMMENT ON TABLE public.location_pings IS 'High-volume driver GPS pings from PWA sessions. H3 r9 computed in app. TODO partition when count > 20M. T2 migration 032.';
COMMENT ON COLUMN public.location_pings.h3_r9 IS 'H3 resolution 9 cell ID as bigint. Computed via h3-js/h3-py (h3-pg not available in Supabase).';
COMMENT ON COLUMN public.location_pings.anomaly_flags IS 'Populated by Inngest anti-spoof worker: velocity, accuracy, ip_mismatch, straight_line, teleport. Server-side only.';
