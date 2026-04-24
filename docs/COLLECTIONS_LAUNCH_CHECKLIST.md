# Collections Assist — Launch Checklist

## §1 Product overview

Collections Assist is a standalone $99 flat-fee service that generates three
state-specific lien-path documents for contractors and suppliers who have
unpaid work at a Colorado or Texas (DFW commercial) property:

1. A formal demand-for-payment letter.
2. A pre-lien / intent-to-lien notice (state-specific form).
3. A mechanic's lien statement or lien affidavit (state-specific form).

It is sibling to the GroundCheck product — separate route, separate Stripe
product, separate DB tables. Stripe product is feature-flagged OFF at launch
until two-attorney sign-off (§3).

## §2 Legal posture

Collections Assist is a **self-help legal software** product, modeled on the
doctrine established in *Medlock v. LegalZoom.com, Inc.*, 738 S.E.2d 682 (S.C.
2013) and *In re Nolo Press / Parsons Technology*, 991 S.W.2d 768 (Tex. 1999).

- **No attorney-client relationship** is formed at any point in the flow.
- **No fact-specific legal advice** is given. Templates are statutory
  boilerplate.
- **No LLM is used in document generation** in v0. All six templates (three CO,
  three TX) are pure rendering from user-entered data.
- **Branching intake is information gathering**, not legal diagnosis. State,
  property type, homestead, and contractor role are scope filters — not
  recommendations.
- **User makes every substantive decision.** Amount owed, who to name, whether
  to file, are all user-selected.
- **Prominent disclaimers on every surface** — layout wrapper, each intake
  step, PDF header + footer, terms of service.
- **`[VERIFY WITH {STATE} ATTORNEY: ...]` placeholders** are rendered in the
  PDFs in bold red to force counsel attention. We never fabricate statutory
  language.

See `docs/LEGAL_POSTURE.md` for the full doctrinal analysis.

## §3 Pre-launch activation checklist

Do not flip `NEXT_PUBLIC_COLLECTIONS_ENABLED=true` until **every** box is
checked.

### Counsel review

- [ ] Colorado-licensed attorney reviews `src/lib/collections/templates/co/*.ts`
      and approves OR replaces every `[VERIFY WITH COLORADO ATTORNEY: ...]`
      placeholder.
- [ ] Texas-licensed attorney reviews `src/lib/collections/templates/tx/*.ts`
      and approves OR replaces every `[VERIFY WITH TEXAS ATTORNEY: ...]`
      placeholder.
- [ ] Both attorneys review sample generated PDFs (run the seed script with
      representative test cases per state).
- [ ] Both attorneys review `UPL_DISCLAIMER` text in
      `src/lib/collections/disclaimer.ts`.
- [ ] Counsel confirms state-specific UPL posture (CO: self-help software
      precedent; TX: *Nolo Press* precedent).
- [ ] `docs/LEGAL_POSTURE.md` reviewed by counsel.
- [ ] Terms of service page (`/legal/collections-terms`) reviewed by counsel.

### Stripe

- [ ] Product "Collections Assist" created in Stripe LIVE mode, $99.00
      one-time.
- [ ] `STRIPE_PRICE_COLLECTIONS_ASSIST` env var set in Vercel Production.
- [ ] Stripe product set `active=true`.
- [ ] Webhook endpoint configured in the Stripe dashboard pointing at
      `/api/webhooks/stripe` (single router — the `product_family='collections'`
      branch routes to `grant_collections_case_from_stripe_event`).

### Supabase

- [ ] Storage bucket `collections` exists with RLS verified (policies "Users
      read own collections objects" and "Service role full access collections").
- [ ] Migration 107 (`collections_assist`) applied.
- [ ] Migration 108 (`collections_storage_rls`) applied.

### App

- [ ] `NEXT_PUBLIC_COLLECTIONS_ENABLED=true` set in Vercel Production.
- [ ] Redeploy.

### Smoke test (staging / preview)

- [ ] CO case: `/collections/new` → fill → Stripe test card `4242 4242 4242 4242`
      → PDFs generate with CO templates → all 3 downloadable.
- [ ] TX commercial case: same with TX templates.
- [ ] TX residential attempt: blocked at Step 1 with `tx_v0_requires_commercial`.
- [ ] TX homestead attempt: blocked at Step 1 with `homestead_not_supported`.
- [ ] Past-deadline CO case (last_day 5 months ago): blocked at Step 5 with
      `past_filing_deadline`.

## §4 Rollback (seconds)

```
vercel env rm  NEXT_PUBLIC_COLLECTIONS_ENABLED production
vercel env add NEXT_PUBLIC_COLLECTIONS_ENABLED production   # enter: false
vercel --prod
```

Result: `/collections/*` routes return 404, nav link hidden, intake API 404s.
In-flight cases already paid will still generate PDFs on webhook receipt (the
webhook does not gate on the flag).

## §5 Refund procedure

1. In the Stripe dashboard, issue a refund on the charge.
2. Admin SQL:
   ```sql
   UPDATE collections_cases SET status = 'refunded' WHERE id = $1;
   INSERT INTO collections_case_events (case_id, event_type, event_payload)
     VALUES ($1, 'refunded', '{"actor":"admin_manual"}'::jsonb);
   ```
3. Any outstanding signed URLs will continue to work until their 1-hour TTL
   expires; no live fetches are possible thereafter because
   `/api/collections/[id]/download` returns 410 for refunded cases.

## §6 Phase 2 / out-of-scope for v0

- Automated property owner lookup (PropStream / ATTOM / county scrapers).
- Texas residential non-homestead.
- Additional states (AZ, NV, GA, FL, NC per blueprint expansion cities).
- Notary coordination service.
- E-filing with Denver, Arapahoe, Dallas, Tarrant county clerks.
- AI tone polish on demand letter (requires a separate counsel opinion —
  LLM-generated content is novel UPL territory).
- Homestead workflow (requires pre-work contract intake).
- Admin UI for refunds and case auditing.
- Draft-resume (v0 uses localStorage — migrate to a real `collections_drafts`
  table when we go past single-device use).
