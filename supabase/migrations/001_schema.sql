-- ============================================================
-- AGGREGATEMARKET — Production Schema v3 (Final)
-- Run in Supabase SQL Editor.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('customer', 'supplier', 'admin');
create type order_status as enum (
  'pending_payment', 'payment_failed', 'confirmed',
  'dispatched', 'delivered', 'cancelled', 'refunded'
);
create type dispatch_status as enum (
  'queued', 'assigned', 'confirmed', 'en_route', 'delivered', 'failed'
);
create type delivery_type as enum ('asap', 'scheduled');
create type fulfillment_method as enum ('delivery', 'pickup');
create type material_unit as enum ('ton', 'cubic_yard', 'load', 'each');
create type promotion_type as enum ('percentage', 'flat_amount', 'price_override');
create type supplier_status as enum ('pending', 'active', 'inactive', 'suspended');
create type import_status as enum ('pending_review', 'approved', 'rejected', 'imported');
create type price_display_mode as enum ('exact', 'custom');

-- ============================================================
-- MARKETS
-- ============================================================

create table markets (
  id                            uuid primary key default gen_random_uuid(),
  name                          text not null,
  slug                          text not null unique,
  state                         text not null,
  is_active                     boolean not null default false,
  center_lat                    numeric(10,7),
  center_lng                    numeric(10,7),
  default_delivery_radius_miles numeric(5,2) default 50,
  timezone                      text not null default 'America/Chicago',
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

insert into markets (name, slug, state, is_active, center_lat, center_lng, timezone)
values ('Dallas-Fort Worth', 'dallas-fort-worth', 'TX', true, 32.7767, -96.7970, 'America/Chicago');

-- ============================================================
-- MATERIAL CATEGORIES
-- ============================================================

create table material_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  icon_name   text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into material_categories (name, slug, icon_name, sort_order) values
  ('Fill',      'fill',      'mountain',   1),
  ('Sand',      'sand',      'waves',      2),
  ('Gravel',    'gravel',    'circle-dot', 3),
  ('Aggregate', 'aggregate', 'road',       4),
  ('Rock',      'rock',      'gem',        5),
  ('Recycled',  'recycled',  'hammer',     6),
  ('Specialty', 'specialty', 'star',       7);

-- ============================================================
-- CANONICAL MATERIAL CATALOG
-- ============================================================

create table material_catalog (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references material_categories(id),
  name          text not null unique,
  slug          text not null unique,
  description   text,
  default_unit  material_unit not null default 'ton',
  icon_name     text,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

do $$
declare
  fill_id uuid; sand_id uuid; gravel_id uuid;
  agg_id uuid; rock_id uuid; rec_id uuid; spec_id uuid;
begin
  select id into fill_id  from material_categories where slug = 'fill';
  select id into sand_id  from material_categories where slug = 'sand';
  select id into gravel_id from material_categories where slug = 'gravel';
  select id into agg_id   from material_categories where slug = 'aggregate';
  select id into rock_id  from material_categories where slug = 'rock';
  select id into rec_id   from material_categories where slug = 'recycled';
  select id into spec_id  from material_categories where slug = 'specialty';

  insert into material_catalog (category_id, name, slug, default_unit, sort_order) values
    (fill_id,   'Fill Dirt',           'fill-dirt',          'ton',        1),
    (fill_id,   'Select Fill',         'select-fill',        'ton',        2),
    (fill_id,   'Topsoil',             'topsoil',            'cubic_yard', 3),
    (sand_id,   'Concrete Sand',       'concrete-sand',      'ton',        4),
    (sand_id,   'Masonry Sand',        'masonry-sand',       'ton',        5),
    (sand_id,   'Utility Sand',        'utility-sand',       'ton',        6),
    (gravel_id, 'Pea Gravel',          'pea-gravel',         'ton',        7),
    (gravel_id, 'Base Gravel #57',     'base-gravel-57',     'ton',        8),
    (agg_id,    'Flex Base (Grade 1)', 'flex-base',          'ton',        9),
    (agg_id,    'Road Base',           'road-base',          'ton',        10),
    (rock_id,   'Washed River Rock',   'washed-river-rock',  'ton',        11),
    (rock_id,   'Limestone',           'limestone',          'ton',        12),
    (rock_id,   'Rip Rap',             'rip-rap',            'ton',        13),
    (rec_id,    'Crushed Concrete',    'crushed-concrete',   'ton',        14),
    (spec_id,   'Decomposed Granite',  'decomposed-granite', 'ton',        15);
end;
$$;

-- ============================================================
-- PROFILES
-- ============================================================

create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  role                user_role not null default 'customer',
  first_name          text,
  last_name           text,
  company_name        text,
  phone               text,
  stripe_customer_id  text,
  default_market_id   uuid references markets(id),
  supplier_id         uuid,
  portal_enabled      boolean not null default false,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- SUPPLIERS
-- ============================================================

create table suppliers (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text unique,
  status                supplier_status not null default 'pending',
  primary_contact_name  text,
  primary_contact_phone text,
  primary_contact_email text,
  website               text,
  portal_enabled        boolean not null default false,
  internal_notes        text,
  data_source           text not null default 'manual',
  stripe_account_id     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table profiles
  add constraint profiles_supplier_fkey
  foreign key (supplier_id) references suppliers(id) on delete set null;

-- ============================================================
-- SUPPLY YARDS
-- ============================================================

create table supply_yards (
  id                    uuid primary key default gen_random_uuid(),
  supplier_id           uuid not null references suppliers(id) on delete cascade,
  market_id             uuid not null references markets(id),
  name                  text not null,
  address_line_1        text,
  city                  text,
  state                 text,
  zip                   text,
  lat                   numeric(10,7),
  lng                   numeric(10,7),
  phone                 text,
  hours_of_operation    jsonb not null default '{}',
  delivery_radius_miles numeric(5,2),
  delivery_enabled      boolean not null default true,
  pickup_enabled        boolean not null default false,
  is_active             boolean not null default true,
  internal_notes        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_yards_supplier on supply_yards(supplier_id, is_active);
create index idx_yards_market   on supply_yards(market_id, is_active);

-- ============================================================
-- SUPPLIER OFFERINGS
-- ============================================================

create table supplier_offerings (
  id                      uuid primary key default gen_random_uuid(),
  supply_yard_id          uuid not null references supply_yards(id) on delete cascade,
  material_catalog_id     uuid not null references material_catalog(id),
  supplier_material_name  text,
  supplier_description    text,
  unit                    material_unit not null default 'ton',
  price_per_unit          numeric(10,2) not null check (price_per_unit > 0),
  minimum_order_quantity  numeric(8,2) not null default 1 check (minimum_order_quantity > 0),
  typical_load_size       numeric(8,2),
  load_size_label         text,
  is_available            boolean not null default true,
  available_for_delivery  boolean not null default true,
  available_for_pickup    boolean not null default false,
  stock_notes             text,
  delivery_fee_base       numeric(10,2) check (delivery_fee_base >= 0),
  delivery_fee_per_mile   numeric(6,2)  check (delivery_fee_per_mile >= 0),
  max_delivery_miles      numeric(5,2)  check (max_delivery_miles > 0),
  availability_confidence int not null default 75
    check (availability_confidence between 0 and 100),
  last_verified_at        timestamptz,
  daily_capacity_estimate numeric(8,2),
  is_public               boolean not null default false,
  image_url               text,
  is_featured             boolean not null default false,
  sort_order              int not null default 0,
  internal_notes          text,
  data_source             text not null default 'manual',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(supply_yard_id, material_catalog_id)
);

create index idx_offerings_yard     on supplier_offerings(supply_yard_id, is_available);
create index idx_offerings_material on supplier_offerings(material_catalog_id, is_available);
create index idx_offerings_public   on supplier_offerings(is_public, is_available);

-- ============================================================
-- SUPPLIER PERFORMANCE
-- ============================================================

create table supplier_performance (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         uuid not null unique references suppliers(id) on delete cascade,
  on_time_rate        numeric(5,2) not null default 80.0
    check (on_time_rate between 0 and 100),
  cancellation_rate   numeric(5,2) not null default 5.0
    check (cancellation_rate between 0 and 100),
  avg_response_hours  numeric(6,2) not null default 4.0,
  total_orders        int not null default 0,
  completed_orders    int not null default 0,
  cancelled_orders    int not null default 0,
  performance_score   int not null default 75
    check (performance_score between 0 and 100),
  is_bootstrapped     boolean not null default true,
  last_calculated_at  timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create or replace function create_supplier_performance()
returns trigger language plpgsql as $$
begin
  insert into supplier_performance (supplier_id) values (new.id);
  return new;
end;
$$;

create trigger on_supplier_created
  after insert on suppliers
  for each row execute procedure create_supplier_performance();

-- ============================================================
-- MARKET MATERIALS
-- ============================================================

create table market_materials (
  id                    uuid primary key default gen_random_uuid(),
  market_id             uuid not null references markets(id),
  material_catalog_id   uuid not null references material_catalog(id),
  display_name          text,
  display_description   text,
  display_image_url     text,
  is_visible            boolean not null default true,
  is_featured           boolean not null default false,
  sort_order            int not null default 0,
  price_display_mode    price_display_mode not null default 'exact',
  custom_display_price  numeric(10,2) check (custom_display_price > 0),
  is_available          boolean not null default true,
  unavailable_reason    text,
  admin_notes           text,
  last_reviewed_at      timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(market_id, material_catalog_id),
  constraint custom_price_required check (
    price_display_mode != 'custom' or custom_display_price is not null
  )
);

create index idx_mm_market   on market_materials(market_id, is_visible, is_available);
create index idx_mm_featured on market_materials(market_id, is_featured, is_visible);
create index idx_mm_catalog  on market_materials(material_catalog_id);

-- ============================================================
-- MARKET SUPPLY POOL
-- ============================================================

create table market_supply_pool (
  id                    uuid primary key default gen_random_uuid(),
  market_material_id    uuid not null references market_materials(id) on delete cascade,
  offering_id           uuid not null references supplier_offerings(id) on delete cascade,
  is_active             boolean not null default true,
  is_preferred          boolean not null default false,
  is_fallback           boolean not null default false,
  composite_score       int not null default 75 check (composite_score between 0 and 100),
  price_score           int default 75 check (price_score between 0 and 100),
  distance_score        int default 75 check (distance_score between 0 and 100),
  reliability_score     int default 75 check (reliability_score between 0 and 100),
  availability_score    int default 75 check (availability_score between 0 and 100),
  weight_price          numeric(3,2) not null default 0.35,
  weight_distance       numeric(3,2) not null default 0.25,
  weight_reliability    numeric(3,2) not null default 0.25,
  weight_availability   numeric(3,2) not null default 0.15,
  scores_calculated_at  timestamptz,
  admin_override_score  int check (admin_override_score between 0 and 100),
  admin_notes           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(market_material_id, offering_id),
  constraint weights_sum_to_one check (
    abs((weight_price + weight_distance + weight_reliability + weight_availability) - 1.0) < 0.01
  )
);

create index idx_pool_mm       on market_supply_pool(market_material_id, is_active, composite_score desc);
create index idx_pool_offering on market_supply_pool(offering_id, is_active);
create index idx_pool_pref     on market_supply_pool(market_material_id, is_preferred) where is_preferred = true;

-- Pool validation trigger: offering must match market + material of market_material
create or replace function validate_pool_entry()
returns trigger language plpgsql as $$
declare
  v_offering_market_id   uuid;
  v_offering_material_id uuid;
  v_mm_market_id         uuid;
  v_mm_material_id       uuid;
begin
  select sy.market_id, so.material_catalog_id
  into   v_offering_market_id, v_offering_material_id
  from   supplier_offerings so
  join   supply_yards sy on sy.id = so.supply_yard_id
  where  so.id = new.offering_id;

  select mm.market_id, mm.material_catalog_id
  into   v_mm_market_id, v_mm_material_id
  from   market_materials mm
  where  mm.id = new.market_material_id;

  if v_offering_market_id is null or v_mm_market_id is null then
    raise exception 'Pool validation: could not resolve market or material for this entry.';
  end if;

  if v_offering_market_id != v_mm_market_id then
    raise exception
      'Pool entry invalid: offering yard is in market % but market_material is in market %.',
      v_offering_market_id, v_mm_market_id;
  end if;

  if v_offering_material_id != v_mm_material_id then
    raise exception
      'Pool entry invalid: offering material (%) does not match market_material material (%).',
      v_offering_material_id, v_mm_material_id;
  end if;

  return new;
end;
$$;

create trigger trg_validate_pool_entry
  before insert or update on market_supply_pool
  for each row execute function validate_pool_entry();

-- ============================================================
-- PROMOTIONS
-- ============================================================

create table promotions (
  id                  uuid primary key default gen_random_uuid(),
  created_by          uuid references profiles(id),
  market_id           uuid references markets(id),
  supplier_id         uuid references suppliers(id),
  offering_id         uuid references supplier_offerings(id),
  material_catalog_id uuid references material_catalog(id),
  title               text not null,
  description         text,
  badge_label         text,
  is_deal_of_day      boolean not null default false,
  promotion_type      promotion_type not null,
  discount_value      numeric(10,2) check (discount_value > 0),
  override_price      numeric(10,2) check (override_price > 0),
  min_order_amount    numeric(10,2) check (min_order_amount > 0),
  max_uses            int check (max_uses > 0),
  current_uses        int not null default 0,
  starts_at           timestamptz not null,
  ends_at             timestamptz,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint promotion_has_scope check (
    market_id is not null or supplier_id is not null
    or offering_id is not null or material_catalog_id is not null
  ),
  constraint ends_after_starts check (ends_at is null or ends_at > starts_at)
);

create index idx_promos_active   on promotions(is_active, starts_at, ends_at);
create index idx_promos_offering on promotions(offering_id, is_active);
create index idx_promos_material on promotions(material_catalog_id, is_active);
create index idx_promos_market   on promotions(market_id, is_active);
create index idx_promos_deal     on promotions(is_deal_of_day, is_active);

-- ============================================================
-- PRICING RULES
-- ============================================================

create table pricing_rules (
  id              uuid primary key default gen_random_uuid(),
  market_id       uuid references markets(id),
  rule_type       text not null,
  config          jsonb not null,
  is_active       boolean not null default true,
  effective_from  timestamptz not null default now(),
  effective_to    timestamptz,
  created_at      timestamptz not null default now()
);

do $$
declare v_market_id uuid;
begin
  select id into v_market_id from markets where slug = 'dallas-fort-worth';
  insert into pricing_rules (market_id, rule_type, config) values
    (v_market_id, 'platform_fee',   '{"mode":"percentage","value":9.0}'::jsonb),
    (v_market_id, 'delivery_tier',  '{"base_fee":95,"free_miles":10,"per_mile":3.50}'::jsonb),
    (v_market_id, 'min_order_value','{"amount":100}'::jsonb);
end;
$$;

-- ============================================================
-- ADDRESSES
-- ============================================================

create table addresses (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid references profiles(id) on delete cascade,
  label           text,
  street_line_1   text not null,
  street_line_2   text,
  city            text not null,
  state           text not null,
  zip             text not null,
  lat             numeric(10,7),
  lng             numeric(10,7),
  market_id       uuid references markets(id),
  delivery_notes  text,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- ORDERS
-- ============================================================

create table orders (
  id                          uuid primary key default gen_random_uuid(),

  -- Parties
  customer_id                 uuid not null references profiles(id),
  market_id                   uuid not null references markets(id),

  -- Resolved fulfillment at checkout (immutable after creation)
  market_material_id          uuid references market_materials(id),
  resolved_offering_id        uuid references supplier_offerings(id),
  supply_yard_id              uuid references supply_yards(id),
  supplier_id                 uuid references suppliers(id),
  material_catalog_id         uuid references material_catalog(id),

  -- Status
  status                      order_status not null default 'pending_payment',
  fulfillment_method          fulfillment_method not null default 'delivery',

  -- Immutable snapshots (captured at checkout, never updated)
  material_name_snapshot      text not null,
  supplier_name_snapshot      text not null,
  supply_yard_name_snapshot   text not null,
  quantity                    numeric(10,2) not null check (quantity > 0),
  unit                        material_unit not null,

  -- Delivery
  delivery_type               delivery_type not null default 'asap',
  delivery_address_id         uuid references addresses(id) on delete set null,
  delivery_address_snapshot   jsonb,
  requested_delivery_date     date,
  requested_delivery_window   text,
  delivery_notes              text,

  -- Pricing snapshot (immutable after payment)
  price_per_unit              numeric(10,2) not null check (price_per_unit > 0),
  subtotal                    numeric(12,2) not null check (subtotal > 0),
  delivery_fee                numeric(10,2) not null default 0 check (delivery_fee >= 0),
  platform_fee                numeric(10,2) not null default 0 check (platform_fee >= 0),
  promotion_discount          numeric(10,2) not null default 0 check (promotion_discount >= 0),
  tax_amount                  numeric(10,2) not null default 0 check (tax_amount >= 0),
  total_amount                numeric(12,2) not null check (total_amount > 0),
  line_items_snapshot         jsonb not null default '[]',
  promotion_id                uuid references promotions(id),

  -- Payment
  stripe_payment_intent_id    text unique,
  stripe_checkout_session_id  text unique,
  paid_at                     timestamptz,

  -- Internal review flag (invisible to customers)
  needs_review                boolean not null default false,
  review_reason               text,

  -- Fulfillment
  dispatched_at               timestamptz,
  delivered_at                timestamptz,
  dispatcher_id               uuid references profiles(id),
  fulfillment_notes           text,
  internal_notes              text,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint scheduled_requires_date check (
    delivery_type != 'scheduled' or requested_delivery_date is not null
  )
);

create index idx_orders_customer      on orders(customer_id, created_at desc);
create index idx_orders_status        on orders(status, created_at desc);
create index idx_orders_market        on orders(market_id, status);
create index idx_orders_supplier      on orders(supplier_id, status);
create index idx_orders_delivery_date on orders(requested_delivery_date, status);
create index idx_orders_stripe        on orders(stripe_payment_intent_id);
create index idx_orders_needs_review  on orders(needs_review) where needs_review = true;

-- ============================================================
-- DISPATCH QUEUE
-- ============================================================

create table dispatch_queue (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null unique references orders(id),

  -- Original = resolved at checkout (snapshot from order)
  original_offering_id    uuid references supplier_offerings(id),
  original_yard_id        uuid references supply_yards(id),
  original_supplier_id    uuid references suppliers(id),

  -- Assigned = what actually fulfills (may differ if admin overrides)
  assigned_offering_id    uuid references supplier_offerings(id),
  assigned_yard_id        uuid references supply_yards(id),
  assigned_supplier_id    uuid references suppliers(id),
  was_overridden          boolean not null default false,

  -- Status
  status                  dispatch_status not null default 'queued',
  assigned_at             timestamptz,
  supplier_confirmed_at   timestamptz,
  en_route_at             timestamptz,
  delivered_at            timestamptz,
  failed_at               timestamptz,
  failure_reason          text,

  -- Scheduling
  target_delivery_date    date,
  target_window           text,
  estimated_arrival       timestamptz,

  -- Operations
  dispatcher_id           uuid references profiles(id),
  driver_name             text,
  driver_phone            text,
  truck_info              text,
  ops_notes               text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_dispatch_status on dispatch_queue(status, created_at);
create index idx_dispatch_order  on dispatch_queue(order_id);
create index idx_dispatch_yard   on dispatch_queue(assigned_yard_id, status);

-- ============================================================
-- IMPORT SYSTEM
-- ============================================================

create table import_batches (
  id              uuid primary key default gen_random_uuid(),
  source          text not null default 'manual',
  source_url      text,
  source_name     text,
  market_id       uuid references markets(id),
  status          import_status not null default 'pending_review',
  total_records   int not null default 0,
  imported_count  int not null default 0,
  rejected_count  int not null default 0,
  reviewed_by     uuid references profiles(id),
  reviewed_at     timestamptz,
  admin_notes     text,
  raw_payload     jsonb,
  created_at      timestamptz not null default now()
);

create table import_records (
  id                    uuid primary key default gen_random_uuid(),
  batch_id              uuid not null references import_batches(id) on delete cascade,
  raw_supplier_name     text,
  raw_yard_address      text,
  raw_yard_city         text,
  raw_yard_state        text,
  raw_yard_zip          text,
  raw_yard_phone        text,
  raw_material_name     text,
  raw_price             text,
  raw_unit              text,
  raw_min_order         text,
  raw_notes             text,
  raw_data              jsonb,
  status                import_status not null default 'pending_review',
  rejection_reason      text,
  resolved_supplier_id  uuid references suppliers(id),
  resolved_yard_id      uuid references supply_yards(id),
  resolved_catalog_id   uuid references material_catalog(id),
  resolved_offering_id  uuid references supplier_offerings(id),
  parsed_price          numeric(10,2) check (parsed_price > 0),
  parsed_unit           material_unit,
  parsed_min_quantity   numeric(8,2)  check (parsed_min_quantity > 0),
  reviewed_by           uuid references profiles(id),
  reviewed_at           timestamptz,
  admin_notes           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_import_batch   on import_records(batch_id, status);
create index idx_import_status  on import_records(status);
create index idx_import_supp    on import_records using gin (raw_supplier_name gin_trgm_ops);
create index idx_import_mat     on import_records using gin (raw_material_name gin_trgm_ops);

-- ============================================================
-- AUDIT LOG
-- ============================================================

create table audit_events (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id),
  actor_role  user_role,
  event_type  text not null,
  entity_type text not null,
  entity_id   uuid,
  payload     jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index idx_audit_actor  on audit_events(actor_id, created_at desc);
create index idx_audit_entity on audit_events(entity_type, entity_id, created_at desc);
create index idx_audit_type   on audit_events(event_type, created_at desc);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger set_ts before update on profiles             for each row execute function update_updated_at();
create trigger set_ts before update on markets              for each row execute function update_updated_at();
create trigger set_ts before update on suppliers            for each row execute function update_updated_at();
create trigger set_ts before update on supply_yards         for each row execute function update_updated_at();
create trigger set_ts before update on supplier_offerings   for each row execute function update_updated_at();
create trigger set_ts before update on supplier_performance for each row execute function update_updated_at();
create trigger set_ts before update on market_materials     for each row execute function update_updated_at();
create trigger set_ts before update on market_supply_pool   for each row execute function update_updated_at();
create trigger set_ts before update on promotions           for each row execute function update_updated_at();
create trigger set_ts before update on orders               for each row execute function update_updated_at();
create trigger set_ts before update on dispatch_queue       for each row execute function update_updated_at();
create trigger set_ts before update on import_records       for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table markets             enable row level security;
alter table material_categories enable row level security;
alter table material_catalog    enable row level security;
alter table profiles            enable row level security;
alter table suppliers           enable row level security;
alter table supply_yards        enable row level security;
alter table supplier_offerings  enable row level security;
alter table supplier_performance enable row level security;
alter table market_materials    enable row level security;
alter table market_supply_pool  enable row level security;
alter table addresses           enable row level security;
alter table orders              enable row level security;
alter table dispatch_queue      enable row level security;
alter table promotions          enable row level security;
alter table pricing_rules       enable row level security;
alter table import_batches      enable row level security;
alter table import_records      enable row level security;
alter table audit_events        enable row level security;

-- Helper: is admin
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- Helper: get caller's supplier_id
create or replace function my_supplier_id()
returns uuid language sql security definer stable as $$
  select supplier_id from profiles where id = auth.uid()
$$;

-- Markets
create policy "markets_public_read" on markets for select using (true);
create policy "markets_admin"       on markets for all    using (is_admin());

-- Categories + catalog: public read
create policy "cats_public_read"    on material_categories for select using (is_active = true);
create policy "cats_admin"          on material_categories for all    using (is_admin());
create policy "catalog_public_read" on material_catalog    for select using (is_active = true);
create policy "catalog_admin"       on material_catalog    for all    using (is_admin());

-- Market materials: public read visible + available
create policy "mm_public_read" on market_materials for select
  using (is_visible = true and is_available = true);
create policy "mm_admin" on market_materials for all using (is_admin());

-- Profiles
create policy "profiles_own_read"   on profiles for select using (auth.uid() = id);
create policy "profiles_own_update" on profiles for update using (auth.uid() = id);
create policy "profiles_own_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_admin"      on profiles for all    using (is_admin());

-- Suppliers
create policy "suppliers_admin"      on suppliers for all    using (is_admin());
create policy "suppliers_own_read"   on suppliers for select using (my_supplier_id() = id);

-- Supply yards
create policy "yards_admin"         on supply_yards for all    using (is_admin());
create policy "yards_supplier_read" on supply_yards for select
  using (supplier_id = my_supplier_id());

-- Supplier offerings
create policy "offerings_admin"         on supplier_offerings for all    using (is_admin());
create policy "offerings_supplier_read" on supplier_offerings for select
  using (exists (
    select 1 from supply_yards y
    where y.id = supply_yard_id and y.supplier_id = my_supplier_id()
  ));

-- Supplier performance
create policy "perf_admin"         on supplier_performance for all    using (is_admin());
create policy "perf_supplier_read" on supplier_performance for select
  using (supplier_id = my_supplier_id());

-- Pool: admin only
create policy "pool_admin" on market_supply_pool for all using (is_admin());

-- Addresses
create policy "addresses_own"   on addresses for all using (profile_id = auth.uid());
create policy "addresses_admin" on addresses for all using (is_admin());

-- Orders
create policy "orders_own_read"   on orders for select using (customer_id = auth.uid());
create policy "orders_own_insert" on orders for insert with check (customer_id = auth.uid());
create policy "orders_admin"      on orders for all    using (is_admin());
create policy "orders_supplier_read" on orders for select
  using (supplier_id = my_supplier_id());

-- Dispatch: admin only
create policy "dispatch_admin" on dispatch_queue for all using (is_admin());

-- Promotions: public read (active window), admin all
create policy "promos_public" on promotions for select
  using (is_active = true and starts_at <= now() and (ends_at is null or ends_at > now()));
create policy "promos_admin" on promotions for all using (is_admin());

-- Pricing rules: public read active
create policy "pricing_public" on pricing_rules for select using (is_active = true);
create policy "pricing_admin"  on pricing_rules for all   using (is_admin());

-- Import: admin only
create policy "import_batches_admin" on import_batches for all using (is_admin());
create policy "import_records_admin" on import_records for all using (is_admin());

-- Audit: admin read, system insert
create policy "audit_admin_read"   on audit_events for select using (is_admin());
create policy "audit_system_write" on audit_events for insert with check (true);
