# AggregateMarket — Setup Guide

Production-grade materials delivery marketplace. Phase 1: browse → order → pay → dispatch.

---

## Prerequisites

- Node.js 20+
- A Supabase project (free tier works for dev)
- A Stripe account (test mode keys for dev)
- Git

---

## 1. Clone and install

```bash
git clone <your-repo>
cd aggregatemarket
npm install
```

---

## 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (secret key) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | See step 5 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API Keys |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for dev |
| `IMPORT_API_KEY` | Generate: `openssl rand -hex 32` |

---

## 3. Run database migrations

Open your Supabase project → SQL Editor → New query.

Run **in order**:

1. Paste and run `supabase/migrations/001_schema.sql`
2. Paste and run `supabase/migrations/002_dfw_seed.sql`

Verify: you should see tables in the Table Editor, and the DFW market + 8 materials in `market_materials`.

---

## 4. Create your admin user

1. Start the dev server: `npm run dev`
2. Go to `http://localhost:3000/signup` and create an account
3. In Supabase SQL Editor, run:

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = 'paste-your-user-id-here';
```

Your user ID appears in Supabase → Authentication → Users.

4. Go to `http://localhost:3000/admin` — you should see the dashboard.

---

## 5. Configure Stripe webhook (local dev)

Install Stripe CLI: https://stripe.com/docs/stripe-cli

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret it prints, paste into `STRIPE_WEBHOOK_SECRET` in `.env.local`.

**For production**: Create a webhook endpoint in Stripe Dashboard pointing to:
`https://yourdomain.com/api/webhooks/stripe`

Events to subscribe:
- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`

---

## 6. Wire up the first material for ordering

The seed data creates suppliers, yards, and offerings, but you need to verify the supply pool is correctly configured.

1. Go to `/admin/marketplace`
2. You should see 8 materials listed for DFW
3. Click any material → confirm a "Preferred Offering" is shown in the pool panel
4. If no preferred offering shows, click "Edit" and select one from the dropdown

---

## 7. Test the full order flow

1. Open an incognito window → `http://localhost:3000`
2. Click "Browse Materials" → pick Fill Dirt
3. Click through the order form, enter a Dallas address
4. Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC
5. You should land on `/orders/[id]?payment=success`
6. In admin: go to `/admin/orders` → find the order → click in → use Dispatch Panel

---

## 8. Run tests

```bash
# Unit tests (pricing engine)
npm run test

# Type check
npm run type-check
```

---

## Project structure

```
src/
├── app/
│   ├── (auth)/           Login, signup
│   ├── (marketplace)/    Customer-facing browse, checkout, orders, account
│   ├── admin/            Full admin control center
│   ├── portal/           Supplier portal (read-only Phase 1)
│   └── api/              Webhooks, pricing quote, import ingest, admin APIs
├── components/
│   ├── admin/            Admin-specific components
│   ├── auth/             Login/signup forms
│   ├── layout/           Header, footer, nav
│   ├── marketplace/      Customer-facing components
│   └── ui/               Shared UI primitives
├── lib/
│   ├── pricing-engine.ts       Server-side pricing (never in UI)
│   ├── fulfillment-resolver.ts Supply pool resolution
│   ├── dispatch.ts             Order dispatch lifecycle
│   ├── stripe.ts               Stripe helpers
│   └── supabase/               Server and client Supabase clients
└── types/index.ts              All TypeScript types
```

---

## Key architecture decisions

**Three-layer materials model:**
`material_catalog` (canonical) → `supplier_offerings` (supply side) → `market_materials` (customer-facing)

**Platform-controlled fulfillment:**
Customers never see suppliers. Admin controls which offering fulfills each order via the supply pool.

**Pricing is always server-side:**
The `PricingEngine` runs only on the server. The UI receives `PriceQuote` objects — it never calculates prices.

**Orders are immutable after payment:**
All snapshot fields (`material_name_snapshot`, `delivery_address_snapshot`, `line_items_snapshot`, pricing fields) are set at checkout and never updated.

**Dispatch is a separate state machine:**
`orders.status` = customer-visible. `dispatch_queue.status` = operational. They sync at explicit points (confirmed → dispatched, delivered).

---

## Adding a new market

1. Insert into `markets` table with `is_active = false`
2. Create suppliers and yards for that market
3. Create supplier offerings (mark `is_public = true` when ready)
4. Create `market_materials` entries for that market
5. Assign preferred offerings in the supply pool
6. Set `markets.is_active = true` when ready to launch

---

## Phase 2 roadmap

- [ ] Geocoding for real delivery distance calculations (replace hardcoded 15mi)
- [ ] Resend email confirmations on order creation
- [ ] Twilio SMS for order status updates
- [ ] Supplier self-service portal (flip `portal_enabled = true` per supplier)
- [ ] Automated scraper pipeline posting to `/api/import/ingest`
- [ ] Mobile app (React Native) using the same API layer
- [ ] Contractor marketplace
- [ ] Hauling / truck ordering
