-- ============================================================================
-- Knowledge Center: Content & Personalization Layer
-- Tables: learn_articles, learn_modules, learn_user_progress,
--         learn_user_recommendations, learn_lead_captures,
--         learn_personalization_rules, learn_audit_results
-- Reuses: update_updated_at(), is_admin(), markets(id)
-- ============================================================================

create table public.learn_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body_md text,
  trades text[] not null default '{}',
  topics text[] not null default '{}',
  market_specific boolean not null default false,
  market_id uuid references public.markets(id) on delete restrict,
  format text not null check (format in ('article','calculator','template','tool','video','pdf','checklist')),
  build_cost_band text not null check (build_cost_band in ('low','medium','high')),
  activation_lift_band text not null check (activation_lift_band in ('low','medium','high')),
  priority_score numeric,
  word_count int,
  reading_time_sec int,
  one_number_that_matters boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learn_articles_trades_gin on public.learn_articles using gin (trades);
create index learn_articles_topics_gin on public.learn_articles using gin (topics);
create index learn_articles_published_at on public.learn_articles (published_at desc) where published_at is not null;
create index learn_articles_market_id on public.learn_articles (market_id) where market_id is not null;

create trigger learn_articles_updated_at
  before update on public.learn_articles
  for each row execute function public.update_updated_at();

alter table public.learn_articles enable row level security;

create policy learn_articles_public_read on public.learn_articles
  for select using (published_at is not null);

create policy learn_articles_admin_all on public.learn_articles
  for all using (is_admin()) with check (is_admin());

create policy learn_articles_service_all on public.learn_articles
  for all using (true) with check (true);


create table public.learn_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  type text not null check (type in ('article','calculator','template','tool','video','checklist')),
  related_article_ids uuid[] not null default '{}',
  trades text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learn_modules_trades_gin on public.learn_modules using gin (trades);

create trigger learn_modules_updated_at
  before update on public.learn_modules
  for each row execute function public.update_updated_at();

alter table public.learn_modules enable row level security;

create policy learn_modules_public_read on public.learn_modules
  for select using (true);

create policy learn_modules_admin_all on public.learn_modules
  for all using (is_admin()) with check (is_admin());

create policy learn_modules_service_all on public.learn_modules
  for all using (true) with check (true);


create table public.learn_user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.learn_articles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  completed_at timestamptz,
  time_spent_sec int not null default 0,
  primary key (user_id, article_id)
);

create index learn_user_progress_article on public.learn_user_progress (article_id);
create index learn_user_progress_viewed on public.learn_user_progress (user_id, viewed_at desc);

alter table public.learn_user_progress enable row level security;

create policy learn_user_progress_own on public.learn_user_progress
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy learn_user_progress_service_all on public.learn_user_progress
  for all using (true) with check (true);


create table public.learn_user_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid references public.learn_articles(id) on delete set null,
  module_id uuid references public.learn_modules(id) on delete set null,
  reason text,
  score numeric,
  generated_at timestamptz not null default now(),
  dismissed_at timestamptz,
  check (article_id is not null or module_id is not null)
);

create index learn_user_recommendations_user on public.learn_user_recommendations (user_id, score desc nulls last);
create index learn_user_recommendations_active on public.learn_user_recommendations (user_id, generated_at desc) where dismissed_at is null;

alter table public.learn_user_recommendations enable row level security;

create policy learn_user_recommendations_own_select on public.learn_user_recommendations
  for select using ((select auth.uid()) = user_id);

create policy learn_user_recommendations_own_dismiss on public.learn_user_recommendations
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy learn_user_recommendations_service_all on public.learn_user_recommendations
  for all using (true) with check (true);


create table public.learn_lead_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  tier int not null check (tier in (1,2,3)),
  status text not null default 'new' check (status in ('new','in_progress','contacted','converted','closed_lost')),
  market_id uuid references public.markets(id) on delete set null,
  trade text,
  submitted_data jsonb not null default '{}'::jsonb,
  qualifying_answers jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users(id) on delete set null,
  conversion_value_cents bigint,
  created_at timestamptz not null default now(),
  contacted_at timestamptz,
  converted_at timestamptz
);

create index learn_lead_captures_user on public.learn_lead_captures (user_id, created_at desc) where user_id is not null;
create index learn_lead_captures_status on public.learn_lead_captures (status, created_at desc);
create index learn_lead_captures_assigned on public.learn_lead_captures (assigned_to, status) where assigned_to is not null;
create index learn_lead_captures_tier on public.learn_lead_captures (tier, created_at desc);

alter table public.learn_lead_captures enable row level security;

create policy learn_lead_captures_own_select on public.learn_lead_captures
  for select using ((select auth.uid()) = user_id);

create policy learn_lead_captures_admin_all on public.learn_lead_captures
  for all using (is_admin()) with check (is_admin());

create policy learn_lead_captures_assigned_select on public.learn_lead_captures
  for select using ((select auth.uid()) = assigned_to);

create policy learn_lead_captures_service_all on public.learn_lead_captures
  for all using (true) with check (true);


create table public.learn_personalization_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  condition jsonb not null,
  recommendation_logic jsonb not null,
  active boolean not null default true,
  priority int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learn_personalization_rules_active on public.learn_personalization_rules (priority asc) where active = true;

create trigger learn_personalization_rules_updated_at
  before update on public.learn_personalization_rules
  for each row execute function public.update_updated_at();

alter table public.learn_personalization_rules enable row level security;

create policy learn_personalization_rules_admin_all on public.learn_personalization_rules
  for all using (is_admin()) with check (is_admin());

create policy learn_personalization_rules_service_all on public.learn_personalization_rules
  for all using (true) with check (true);


create table public.learn_audit_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('gbp','web','bbb','insurance')),
  raw_data jsonb not null default '{}'::jsonb,
  score numeric,
  recommendations jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create index learn_audit_results_user on public.learn_audit_results (user_id, generated_at desc);
create index learn_audit_results_type on public.learn_audit_results (user_id, type, generated_at desc);

alter table public.learn_audit_results enable row level security;

create policy learn_audit_results_own_select on public.learn_audit_results
  for select using ((select auth.uid()) = user_id);

create policy learn_audit_results_service_all on public.learn_audit_results
  for all using (true) with check (true);

comment on table public.learn_articles is 'Knowledge Center CMS — articles, calculators, templates, tools.';
comment on table public.learn_modules is 'Module groupings that bundle related articles.';
comment on table public.learn_user_progress is 'Per-user article view + completion tracking.';
comment on table public.learn_user_recommendations is 'Personalized recommendations surfaced to a user.';
comment on table public.learn_lead_captures is 'Tiered lead capture (free / audit / strategist call).';
comment on table public.learn_personalization_rules is 'Admin-managed rules for surfacing content.';
comment on table public.learn_audit_results is 'Automated business audit outputs (GBP, web, BBB, insurance).';
