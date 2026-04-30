-- 114_trust_reports_backfill_contractor_id.sql
-- Backfill trust_reports.contractor_id for non-fixture reports created before
-- migration 113 (resolve_or_create_contractor) existed. Forward path: C5
-- runTrustJobV2 ensures every new report populates contractor_id at creation.
--
-- Scope: skip fixture rows (deterministic test data; binding them to
-- contractors pollutes find_similar_contractors). Skip rows already linked.
-- Idempotent: re-running is a no-op because resolve_or_create_contractor is
-- idempotent on (normalized_name, state_code) and we only UPDATE WHERE
-- contractor_id IS NULL.

do $backfill$
declare
  r record;
  c public.contractors;
  updated_count int := 0;
begin
  for r in
    select id, contractor_name, state_code, city
    from public.trust_reports
    where contractor_id is null
      and data_integrity_status is distinct from 'fixtures'
      and contractor_name not like 'FORENSIC_TEST_%'
      and contractor_name not like 'FTEST_%'
      and contractor_name not like 'SEED_%'
      and contractor_name is not null
      and btrim(contractor_name) <> ''
      and state_code is not null
  loop
    c := public.resolve_or_create_contractor(r.contractor_name, r.state_code::char(2), r.city);

    update public.trust_reports
       set contractor_id = c.id
     where id = r.id
       and contractor_id is null;

    if found then
      updated_count := updated_count + 1;
    end if;
  end loop;

  raise notice 'Backfilled % trust_reports rows with contractor_id', updated_count;
end
$backfill$;
