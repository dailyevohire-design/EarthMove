# EarthMove Launch Runbook

**Launch date:** Monday 2026-04-13
**Markets:** Dallas-Fort Worth, Denver, Phoenix, Houston, Atlanta, Orlando, Tampa, Las Vegas, Raleigh, Salt Lake City, Austin, Boise (12 total)
**Last pre-launch commit:** `656cb44` (and whatever follows it)

---

## Pre-launch checklist

Mark each `[x]` when verified.

### Infrastructure
- [x] `SITE_PASSWORD` removed from Vercel production
- [x] `earthmove.io` returns 200 on homepage
- [x] All routes return 200: `/`, `/browse`, `/deals`, `/learn`, `/material-match`, `/login`, `/signup`, `/dallas-fort-worth`, `/denver`, `/dallas`, `/dfw`, `/phoenix`, `/houston`, `/atlanta`, `/orlando`, `/tampa`, `/las-vegas`, `/raleigh`, `/salt-lake-city`, `/austin`, `/boise`, `/sitemap.xml`, `/robots.txt`
- [x] No console errors on any page
- [x] `STRIPE_SECRET_KEY` set in Vercel prod
- [x] `STRIPE_WEBHOOK_SECRET` set in Vercel prod
- [x] `SUPABASE_SERVICE_ROLE_KEY` set in Vercel prod
- [x] `NEXT_PUBLIC_APP_URL` set in Vercel prod
- [ ] `RESEND_API_KEY` set in Vercel prod ← **BLOCKS LAUNCH**
- [ ] Resend sending domain `earthmove.io` verified (SPF + DKIM)

### External systems
- [ ] Stripe Dashboard → Developers → Webhooks → endpoint points at `https://earthmove.io/api/webhooks/stripe`
- [ ] Stripe webhook signing secret matches `STRIPE_WEBHOOK_SECRET` in Vercel
- [ ] Stripe webhook listens for: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`
- [ ] Resend domain `earthmove.io` shows "Verified"

### Functional
- [ ] Real checkout end-to-end on desktop with Stripe test card `4242 4242 4242 4242`
- [ ] Real checkout end-to-end on mobile (iOS Safari + Android Chrome)
- [ ] Order confirmation email arrives within 30s of payment
- [ ] Supabase `orders` row shows `status='confirmed'`, `stripe_payment_intent_id` populated
- [ ] Supabase `dispatch_queue` row created with `status='queued'`
- [ ] Supabase `audit_events` row: `event_type='order.payment_confirmed'`
- [ ] Guest checkout: claim-account email arrives with working `/signup?email=...&first_name=...&from_order=...` link
- [x] ZIP picker: DFW zip (75201) resolves correctly
- [x] ZIP picker: Denver zip (80202) resolves correctly
- [x] ZIP picker: Phoenix (85001), Houston (77001), Atlanta (30301), Orlando (32801), Tampa (33601), Las Vegas (89101), Raleigh (27601), Salt Lake City (84101), Austin (78701), Boise (83701) all resolve correctly
- [x] ZIP picker: out-of-market zip (90210) shows "not in launch markets" state
- [x] ZIP picker: non-launch markets (San Antonio 78201, Nashville 37201) return out_of_area

### Code/quality gates
- [x] `npx tsc --noEmit` clean
- [x] `npx vitest run` green (29/29)
- [x] No `SITE_PASSWORD` literal in committed code
- [x] `jsonLd()` helper used everywhere for JSON-LD (no raw `JSON.stringify` in `__html:`)

---

## Launch sequence (Monday morning)

1. **T-60 min:** Open three tabs:
   - Vercel logs (`vercel logs --follow` or dashboard)
   - Stripe dashboard (Payments view)
   - Supabase dashboard (SQL editor, pre-load a query: `select id, status, total_cents, created_at from orders order by created_at desc limit 20;`)
2. **T-30 min:** One final real checkout with a Stripe test card to confirm nothing silently broke overnight.
3. **T-0:** Go live (announce / share).
4. **T+5 min:** Refresh Supabase orders query. Any real order visible? Check corresponding `audit_events`.
5. **T+15 min:** First hour — monitor Vercel logs for 500s, Stripe for failed payments.

---

## Rollback plan

If something goes wrong after launch:

### Option A: Revert to previous known-good commit
```bash
cd /home/earthmove/EarthMove
git log --oneline -10        # find the last green commit
git revert <bad-commit>      # creates a new commit reverting the bad one
git push origin main         # Vercel redeploys automatically
```

Previous known-good: `718ba50` (security fixes, before the slug launch-day rush)

### Option B: Instant rollback via Vercel (fastest, <30s)
1. Vercel dashboard → Deployments
2. Find the last green deployment (pre-broken)
3. Click `···` → "Promote to Production"
4. Alias flips instantly. Zero build time.

### Option C: Put the gate back up
If the site is on fire and you need it offline for 10 min:
```bash
vercel env add SITE_PASSWORD production
# paste any password
vercel redeploy <latest-prod-url>
```
Site returns to the under-construction gate until you remove the var again.

---

## Known blind spots

1. **Deposit refunds on order cancel** — not verified end-to-end.
2. **Stripe webhook retry behavior** — we return 200 on dispatch failure to avoid re-processing loop, and log `order.dispatch_failed` to `audit_events`. Monitor that event type post-launch.
3. **Guest orders without subsequent signup** — orders table has `guest_email` + `guest_first_name` but no long-term plan for unclaimed orders. Acceptable for launch.
4. **Supabase RLS on new `orders` guest path** — the webhook uses `createAdminClient()` so RLS is bypassed. User-facing reads go through `createClient()` (anon). Verify RLS policies let a customer read their own orders (not someone else's).
5. **New market suppliers (NV, UT, ID)** — Las Vegas, Salt Lake City, Boise have synthetic supplier data (created for launch). Real suppliers to be added via scraping pipeline post-launch. FL and NC markets have a mix of real + synthetic.
6. **Non-launch markets (San Antonio, Nashville, Charlotte)** — set `is_active=false` in DB. Direct URL access will 404. Can be re-enabled later.

---

## Contact

- **Founder:** Juan
- **Domain:** earthmove.io (DNS: check wherever it's registered)
- **Vercel project:** `dumpsiteio/aggregatemarket`
- **Supabase project:** (see `.env.local` for URL)
- **Stripe account:** (live mode, check dashboard)
- **Resend account:** (to be created — launch blocker)
