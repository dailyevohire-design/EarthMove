-- Migration 036: Storage bucket + RLS for dispatch-media
-- Applied to prod 2026-04-18 via Supabase MCP.
-- Bucket: private, 50 MB limit, images + PDF only.
-- Path convention: dispatches/<dispatch_id>/<media_type>/<timestamp>-<sha8>.<ext>
-- Objects are immutable after upload (no UPDATE/DELETE policies).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dispatch-media',
  'dispatch-media',
  false,
  52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "dispatch_media_bucket_service_all" ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'dispatch-media') WITH CHECK (bucket_id = 'dispatch-media');

CREATE POLICY "dispatch_media_bucket_admin" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'dispatch-media' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

CREATE POLICY "dispatch_media_bucket_driver_own" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispatch-media'
    AND (string_to_array(name, '/'))[1] = 'dispatches'
    AND (string_to_array(name, '/'))[2]::uuid IN (
      SELECT dsp.id FROM public.dispatches dsp
      JOIN public.drivers dr ON dr.id = dsp.driver_id
      WHERE dr.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "dispatch_media_bucket_driver_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dispatch-media'
    AND (string_to_array(name, '/'))[1] = 'dispatches'
    AND (string_to_array(name, '/'))[2]::uuid IN (
      SELECT dsp.id FROM public.dispatches dsp
      JOIN public.drivers dr ON dr.id = dsp.driver_id
      WHERE dr.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "dispatch_media_bucket_contractor_org" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispatch-media'
    AND (string_to_array(name, '/'))[1] = 'dispatches'
    AND (string_to_array(name, '/'))[2]::uuid IN (
      SELECT dsp.id FROM public.dispatches dsp
      JOIN public.orders o ON o.id = dsp.order_id
      WHERE o.customer_id = (SELECT auth.uid())
         OR o.placed_by_profile_id = (SELECT auth.uid())
         OR o.project_id IN (
           SELECT p.id FROM public.projects p
           WHERE p.organization_id = (SELECT auth.uid())
              OR p.organization_id IN (
                SELECT tm.organization_id FROM public.team_members tm
                WHERE tm.user_id = (SELECT auth.uid()) AND tm.active = true
              )
         )
    )
  );

CREATE POLICY "dispatch_media_bucket_contractor_damage_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dispatch-media'
    AND (string_to_array(name, '/'))[1] = 'dispatches'
    AND (string_to_array(name, '/'))[3] = 'damage'
    AND (string_to_array(name, '/'))[2]::uuid IN (
      SELECT dsp.id FROM public.dispatches dsp
      JOIN public.orders o ON o.id = dsp.order_id
      WHERE o.customer_id = (SELECT auth.uid()) OR o.placed_by_profile_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "dispatch_media_bucket_supplier_own" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispatch-media'
    AND (string_to_array(name, '/'))[1] = 'dispatches'
    AND (string_to_array(name, '/'))[2]::uuid IN (
      SELECT dsp.id FROM public.dispatches dsp
      JOIN public.orders o ON o.id = dsp.order_id
      JOIN public.profiles pr ON pr.supplier_id = o.supplier_id
      WHERE pr.id = (SELECT auth.uid()) AND pr.role = 'supplier'
    )
  );

CREATE POLICY "dispatch_media_bucket_supplier_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dispatch-media'
    AND (string_to_array(name, '/'))[1] = 'dispatches'
    AND (string_to_array(name, '/'))[3] IN ('bol','scale_ticket','load_photo')
    AND (string_to_array(name, '/'))[2]::uuid IN (
      SELECT dsp.id FROM public.dispatches dsp
      JOIN public.orders o ON o.id = dsp.order_id
      JOIN public.profiles pr ON pr.supplier_id = o.supplier_id
      WHERE pr.id = (SELECT auth.uid()) AND pr.role = 'supplier'
    )
  );
