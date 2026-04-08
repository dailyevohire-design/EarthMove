# Wake-Up Summary — Overnight Run

**Branch:** `main` (all commits pushed and deployed to prod)
**Build status:** ✅ Clean (`next build` passed, TypeScript clean, 35 routes generated)
**Live URL:** https://earthmove.io/?pw=earthmove2026

---

## What shipped

7 atomic commits since the start of the session, all on `main` and live in production:

| # | Commit | What |
|---|--------|------|
| 1 | `c5142a3` | Hero reorder, tactile cards, live activity, pre-ZIP pitch |
| 2 | `c4e0be5` | Neon emerald glow on "How It Works" cards |
| 3 | `6d72fe7` | SEO: JSON-LD structured data on hub + article pages |
| 4 | `d09b7b4` | SEO: dynamic sitemap pulled from Supabase |
| 5 | `1de5a8d` | perf: preconnect + dns-prefetch hints |
| 6 | `49eb961` | design: tactile depth on deal cards + quantity calculator |
| 7 | `6799b40` | fix: styled-jsx multi-line className parser issue |

To revert any single change: `git revert <hash>`. Each commit is self-contained.

---

## Phase 1 — SEO completions

The site already had good per-page metadata and schema on dynamic routes
(`/browse/[slug]`, `/[city]`, `/[city]/[material]`). The gap was hub pages
and learn articles. All filled in.

**Added to `src/lib/structured-data.ts`:**
- `articleSchema()` — full Article schema with publisher, author, dates, mainEntityOfPage
- `collectionPageSchema()` — CollectionPage with optional itemCount
- `itemListSchema()` — ItemList of Products for browse grids

**JSON-LD now injected on:**
- `/browse` — CollectionPage + ItemList (first 20 products) + BreadcrumbList
- `/deals` — CollectionPage + BreadcrumbList
- `/learn` — CollectionPage + BreadcrumbList + canonical + OG (was missing canonical too)
- `/learn/[slug]` — Article + BreadcrumbList + `og:type=article` (was just title/description)
- `/material-match` — BreadcrumbList + HowTo schema (the quiz)

**Sitemap is now dynamic:** `src/app/sitemap.ts` queries `markets` and `material_catalog`
from Supabase at request time. Falls back to the previous hardcoded list if Supabase
is unreachable so it can never be empty. New markets and materials will appear in
the sitemap automatically — no code change needed.

> ⚠ **Important context:** SITE_PASSWORD is still set in production, which means
> Google can't actually crawl any of this yet. The middleware doesn't exempt
> `/sitemap.xml` or `/robots.txt`, so they 200 with the password gate HTML to
> crawlers. **All this SEO work is preparation** — it activates the moment you
> remove SITE_PASSWORD or whitelist crawlers in middleware.ts. See "Flagged for
> review" below.

---

## Phase 2 — Tactile design extension

The hero MaterialCard treatment from earlier got extended to two more components:

- **`deal-grid.tsx`** — multi-layer shadow with emerald-tinted glow, `:active` press
  compression, `touch-manipulation`. Removed the floating `hover:scale[1.02]` in
  favor of a real lift animation. Used on `/deals` page.
- **`quantity-calculator.tsx`** — multi-layer shadow with subtle emerald ambient
  glow + inner top highlight. The calculator now reads as a physical instrument
  panel instead of a flat label. Used on `/browse/[slug]` and `/[city]/[material]`.

I audited 7 marketplace components for flat-card patterns. The other candidates
(`material-quiz`, `pre-zip-pitch`, `zip-entry`, `trust-section`) were either
already glowing or unused dead code. `trust-section.tsx` is referenced by nothing
in the codebase — flagged in "Worth your attention" below.

---

## Phase 3 — Performance

**Added preconnect + dns-prefetch hints in `src/app/layout.tsx`:**
- `gaawvpzzmotimblyesfp.supabase.co` (Supabase + image storage)
- `images.unsplash.com` (article hero images)
- `js.stripe.com` (Stripe.js)

These typically save 100–300ms on TTFB for any page that touches those origins
because the browser starts the TLS handshake before the HTML parser reaches
the first fetch.

**Bundle audit findings (no changes made — explained why below):**
- 33 client components total. Most are legitimately interactive (forms, modals,
  admin panels, the live-activity ticker, etc.) and cannot be converted.
- `learn-hub.tsx` (497 lines) is the biggest, but it has 15 uses of state/refs/handlers
  for filter buttons. Converting to a server component would mean extracting all
  filtering UI to a child client component — high effort, modest reward.
