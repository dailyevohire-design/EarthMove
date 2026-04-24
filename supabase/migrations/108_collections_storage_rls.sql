-- 108_collections_storage_rls.sql
-- Path convention: {user_id}/{case_id}/{demand_letter|notice_of_intent|pre_lien_notice|lien}.pdf
-- Object-level RLS mirrors collections_cases_own_all: users read only their own folder;
-- service role has full access for server-side uploads.

CREATE POLICY "Users read own collections objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'collections' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Service role full access collections" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'collections') WITH CHECK (bucket_id = 'collections');
