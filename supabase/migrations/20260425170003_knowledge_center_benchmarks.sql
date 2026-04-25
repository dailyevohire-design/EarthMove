-- ============================================================================
-- Knowledge Center: Benchmarking Engine ("How Do I Compare?")
-- Tables: benchmark_metrics, benchmark_cohort_stats,
--         user_benchmark_scores, benchmark_recommendations
-- Phase 1: industry-published benchmarks only (CFMA, ATRI, NAPA, NUCA).
-- Phase 2 (post-500 users): k-anonymity n>=10 internal aggregation.
-- ============================================================================

create table public.benchmark_metrics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  trade text not null,
  metric_name text not null,
  display_name text not null,
  unit text not null,
  formula_jsonb jsonb not null default '{}'::jsonb,
  source text not null check (source in (
    'CFMA','ATRI','NAPA','NUCA','BLS','IRMI','IBISWorld','EARTHMOVE'
  )),
  source_year int,
  is_better_high boolean not null default true,
  description text,
  one_number_that_matters boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index benchmark_metrics_trade_metric on public.benchmark_metrics (trade, metric_name);
create index benchmark_metrics_active on public.benchmark_metrics (trade, active) where active = true;

create trigger benchmark_metrics_updated_at
  before update on public.benchmark_metrics
  for each row execute function public.update_updated_at();

alter table public.benchmark_metrics enable row level security;

create policy benchmark_metrics_public_read on public.benchmark_metrics
  for select using (active = true);

create policy benchmark_metrics_admin_all on public.benchmark_metrics
  for all using (is_admin()) with check (is_admin());

create policy benchmark_metrics_service_all on public.benchmark_metrics
  for all using (true) with check (true);


create table public.benchmark_cohort_stats (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references public.benchmark_metrics(id) on delete cascade,
  cohort_filters jsonb not null default '{}'::jsonb,
  n int not null check (n >= 0),
  p10 numeric, p25 numeric, p50 numeric, p75 numeric, p90 numeric,
  mean numeric, std numeric,
  source_kind text not null check (source_kind in ('industry','proprietary','blended')),
  computed_at timestamptz not null default now()
);

create index benchmark_cohort_stats_metric on public.benchmark_cohort_stats (metric_id, computed_at desc);
create index benchmark_cohort_stats_filters on public.benchmark_cohort_stats using gin (cohort_filters);

alter table public.benchmark_cohort_stats enable row level security;

-- k-anonymity: cohorts with n<10 are not publicly readable unless industry-sourced
create policy benchmark_cohort_stats_public_read on public.benchmark_cohort_stats
  for select using (n >= 10 or source_kind = 'industry');

create policy benchmark_cohort_stats_admin_all on public.benchmark_cohort_stats
  for all using (is_admin()) with check (is_admin());

create policy benchmark_cohort_stats_service_all on public.benchmark_cohort_stats
  for all using (true) with check (true);


create table public.user_benchmark_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_id uuid not null references public.benchmark_metrics(id) on delete cascade,
  value numeric not null,
  percentile numeric check (percentile is null or (percentile >= 0 and percentile <= 100)),
  cohort_id uuid references public.benchmark_cohort_stats(id) on delete set null,
  contributed_to_aggregate boolean not null default false,
  computed_at timestamptz not null default now()
);

create index user_benchmark_scores_user_metric on public.user_benchmark_scores (user_id, metric_id, computed_at desc);
create index user_benchmark_scores_metric_contributed on public.user_benchmark_scores (metric_id, contributed_to_aggregate) where contributed_to_aggregate = true;

alter table public.user_benchmark_scores enable row level security;

create policy user_benchmark_scores_own on public.user_benchmark_scores
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy user_benchmark_scores_admin_select on public.user_benchmark_scores
  for select using (is_admin());

create policy user_benchmark_scores_service_all on public.user_benchmark_scores
  for all using (true) with check (true);


create table public.benchmark_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_id uuid not null references public.benchmark_metrics(id) on delete cascade,
  recommendation_text text not null,
  estimated_dollar_impact numeric,
  related_article_slugs text[] not null default '{}',
  ai_advisor_intent text check (ai_advisor_intent in (
    'cashflow','growth','pricing','equipment','contract','gc_work','diagnostic','other'
  )),
  status text not null default 'open' check (status in ('open','dismissed','in_progress','completed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index benchmark_recommendations_user_open on public.benchmark_recommendations (user_id, created_at desc) where status = 'open';
create index benchmark_recommendations_metric on public.benchmark_recommendations (metric_id);

alter table public.benchmark_recommendations enable row level security;

create policy benchmark_recommendations_own on public.benchmark_recommendations
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy benchmark_recommendations_admin_select on public.benchmark_recommendations
  for select using (is_admin());

create policy benchmark_recommendations_service_all on public.benchmark_recommendations
  for all using (true) with check (true);

comment on table public.benchmark_metrics is 'KPI definitions per trade with source attribution.';
comment on table public.benchmark_cohort_stats is 'Percentile snapshots per cohort with k-anonymity gating.';
comment on table public.user_benchmark_scores is 'Per-user metric values vs cohort percentile.';
comment on table public.benchmark_recommendations is 'Recs triggered by below-median metrics.';
