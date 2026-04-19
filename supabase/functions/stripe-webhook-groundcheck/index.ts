// Ground Check — Stripe webhook (credit grants)
// Project: gaawvpzzmotimblyesfp (Earth Pmove)
// Auth: Stripe signature verification (NOT Supabase JWT). verify_jwt=false.
//
// Session metadata contract (enforced at /api/checkout/create-session):
//   metadata.user_id        — auth.users.id UUID (required; client_reference_id fallback accepted)
//   metadata.tier           — one of: standard | plus | deep_dive | forensic (required)
//   metadata.product_family — 'ground_check' (required; 'product' accepted as legacy alias)
//
// Response semantics:
//   400 — bad signature / missing signature (Stripe config error)
//   200 — event handled, event ignored, or permanently-malformed (dead-lettered)
//   500 — transient DB failure (Stripe retries w/ exponential backoff up to 3 days)
//
// Idempotency: enforced by grant_credit_from_stripe_event RPC + trust_stripe_events
//              unique index on stripe_event_id. Safe to replay any event.

import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ---- Env ----
const STRIPE_SECRET_KEY             = Deno.env.get('STRIPE_SECRET_KEY')                 ?? '';
const STRIPE_WEBHOOK_SECRET         = Deno.env.get('STRIPE_WEBHOOK_SECRET_GROUNDCHECK') ?? '';
const SUPABASE_URL                  = Deno.env.get('SUPABASE_URL')                      ?? '';
const SUPABASE_SERVICE_ROLE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')         ?? '';
const CREDIT_VALIDITY_DAYS          = Number(Deno.env.get('GC_CREDIT_VALIDITY_DAYS') ?? '90');

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('missing required env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET_GROUNDCHECK, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

// ---- Clients ----
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { 'x-gc-source': 'stripe-webhook-groundcheck' } },
});

// ---- Constants ----
const VALID_TIERS = new Set(['standard', 'plus', 'deep_dive', 'forensic']);
const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);
const PRODUCT_FAMILY = 'ground_check';
// RFC 4122 v1–v5 UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Single-line JSON logging — easy to grep and ingest into any log pipeline.
function log(level: 'info' | 'warn' | 'error', msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, msg, ts: new Date().toISOString(), ...fields });
  if (level === 'error')      console.error(line);
  else if (level === 'warn')  console.warn(line);
  else                        console.log(line);
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    log('warn', 'missing stripe-signature header');
    return new Response('missing signature', { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    log('error', 'failed to read body', { error: (err as Error).message });
    return new Response('unable to read body', { status: 400 });
  }

  // ---- Signature verification ----
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET,
      undefined, // default 5-min tolerance
      cryptoProvider,
    );
  } catch (err) {
    log('warn', 'signature verification failed', { error: (err as Error).message });
    return new Response('bad signature', { status: 400 });
  }

  // ---- Event routing ----
  if (!HANDLED_EVENTS.has(event.type)) {
    log('info', 'ignored event type', { event_id: event.id, type: event.type });
    return json(200, { ok: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Product-family gate. Supports 'product_family' (canonical) or 'product' (legacy alias).
  // If this webhook endpoint ever gets shared across brands or Stripe accounts, this
  // prevents granting Ground Check credits for DumpSite / FillDirtNearMe purchases.
  const md = session.metadata ?? {};
  const family = md.product_family ?? md.product ?? null;
  if (family !== PRODUCT_FAMILY) {
    log('info', 'non-groundcheck product; ignoring', {
      event_id: event.id,
      session_id: session.id,
      family,
    });
    return json(200, { ok: true, ignored: 'non_groundcheck', family });
  }

  // For async_payment_succeeded, payment_status is already 'paid' when this fires.
  // For completed, it may be 'unpaid' (async methods) — defer until async_payment_succeeded.
  if (session.payment_status !== 'paid') {
    log('info', 'session not paid; deferring', {
      event_id: event.id,
      session_id: session.id,
      payment_status: session.payment_status,
    });
    return json(200, { ok: true, ignored: 'payment_status', payment_status: session.payment_status });
  }

  // ---- Metadata validation ----
  // user_id: metadata first, client_reference_id fallback for sessions created via
  // redirect flows that set client_reference_id without full metadata.
  const userIdRaw = (md.user_id ?? session.client_reference_id ?? '').trim();
  const tier      = (md.tier ?? '').trim();

  if (!userIdRaw || !UUID_RE.test(userIdRaw) || !tier || !VALID_TIERS.has(tier)) {
    // Permanent failure — session-creator bug. 200-ack so Stripe stops retrying;
    // Stripe dashboard + these logs are the paper trail.
    log('error', 'malformed session metadata — dead-lettered', {
      event_id: event.id,
      session_id: session.id,
      user_id: userIdRaw || null,
      tier: tier || null,
      livemode: event.livemode,
    });
    return json(200, { ok: false, reason: 'malformed_metadata' });
  }

  const amountCents = session.amount_total ?? 0;
  if (amountCents <= 0) {
    log('error', 'non-positive amount_total — dead-lettered', {
      event_id: event.id,
      session_id: session.id,
      amount_total: session.amount_total,
    });
    return json(200, { ok: false, reason: 'bad_amount' });
  }

  // ---- Extract nested IDs safely (Stripe typing: string | object | null) ----
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null;

  // ---- Grant ----
  // Full event object passed as payload for forensic value (JSONB, compresses well).
  const { data, error } = await supabase.rpc('grant_credit_from_stripe_event', {
    p_stripe_event_id:           event.id,
    p_event_type:                event.type,
    p_user_id:                   userIdRaw,
    p_tier:                      tier,
    p_amount_cents:              amountCents,
    p_stripe_session_id:         session.id,
    p_stripe_payment_intent_id:  paymentIntentId,
    p_stripe_customer_id:        customerId,
    p_credit_validity_days:      CREDIT_VALIDITY_DAYS,
    p_payload:                   event as unknown as Record<string, unknown>,
  });

  if (error) {
    log('error', 'grant_credit_from_stripe_event failed', {
      event_id: event.id,
      session_id: session.id,
      pg_code: (error as { code?: string }).code,
      pg_details: (error as { details?: string }).details,
      error: error.message,
    });
    return json(500, { ok: false, error: 'rpc_failed', message: error.message });
  }

  const credit = data as { id?: string; user_id?: string; tier?: string; expires_at?: string } | null;

  log('info', 'credit granted', {
    event_id: event.id,
    session_id: session.id,
    credit_id: credit?.id,
    user_id: credit?.user_id,
    tier: credit?.tier,
    amount_cents: amountCents,
    expires_at: credit?.expires_at,
  });

  return json(200, { ok: true, event_id: event.id, credit_id: credit?.id, tier: credit?.tier });
});
