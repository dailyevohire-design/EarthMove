-- Migration 033: geofences
-- Applied to prod 2026-04-18 via Supabase MCP.
-- Polymorphic owner (project | supply_yard | order | supplier). No FK on owner_id.

CREATE TABLE IF NOT EXISTS public.geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('project','supply_yard','order','supplier')),
  owner_id uuid NOT NULL,
  name text,
  kind text NOT NULL DEFAULT 'site'
    CHECK (kind IN ('site','loading','dumping','keepout','haul_corridor')),
  geom geography(polygon, 4326) NOT NULL,
  buffer_m integer NOT NULL DEFAULT 30 CHECK (buffer_m >= 0 AND buffer_m <= 5000),
  dwell_min_s integer NOT NULL DEFAULT 60 CHECK (dwell_min_s >= 0 AND dwell_min_s <= 86400),
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS geofences_owner_idx ON public.geofences (owner_type, owner_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS geofences_geom_idx ON public.geofences USING gist(geom) WHERE active = true;
CREATE INDEX IF NOT EXISTS geofences_kind_idx ON public.geofences (kind) WHERE active = true;

CREATE TRIGGER trg_geofences_updated_at
  BEFORE UPDATE ON public.geofences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY geofences_service_all ON public.geofences FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY geofences_admin ON public.geofences FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

CREATE POLICY geofences_contractor_org ON public.geofences FOR SELECT TO authenticated
  USING (
    (owner_type = 'project' AND owner_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.organization_id = (SELECT auth.uid())
         OR p.organization_id IN (
           SELECT tm.organization_id FROM public.team_members tm
           WHERE tm.user_id = (SELECT auth.uid()) AND tm.active = true
         )
    ))
    OR
    (owner_type = 'order' AND owner_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.customer_id = (SELECT auth.uid()) OR o.placed_by_profile_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY geofences_contractor_write ON public.geofences FOR ALL TO authenticated
  USING (
    owner_type = 'project' AND owner_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.organization_id = (SELECT auth.uid())
         OR p.organization_id IN (
           SELECT tm.organization_id FROM public.team_members tm
           WHERE tm.user_id = (SELECT auth.uid()) AND tm.active = true AND tm.can_manage_team = true
         )
    )
  )
  WITH CHECK (
    owner_type = 'project' AND owner_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.organization_id = (SELECT auth.uid())
         OR p.organization_id IN (
           SELECT tm.organization_id FROM public.team_members tm
           WHERE tm.user_id = (SELECT auth.uid()) AND tm.active = true AND tm.can_manage_team = true
         )
    )
  );

CREATE POLICY geofences_supplier_own ON public.geofences FOR ALL TO authenticated
  USING (
    owner_type = 'supply_yard' AND owner_id IN (
      SELECT sy.id FROM public.supply_yards sy
      JOIN public.profiles pr ON pr.supplier_id = sy.supplier_id
      WHERE pr.id = (SELECT auth.uid()) AND pr.role = 'supplier'
    )
  )
  WITH CHECK (
    owner_type = 'supply_yard' AND owner_id IN (
      SELECT sy.id FROM public.supply_yards sy
      JOIN public.profiles pr ON pr.supplier_id = sy.supplier_id
      WHERE pr.id = (SELECT auth.uid()) AND pr.role = 'supplier'
    )
  );

CREATE POLICY geofences_driver_assigned ON public.geofences FOR SELECT TO authenticated
  USING (
    (owner_type = 'order' AND owner_id IN (
      SELECT dsp.order_id FROM public.dispatches dsp
      JOIN public.drivers dr ON dr.id = dsp.driver_id
      WHERE dr.user_id = (SELECT auth.uid())
    ))
    OR
    (owner_type = 'supply_yard' AND owner_id IN (
      SELECT o.supply_yard_id FROM public.orders o
      JOIN public.dispatches dsp ON dsp.order_id = o.id
      JOIN public.drivers dr ON dr.id = dsp.driver_id
      WHERE dr.user_id = (SELECT auth.uid())
    ))
  );

COMMENT ON TABLE public.geofences IS 'Polymorphic geofences (project | supply_yard | order | supplier). Inngest worker evaluates location_pings against active fences and emits dispatch_events phase transitions. T2 migration 033.';
COMMENT ON COLUMN public.geofences.owner_type IS 'Polymorphic owner discriminator. NO FK - validated at app layer.';
COMMENT ON COLUMN public.geofences.buffer_m IS 'Meters of tolerance around polygon edge. Used with ST_DWithin for arrival detection. Default 30m.';
COMMENT ON COLUMN public.geofences.dwell_min_s IS 'Seconds driver must remain inside before arrival event fires. Filters GPS bounce. Default 60s.';
