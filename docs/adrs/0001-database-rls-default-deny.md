# ADR 0001 — Database RLS default-deny

**Status:** Accepted · **Date:** 2026-05-15

## Context
Multi-role marketplace (customer, supplier, gc, driver, admin) with sensitive financial, location, and identity data. Application-layer authorization alone is fragile; one missing check can leak entire tables.

## Decision
Enable RLS on every public table. Default deny. Service role (`service_role`) bypasses RLS and is used only server-side. Each policy targets a specific role with explicit `TO role_name` and explicit `USING` predicates.

## Consequences
- Higher safety floor: even if an API route forgets to filter, RLS denies access
- Every new table requires explicit RLS policy as part of migration
- Slightly higher complexity in Supabase MCP migrations (must be tested with both service_role and role-scoped clients)
- Performance overhead negligible at our scale; planner uses policy predicates as index filters

## Alternatives considered
- App-layer authorization only — rejected; one-line bug exposes data
- Per-tenant schemas — rejected; operational overhead doesn't match value at our scale
