-- ============================================================================
-- Knowledge Center: AI Advisor Layer ("Talk to Earthmove")
-- Tables: learn_conversations, learn_messages, learn_artifacts, learn_tool_calls
-- ============================================================================

create table public.learn_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent text not null check (intent in (
    'cashflow','growth','pricing','equipment','contract','gc_work','diagnostic','other'
  )),
  status text not null default 'active' check (status in (
    'active','completed','escalated','abandoned'
  )),
  market_id uuid references public.markets(id) on delete set null,
  trade text,
  summary text,
  total_tokens_in bigint not null default 0,
  total_tokens_out bigint not null default 0,
  total_cost_cents int not null default 0,
  escalated_to_call boolean not null default false,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  ended_at timestamptz
);

create index learn_conversations_user_active on public.learn_conversations (user_id, last_active_at desc);
create index learn_conversations_status on public.learn_conversations (status, last_active_at desc);
create index learn_conversations_escalated on public.learn_conversations (escalated_to_call, last_active_at desc) where escalated_to_call = true;

alter table public.learn_conversations enable row level security;

create policy learn_conversations_own on public.learn_conversations
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy learn_conversations_admin_select on public.learn_conversations
  for select using (is_admin());

create policy learn_conversations_service_all on public.learn_conversations
  for all using (true) with check (true);


create table public.learn_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.learn_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  model text check (model in (
    'claude-opus-4-7','claude-opus-4-6','claude-sonnet-4-6','claude-haiku-4-5-20251001'
  )),
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cost_cents int not null default 0,
  created_at timestamptz not null default now()
);

create index learn_messages_conversation on public.learn_messages (conversation_id, created_at);

alter table public.learn_messages enable row level security;

create policy learn_messages_own_select on public.learn_messages
  for select using (
    exists (
      select 1 from public.learn_conversations c
      where c.id = learn_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy learn_messages_admin_select on public.learn_messages
  for select using (is_admin());

create policy learn_messages_service_all on public.learn_messages
  for all using (true) with check (true);


create table public.learn_artifacts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.learn_conversations(id) on delete cascade,
  type text not null check (type in (
    'pdf_plan','contract_redline','pnl_analysis','calculator_url','cashflow_forecast','sales_playbook'
  )),
  storage_path text,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

create index learn_artifacts_conversation on public.learn_artifacts (conversation_id, generated_at desc);

alter table public.learn_artifacts enable row level security;

create policy learn_artifacts_own_select on public.learn_artifacts
  for select using (
    exists (
      select 1 from public.learn_conversations c
      where c.id = learn_artifacts.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy learn_artifacts_service_all on public.learn_artifacts
  for all using (true) with check (true);


create table public.learn_tool_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.learn_conversations(id) on delete cascade,
  message_id uuid references public.learn_messages(id) on delete set null,
  tool_name text not null,
  input_args jsonb not null default '{}'::jsonb,
  output jsonb,
  duration_ms int,
  error text,
  called_at timestamptz not null default now()
);

create index learn_tool_calls_conversation on public.learn_tool_calls (conversation_id, called_at);
create index learn_tool_calls_tool on public.learn_tool_calls (tool_name, called_at desc);

alter table public.learn_tool_calls enable row level security;

create policy learn_tool_calls_admin_select on public.learn_tool_calls
  for select using (is_admin());

create policy learn_tool_calls_service_all on public.learn_tool_calls
  for all using (true) with check (true);

comment on table public.learn_conversations is 'Multi-turn AI advisor sessions ("Talk to EarthMove").';
comment on table public.learn_messages is 'Individual conversation turns with token + cost ledger.';
comment on table public.learn_artifacts is 'Generated artifacts from advisor sessions (PDFs, redlines).';
comment on table public.learn_tool_calls is 'Audit trail of advisor tool invocations.';
