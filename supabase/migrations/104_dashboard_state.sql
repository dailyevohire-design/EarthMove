-- Per-user dashboard state for /admin/command-center
create table if not exists public.dashboard_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_state enable row level security;

drop policy if exists "dashboard_state_select_own" on public.dashboard_state;
drop policy if exists "dashboard_state_insert_own" on public.dashboard_state;
drop policy if exists "dashboard_state_update_own" on public.dashboard_state;

create policy "dashboard_state_select_own" on public.dashboard_state
  for select using (auth.uid() = user_id);

create policy "dashboard_state_insert_own" on public.dashboard_state
  for insert with check (auth.uid() = user_id);

create policy "dashboard_state_update_own" on public.dashboard_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_ts on public.dashboard_state;
create trigger set_ts
  before update on public.dashboard_state
  for each row execute function update_updated_at();
