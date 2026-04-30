-- pgTAP tests for resolve_or_create_contractor.
-- Run via: supabase test db
-- pgtap is enabled here only (NOT in prod migration) so this file is self-contained.

create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

begin;
select plan(8);

-- 1. function exists with the right signature
select has_function(
  'public', 'resolve_or_create_contractor',
  array['text','character','text'],
  'resolve_or_create_contractor(text, char(2), text default) exists'
);

-- 2. SECURITY INVOKER (not DEFINER)
select is(
  (select prosecdef from pg_proc
   where proname = 'resolve_or_create_contractor'
     and pronamespace = 'public'::regnamespace),
  false,
  'resolve_or_create_contractor is SECURITY INVOKER'
);

-- 3. search_path is locked to empty
select ok(
  (select array_to_string(proconfig, ',') ~ 'search_path=$'
   from pg_proc
   where proname = 'resolve_or_create_contractor'
     and pronamespace = 'public'::regnamespace),
  'search_path is set to empty (SET search_path = '''')'
);

-- 4. first call inserts a row
do $t$
declare c1 public.contractors;
begin
  c1 := public.resolve_or_create_contractor('PGTAP TEST PLUMBING LLC', 'TX', 'Austin');
  perform 1 from public.contractors where id = c1.id;
  if not found then raise exception 'first insert failed'; end if;
end $t$;
select pass('first call inserts new contractors row');

-- 5. second call returns same id (idempotent on normalized_name + state_code)
do $t$
declare
  c1 public.contractors;
  c2 public.contractors;
begin
  c1 := public.resolve_or_create_contractor('PGTAP TEST PLUMBING LLC', 'TX', 'Austin');
  c2 := public.resolve_or_create_contractor('PGTAP TEST PLUMBING LLC', 'TX', 'Austin');
  if c1.id is distinct from c2.id then
    raise exception 'idempotency broken: c1.id=% c2.id=%', c1.id, c2.id;
  end if;
end $t$;
select pass('repeat call returns same contractor id');

-- 6. on conflict, last_refreshed_at is set
do $t$
declare c2 public.contractors;
begin
  perform public.resolve_or_create_contractor('PGTAP TEST PLUMBING LLC', 'TX', 'Austin');
  c2 := public.resolve_or_create_contractor('PGTAP TEST PLUMBING LLC', 'TX', 'Austin');
  if c2.last_refreshed_at is null then raise exception 'last_refreshed_at not set on conflict'; end if;
end $t$;
select pass('on conflict, last_refreshed_at is bumped');

-- 7. different state_code partitions identity
do $t$
declare
  c_tx public.contractors;
  c_ca public.contractors;
begin
  c_tx := public.resolve_or_create_contractor('PGTAP TEST PLUMBING LLC', 'TX', null);
  c_ca := public.resolve_or_create_contractor('PGTAP TEST PLUMBING LLC', 'CA', null);
  if c_tx.id = c_ca.id then raise exception 'state_code did not partition identity'; end if;
end $t$;
select pass('state_code partitions contractor identity');

-- 8. null/empty inputs raise 22023
select throws_ok(
  $q$ select public.resolve_or_create_contractor(null, 'TX'::char(2), null) $q$,
  '22023', null,
  'null legal_name raises invalid_parameter_value'
);

select * from finish();
rollback;
