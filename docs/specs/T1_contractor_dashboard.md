# T1: Contractor Dashboard

> **Retroactive spec.** Reverse-engineered from shipped code; format per `docs/specs/TEMPLATE.md`.

## Purpose

General contractors (role=`gc`) sign in and manage their aggregate-material purchasing from a single dashboard at `/dashboard/contractor`. They browse the marketplace, place new orders via a 5-step wizard, track active dispatches, manage team, handle billing, and view trust signals on suppliers.

## Tables touched

All tables live in the base schema (`supabase/migrations/001_schema.sql`) and evolved via 005–018. No dedicated migration introduced the contractor surface — it reuses core commerce primitives.

- `profiles` (existing) — role enum includes `gc`
- `markets` (existing) — 15+ city markets feed the marketplace
- `suppliers` (existing) — listed in the order wizard step 3
- `orders` (existing, modified by `014_guest_orders.sql`) — `orders_customer_or_guest_check` constraint added for guest orders

## API surface

All routes under `src/app/api/contractor/`. Auth is Supabase SSR cookie; RLS enforces org-scoping inside Postgres.

- `GET /api/contractor/command-stats` — aggregate KPIs for the dashboard header
- `GET /api/contractor/drafts` — list this contractor's order drafts
- `POST /api/contractor/drafts` — create new draft
- `GET/PATCH/DELETE /api/contractor/drafts/[id]` — draft lifecycle
- `POST /api/contractor/orders` — commit a draft into a real order
- `POST /api/contractor/orders/suppliers/match` — match quantity/material/radius → supplier candidates

## UI changes

All under `src/app/dashboard/contractor/`:

- `page.tsx` — landing / command center
- `layout.tsx`, `_shell/{Sidebar,TopBar,ContractorShell}.tsx` — dashboard chrome
- `projects/page.tsx`, `team/page.tsx`, `billing/page.tsx`, `marketplace/page.tsx`, `track/page.tsx`, `trust/page.tsx` — top-level sections
- `orders/new/page.tsx` — 5-step order wizard
- `orders/new/_wizard/{WizardStepper,WizardClient,Step1Material…Step5Review}.tsx` — wizard steps

## Acceptance criteria

- [ ] A user with `profiles.role='gc'` can reach `/dashboard/contractor` and see their own orders (RLS blocks other orgs').
- [ ] The 5-step wizard completes end-to-end: material → quantity → supplier → address → review.
- [ ] `POST /api/contractor/orders/suppliers/match` returns candidates scoped to the requested material and radius.
- [ ] Draft create/read/update/delete flow persists to the orders/drafts path without leaking drafts across users.

## Out of scope (not in T1)

- Dispatch SMS and driver coordination (T2)
- Payment processing (Stripe integration exists in deps but contractor-side flow not specified here)
- Dedicated `projects` / `team_members` / `order_drafts` tables as standalone entities — if/when introduced, requires its own spec and migration
- Contractor-initiated team invites / org management UI

## Dependencies

- `profiles` table with `role` enum including `gc`
- `markets`, `suppliers`, `orders` tables (001_schema.sql)
- Supabase SSR auth cookie
- `update_updated_at()` trigger (project-wide helper)

## Estimated effort

L — already shipped. Historical record; any behavioral change should open a new spec that amends this one.
