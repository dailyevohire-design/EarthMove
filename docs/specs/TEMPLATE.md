# <TIER>: <Feature name>

## Purpose

One paragraph. Who uses this, what problem it solves, why now. Plain prose — no bullets.

## Tables touched

List every table this feature creates or modifies. For each, mark `new` or `modified` and note which columns.

- `example_table` (new) — 8 columns, 3 RLS policies
- `orders` (modified) — adds `foo_id`, `foo_at` columns

## API surface

List every route. For each: path, methods, auth gate, key behaviors.

- `POST /api/example` — authenticated contractor; creates X; returns 201 with `{ id }`; validates body with Zod

## UI changes

List every page and component touched.

- `src/app/(dashboard)/example/page.tsx` (new) — shows X
- `src/components/example/Foo.tsx` (new) — reusable in Y

## Acceptance criteria

Testable bullets. A reviewer should be able to verify each one by hand or with a test.

- [ ] Contractor with role=gc can see their org's records; RLS blocks other orgs
- [ ] Empty body returns 400, not 500
- [ ] Destructive action requires confirmation modal

## Out of scope

Explicit list of what this feature does **not** include. Anything not in this list is in scope and will be built.

- Feature X (planned T3)
- Feature Y (not planned)

## Dependencies

Other specs or shipped features this depends on.

- Depends on `T1_contractor_dashboard` (projects table, role=gc)
- Depends on `update_updated_at()` trigger

## Estimated effort

S (half day), M (1–2 days), or L (3+ days).
