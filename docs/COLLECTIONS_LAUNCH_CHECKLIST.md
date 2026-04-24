# Contractor Payment Kit — Launch Checklist

## §1 Product overview

Contractor Payment Kit is a standalone $49 flat-fee product generating a
4-document or 2-document kit for contractors pursuing unpaid work on property
in Colorado or Texas:

1. **Instruction packet** (always included) — 15–25 pages, state-specific,
   step-by-step guide covering the process, deadlines, notary procedure,
   certified mail how-to, legal description lookup, county directory,
   glossary, and when to call an attorney.
2. **Demand-for-payment letter** (always included).
3. **Pre-lien / intent-to-lien notice** (full kit only) — state-specific form.
4. **Mechanic's lien document** (full kit only) — state-specific, to be
   notarized and filed.

Full kit: 4 documents. Demand-only kit (TX homestead without pre-work
spouse-signed contract): 2 documents.

## §2 Legal posture — Option C kit model

See `docs/LEGAL_POSTURE.md` for the full analysis. Summary:

- Modeled on the *Medlock* / *Nolo Press* self-help legal software doctrine.
- Incompleteness is visible on the face of the output (amber "NOT READY TO
  FILE" banner + yellow "CUSTOMER VERIFICATION REQUIRED" callouts) — the
  customer cannot plausibly claim surprise.
- Instruction packet is the core product value. Education is First
  Amendment-protected.
- No LLM in any document body or instruction-packet content.
- No counsel review is required before launch (Phase 2 polish is optional).

## §3 Pre-launch activation checklist

### Stripe

- [ ] Stripe product "Contractor Payment Kit" created in LIVE mode, $49.00
      one-time.
- [ ] `STRIPE_PRICE_COLLECTIONS_KIT` env var set in Vercel Production.
- [ ] Stripe product set `active=true`.
- [ ] Stripe webhook endpoint configured at `/api/webhooks/stripe` (single
      router; the `product_family='collections'` branch routes to
      `grant_collections_case_from_stripe_event`).

### Supabase

- [ ] Storage bucket `collections` verified present with RLS policies.
- [ ] Migration 107 (`collections_assist`) applied.
- [ ] Migration 108 (`collections_storage_rls`) applied.
- [ ] Migration 108 (`collections_kit_expansion`) applied.

### App

- [ ] `NEXT_PUBLIC_COLLECTIONS_ENABLED=true` set in Vercel Production.
- [ ] Redeploy.

### Smoke test (staging / preview)

- [ ] **CO full kit** — `/collections/new` → commercial CO → fill → Stripe
      test card → PDFs generate with CO templates → all 4 downloadable.
- [ ] **TX full kit, commercial** — same with TX commercial.
- [ ] **TX full kit, residential non-homestead** — previously blocked in
      f1b7fc8; now accepted, kit is full.
- [ ] **TX full kit, homestead WITH pre-work contract** — both spouses signed,
      date provided; kit is full.
- [ ] **TX demand_only, homestead no-contract** — TX homestead, contract
      signed by owner only OR no contract; kit is demand-only with Section 0
      explaining why.

## §4 Rollback (seconds)

```
vercel env rm  NEXT_PUBLIC_COLLECTIONS_ENABLED production
vercel env add NEXT_PUBLIC_COLLECTIONS_ENABLED production   # enter: false
vercel --prod
```

Result: `/collections/*` routes return 404, nav link hidden, intake API 404s.
In-flight cases already paid will still generate PDFs on webhook receipt.

## §5 Refund procedure

1. In the Stripe dashboard, issue a refund on the charge.
2. Admin SQL:
   ```sql
   UPDATE collections_cases SET status = 'refunded' WHERE id = $1;
   INSERT INTO collections_case_events (case_id, event_type, event_payload)
     VALUES ($1, 'refunded', '{"actor":"admin_manual"}'::jsonb);
   ```
3. Outstanding signed URLs keep working until their 1-hour TTL expires; the
   download endpoint returns 410 for refunded cases thereafter.

## §6 Phase 2 — optional

- **Optional counsel review** — a Colorado-licensed and a Texas-licensed
  attorney reviewing the kit for a blessing. Estimated $800–$1500 per state.
  Not a launch blocker; becomes a marketing credential if obtained.
- Automated property owner lookup (PropStream / ATTOM / county scrapers).
- Additional states (AZ, NV, GA, FL, NC per blueprint expansion cities).
- Notary coordination service.
- Release-of-lien forms and partial-release-of-lien forms.
- Admin UI for refunds and case auditing.
- Draft-resume (v1 uses localStorage — a real `collections_drafts` table for
  cross-device resume).
- E-recording API integrations with county clerks that offer them.
