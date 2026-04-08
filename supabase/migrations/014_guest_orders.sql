-- 014_guest_orders.sql
--
-- Adds first-class guest checkout support to the orders table. Before this
-- migration, guests were "guests" only at the UI level — under the hood the
-- server provisioned a real auth.users row for every guest checkout, leading
-- to a graveyard of dormant accounts.
--
-- After this migration, an order can have EITHER a customer_id (signed-in
-- user) OR a guest_* block (anonymous checkout, no auth row required).
--
-- A CHECK constraint enforces that exactly one of those identity types is
-- present. This is the architecturally correct shape: a checkout that does
-- not create an auth.users row.
--
-- Idempotent: safe to re-run.

begin;

-- 1. Make customer_id nullable so guest orders are valid
alter table public.orders alter column customer_id drop not null;

-- 2. Add guest identity columns
alter table public.orders
  add column if not exists guest_email      text,
  add column if not exists guest_first_name text,
  add column if not exists guest_last_name  text,
  add column if not exists guest_phone      text;

-- 3. Identity check: exactly one of (customer_id) or (guest_email + names)
--    must be present. Drop existing check first if re-running.
alter table public.orders drop constraint if exists orders_customer_or_guest_check;
alter table public.orders add constraint orders_customer_or_guest_check check (
  (customer_id is not null and guest_email is null)
  or
  (customer_id is null and guest_email is not null and guest_first_name is not null and guest_last_name is not null)
);

-- 4. Lookup index on guest email so we can find a guest's order history if
--    they later sign up with the same address.
create index if not exists orders_guest_email_idx on public.orders (lower(guest_email)) where guest_email is not null;

-- 5. Reload PostgREST so the new columns are immediately visible to the API.
notify pgrst, 'reload schema';

commit;
