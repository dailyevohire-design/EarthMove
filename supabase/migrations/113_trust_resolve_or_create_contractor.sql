-- 113_trust_resolve_or_create_contractor.sql
-- Adds the upsert helper that all Tranche B scrapers will call to resolve a
-- (legal_name, state_code) pair to a stable contractor_id. Idempotent on the
-- existing contractors_normalized_state_uniq index. SECURITY INVOKER —
-- callers must already have INSERT/SELECT on public.contractors via grants
-- or service_role bypass. No RLS changes here.

create or replace function public.resolve_or_create_contractor(
  p_legal_name text,
  p_state_code char(2),
  p_city text default null
) returns public.contractors
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_norm  text;
  v_state char(2) := upper(p_state_code);
  v_slug  text;
  v_row   public.contractors;
begin
  if p_legal_name is null or btrim(p_legal_name) = '' then
    raise exception 'resolve_or_create_contractor: p_legal_name required'
      using errcode = '22023';
  end if;
  if p_state_code is null or btrim(p_state_code) = '' then
    raise exception 'resolve_or_create_contractor: p_state_code required'
      using errcode = '22023';
  end if;

  v_norm := public.normalize_contractor_name(p_legal_name);
  if v_norm is null or v_norm = '' then
    raise exception 'resolve_or_create_contractor: normalize_contractor_name returned empty for %', p_legal_name
      using errcode = '22023';
  end if;

  v_slug := public.contractor_slug(p_legal_name, v_state);

  insert into public.contractors as c
    (legal_name, normalized_name, state_code, city, slug, first_seen_at)
  values
    (p_legal_name, v_norm, v_state, p_city, v_slug, now())
  on conflict (normalized_name, state_code) do update
    set last_refreshed_at = now(),
        city = coalesce(c.city, excluded.city)
  returning c.* into v_row;

  return v_row;
end;
$fn$;

revoke all on function public.resolve_or_create_contractor(text, char, text) from public;
grant execute on function public.resolve_or_create_contractor(text, char, text) to authenticated, service_role;

comment on function public.resolve_or_create_contractor(text, char, text) is
  'Tranche B scraper helper. Resolves an existing contractors row or inserts a new one, idempotent on (normalized_name, state_code). On conflict, bumps last_refreshed_at and fills city if previously null. SECURITY INVOKER — caller must have INSERT/SELECT on public.contractors. Returns the full contractors row.';
