# Staging — Supabase Branching + Vercel Previews

## What this gives us

Every PR gets an isolated clone of the production database and a Vercel preview deployment wired to it. Migrations and code changes run against real schema and seed data before merging — no more "it worked in dev, broke in prod" surprises.

- Supabase branches the DB on PR open (snapshot of main at the moment of branch create)
- Vercel deploys the PR HEAD with env vars rewritten to point at the branch DB
- `staging-smoke.yml` waits for the preview URL, then runs `scripts/smoke-test.sh`
- On merge, the branch DB is destroyed by Supabase automatically

## One-time setup (Juan, in dashboards — not code)

1. **Supabase dashboard** → Project `gaawvpzzmotimblyesfp` → Branching → **Enable**
2. **Vercel dashboard** → `aggregatemarket` → Integrations → **Supabase** → Connect
   - This auto-populates `SUPABASE_BRANCH_URL`, `SUPABASE_BRANCH_ANON_KEY`, `SUPABASE_BRANCH_SERVICE_ROLE_KEY` in the GitHub Actions secrets for this repo
3. Verify secrets exist under GitHub repo → Settings → Secrets and variables → Actions

## PR flow post-setup

```
open PR → Supabase clones DB → Vercel deploys preview → staging-smoke runs 5 checks → merge if green → branch DB destroyed
```

The five smoke checks:

- `GET /api/health` returns 200 (or warn if route absent)
- `POST /api/driver/session` with empty body returns 400 (Zod wiring check)
- Public schema has ≥ 30 tables
- Public schema has ≥ 40 RLS policies
- `markets` seed row for `slug='denver'` exists

## Running smoke locally against prod

**Dangerous — read-only tests only.** The script issues `GET` and two `psql SELECT` queries, no writes. If this ever changes, never run it against prod.

```bash
BASE_URL=https://aggregatemarket.vercel.app \
  SUPABASE_URL=$(pass supabase/prod-url) \
  SUPABASE_SERVICE_ROLE_KEY=$(pass supabase/prod-service-role) \
  NEXT_PUBLIC_SUPABASE_URL=$(pass supabase/prod-url) \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=$(pass supabase/prod-anon) \
  ./scripts/smoke-test.sh
```

## Cost

Supabase branching is included in the Pro $25/mo plan — no new line item. Vercel preview deployments are included in the existing plan.