- `chat-widget.tsx` (73 lines) is tiny enough that lazy-loading it wouldn't move
  the needle. Already client-side.
- The build output shows Turbopack is generating reasonable bundles. No obvious
  bloat.

**Recommendation:** A Lighthouse run on prod would tell us where to actually focus.
I didn't run one because I'd need real network conditions and the site is
password-gated.

---

## Phase 4 — QA

Instead of curling each route (dev server got stuck compiling on first hit, taking
20–80s per route), I ran a full `next build`. Stronger signal: it typechecks +
compiles + statically analyzes every route in one pass.

**Result: ✅ Build clean.** All 35 routes compiled, TypeScript passed, no errors,
no warnings worth surfacing.

I also verified prod after each push:
- `https://earthmove.io/?pw=earthmove2026` → `307` with `site_access=granted` cookie
- `https://earthmove.io/sitemap.xml` → returns dynamic XML from Supabase

---

## ⚠ Flagged for your review

These are things I noticed but did NOT fix because they're judgment calls
that need you awake.

### 1. SITE_PASSWORD blocks Google indexing entirely

The middleware in `middleware.ts:9` only exempts `/api/*`. Everything else
(including `/sitemap.xml` and `/robots.txt`) returns the password gate HTML to
crawlers. **Until you decide to remove the password OR exempt crawler-needed
paths, none of the SEO work matters.**

When you're ready, options are:
- Remove `SITE_PASSWORD` from Vercel envs entirely (full launch)
- Or exempt sitemap/robots from middleware so Google can crawl them while
  the rest of the site stays gated
- Or whitelist crawler user-agents in middleware (hacky, against Google guidelines
  unless cloaking is acceptable)

Don't want to make this call without you.

### 2. The "Ready to order?" CTA on learn article pages

You said you hate "vibe-coded" closing CTAs in our home page conversation. The
learn article pages still have one at the bottom of `learn/[slug]/page.tsx:1409`
("Ready to order? Browse Materials"). I left it because article context is
different from a homepage closing CTA, and removing it could affect
article→browse conversion. Want me to kill it tomorrow? Or replace with
inline product mentions in the article body?

### 3. `trust-section.tsx` is dead code

`src/components/marketplace/trust-section.tsx` is not imported anywhere in the
app or other components. Either an old prototype that was forgotten or
something you meant to wire up. Safe to delete or wire in.

### 4. Stripe live keys had `\n` corruption for ~2 weeks (from earlier)

Already fixed in production env, but I'd recommend checking the Stripe dashboard
for failed webhooks or signature verification errors over the past two weeks.
Live secret + newline can pass some Stripe API calls but fail signature
verification on webhooks, which would have caused silent payment confirmation
failures. Worth a 5-minute audit when you're up.

### 5. Multi-line className + styled-jsx incompatibility

I hit a runtime parse error when I added a multi-line `className` to
`deal-grid.tsx` because that file uses `<style jsx>` and the styled-jsx SWC
plugin can't handle multi-line JSX strings (commit `6799b40` fixes it).
Just FYI in case anyone else hits the same trap. Convention going forward:
single-line `className`s on any component that uses styled-jsx.

### 6. Things I deliberately did NOT touch

Per the guardrails I set before bed:
- No Stripe / webhook / checkout logic
- No DB migrations
- No `next.config.ts` changes (training data may be outdated, would have needed
  to verify upgrade path)
- No copy/voice rewrites
- No `learn/[slug]` article body edits

---

## Worth doing next (when you're up)

In rough order of impact:

1. **Decide on the SITE_PASSWORD strategy** so SEO can actually start working
2. **Lighthouse run on prod** to find actual perf hotspots
3. **Wire up or delete `trust-section.tsx`**
4. **5-minute Stripe webhook audit** for the past 2 weeks (failed deliveries?)
5. **Decide on the learn-page closing CTA** (kill it / keep it / replace)
6. **Real order data → live activity feed** — currently `live-activity.tsx`
   uses `generateOrders()` to fake the feed deterministically from market list.
   Once you have real order data, swap that one function for a Supabase query.
   The component shape is already designed for it.
7. **Add OG images** — `og:image` is missing from most metadata. Generating
   dynamic OG images via Next.js `ImageResponse` per market/material would be
   a big visual win when links get shared.

---

## Memory updated

Saved a `feedback_design_taste.md` memory earlier today capturing your design
preferences (tactile depth, single focal CTA, no vibe-coded marketing filler,
neuroscience-driven). That'll persist across future sessions so I won't drift
from your taste.

---

Sleep well. Everything is reversible per-commit if anything looks wrong tomorrow.
