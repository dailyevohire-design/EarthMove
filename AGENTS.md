# EarthMove.io — agent context

Aggregate-materials delivery marketplace. Customers (homeowners + contractors) order bulk materials (gravel, fill, sand, base stone, etc.) by ZIP; we route the cheapest delivered yard and dispatch trucks.

## Stack

- Next.js 16 (App Router, Turbopack), React Server Components by default, server actions for mutations.
- TypeScript strict.
- Supabase (project `gaawvpzzmotimblyesfp`) for Postgres + RLS + Auth + Storage. RLS-aware client at `@/lib/supabase/server`.
- Tailwind CSS for newer surfaces; legacy CSS classes (`.marketing-v6`, `.mat-grid`, etc.) in `src/app/marketing.css` for the homepage.
- Stripe (currently in staging) for payments; webhook in `src/app/api/stripe/webhook`.
- Inngest for background jobs (ops pager, etc.).
- Twilio for SMS.

## Repo layout

- `src/app/` — App Router routes. Marketplace routes under `(marketplace)`.
- `src/app/api/` — route handlers (resolve-zip, waitlist, stripe webhook, trust endpoints).
- `src/components/` — UI. Marketing surfaces in `src/components/marketing/`. Marketplace in `src/components/marketplace/`.
- `src/lib/` — utilities (best-offering picker, pricing engine, market resolution, projects config, etc.).
- `supabase/migrations/` — DB migrations. Live schema may have drift; verify via Supabase MCP before writing migrations.

## Launch context

- **Public launch: 2026-05-07 (today).**
- Launch markets: Denver and Dallas–Fort Worth, co-equal.
- Portland and other cities (Houston, Austin, Phoenix, Las Vegas, Atlanta, Orlando, Tampa, Charlotte) are **expansion pipeline only** — never list them as current launch markets in user-facing copy.
- Launch supplier in DFW: North Texas Natural Materials (NTNM), 10 yards, 62 offerings.

## Recent work (May 6–7, 2026)

- **2026-05-07 — Homepage v3 redesign.** Replaced the v6 marketing homepage with a Bloomberg/Linear/Stripe-restraint design from a Claude Design handoff. New composition: `Header` (three-bar Ξ + arthmove wordmark) → `LiveRail` (terminal ticker, real yard counts) → `Hero` (dual-path: homeowner ZIP + project chips, or contractor takeoff/SMS/PO/recurring tiles) → `Metrics` (4-cell trust grid, no fake volume claims) → project routing section + `Projects` grid → `PricingEngine` (routing model — qualitative, no synthetic numbers) → network coverage section + `MarketDensity` (animated SVG metro map; only DEN+DFW shown live, Portland staged, others queued) → `TrustBand` → live dispatch section + `Dispatch` + `RouteMap` (clearly labeled "Sample") → `ActivityFeed` ("Sample activity · illustrative") → `FootCTA` → legal. Hero ZIP form posts to `startQuoteAction` (`src/components/marketing/v3/actions.ts`) which uses an explicit Denver/DFW allowlist (NOT `LAUNCH_MARKET_SLUGS`, which is misnamed and includes expansion). Selected project routes to `/projects/<slug>`; bare ZIP routes to `/order?zip=<zip>`. Codex review caught and fixed: fake metrics, mislabeled yards, missing aria, expansion-market leakage. Files: `src/app/marketing-v3.css`, `src/components/marketing/v3/*`, `src/components/marketing/Homepage.tsx` (rewritten), `src/app/layout.tsx` (added Instrument_Serif).
- NTNM launch data seeded; zip-aware all-in delivered pricing wired into `/browse` and PDP via `pickBestOffering` (`src/lib/best-offering.ts`).
- Material image fixes: `material_catalog.image_url` backfilled for the 5 marketing slugs; branded `MaterialImagePlaceholder` (logo mark + "Product image coming soon") replaces blank fallbacks site-wide.
- `/projects/[slug]` simplified to an education page; `src/lib/projects.ts` slug vocabulary reconciled to pea-gravel, landscape-rock, paver-base, base-stone, concrete-aggregate. ZIP form server action sets `market_id` + `customer_zip` cookies and redirects to `/order?project=<slug>`.
- Orphans removed: `MaterialsCard6.tsx`, `MaterialsSubcopy.tsx`. Now-unused (still in tree, may be cleaned up): `HeroLeftColumn.tsx`, `MaterialsSection.tsx`, `MaterialSpecSection.tsx`, `HowItWorksSection.tsx`, `MarketStatusStrip.tsx`, `CoverageCalculator.tsx`, `NavScroll.tsx`, `TrustStrip.tsx` — the v3 homepage no longer imports any of these.

## Coding conventions

- Server components by default; `'use client'` only when interactivity is required.
- Cookies: read via `cookies()` from `next/headers`; set only in server actions or route handlers.
- Don't ship migrations unless schema changes are intended; live schema has known drift.
- Pre-existing TypeScript errors in `src/lib/trust/scrapers/state-ag-enforcement.ts` (cheerio types missing) — unrelated to most work, ignore unless touching that file.
- `tsc --noEmit` and `eslint` must be clean on touched paths before committing.
- `pnpm next build` is intentionally not run pre-push (build is verified in CI / on Vercel).
- Commit messages: action-first bullets per file, no trailing summary section.

## Trust + Groundcheck

- Trust v2 routing is canonical (commit `2aeeb1c`); v1 mock orchestrator is removed.
- Groundcheck is one product with Free/Pro/Premium/Enterprise tiers, surfaced as renderings to drivers, contractors, and the public `/trust` page.

## Things to watch / open items

- `stripe-staging` branch has migrations 110/111 + edge handlers committed but not yet deployed to prod.
- Image quality `q=85` previously broke under Next 16's strict `images.qualities` validation; fixed in commit `2102472` by adding `images.qualities = [75, 85]` to `next.config.ts`.
- Sitemap (`src/app/sitemap.ts`) does NOT include `/projects/*` routes yet; they're discoverable only via direct link / SEO crawl.
- `LAUNCH_MARKET_SLUGS` in `src/lib/zip-market.ts` is misnamed — it includes expansion zips (Phoenix, Houston, Austin, Atlanta, Orlando, etc.). For "is this market actually live?" use `['denver', 'dallas-fort-worth']` directly. The homepage `startQuoteAction` and dependent surfaces explicitly check this strict list.
- `/order/route.ts` strips `searchParams` on redirect to `/browse`. Any `?project=` param needs to be persisted via `project_intent` cookie, which the v3 homepage and `/projects/[slug]` server actions both set.
- v3 homepage demos (Dispatch + ActivityFeed) are clearly marked as "Sample · illustrative" — replace with live data once orders flow.

## Deployment

- Production: Vercel auto-deploy on push to `main`.
- Domain: `https://earthmove.io`.
