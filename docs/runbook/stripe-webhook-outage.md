# Runbook — Stripe webhook outage

## Detection

- **Primary signal**: `stripe_events` row count stops advancing during active checkout traffic. Query:
  ```sql
  SELECT MAX(received_at) FROM stripe_events;
  ```
- **Secondary**: Stripe dashboard → Developers → Webhooks → your endpoint → "Recent deliveries" column shows repeated failures or 5xx responses.
- **User-visible**: paid checkouts complete in Stripe UI but no credits appear in the library. Users email support.

## Immediate response (first 15 min)

1. **Confirm scope** — is `/api/webhooks/stripe` returning 5xx? Curl the endpoint with a bogus body + valid signature header shape:
   ```sh
   curl -i -X POST https://earthmove.io/api/webhooks/stripe \
     -H 'stripe-signature: t=0,v1=00' -d '{}'
   ```
   Expected: 400 "Invalid signature". If 5xx, the app is down or mis-deployed.
2. **Pause the incident damage** — in the Stripe dashboard, DO NOT disable the webhook endpoint (that would drop events). Stripe retries automatically for 72 hours.
3. **Check Vercel** → Deployments → Production. If a recent deploy broke the route, roll back via Vercel UI.

## Replay procedure

Once the endpoint is healthy:

1. In Stripe dashboard → Developers → Webhooks → your endpoint → "Failed deliveries" tab.
2. Select the failed deliveries (bulk) → "Resend selected events".
3. Our handler inserts into `stripe_events` with `ON CONFLICT DO NOTHING` on event.id — **replays are safe**. Duplicate events short-circuit with `{dup:true}` and no DB mutation occurs.

If the outage was long (>24h) and affected many events:

```sh
# Use the Stripe CLI for targeted replay:
stripe events resend evt_XXXX
stripe events resend --ending-before=evt_YYYY --limit=100
```

## Idempotency guarantees that protect us

- `stripe_events` PK on `event.id` prevents double-processing of the same webhook.
- `trust_credits_ledger.idempotency_key` partial UNIQUE (see migration 023) prevents double-mints from replayed credit events.
- `redeem_credit_atomic` RPC (migration 025) prevents race-time over-draws during recovery traffic.
- `prehire_watches` unique partial index on `(user_id, LOWER(contractor_name), state_code) WHERE status='active'` prevents double-watch rows.

## Post-incident

1. Check `audit_events WHERE event_type LIKE 'stripe%'` in the outage window — reconcile against Stripe's event list.
2. If an event family is missing entirely, file a postmortem in `docs/postmortem/YYYY-MM-DD-stripe-outage.md`.
3. If any user paid and we didn't process, refund via Stripe dashboard OR issue manual grant via a one-off service-role SQL snippet and note in audit_events with `event_type='manual.stripe_recovery'`.

## Owner
Primary: Juan. Secondary: Engineering on-call.
