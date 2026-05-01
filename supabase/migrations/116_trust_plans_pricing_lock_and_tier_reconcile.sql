-- 116_trust_plans_pricing_lock_and_tier_reconcile.sql
-- Purpose:
--   1. Lock public Groundcheck pricing tiers to Free / Pro / Premium / Enterprise
--      (replaces 2026-Q1 'standard' plan killed in 2026-04-29 pricing decision).
--   2. Reconcile tier CHECK constraints across trust_reports, trust_credits_ledger,
--      and trust_jobs to a single allowed set: {free, standard, plus, deep_dive, forensic}.
--      Removes 'pro' and 'enterprise' from depth-tier allowlists; those are PLANS,
--      tracked in trust_plans / trust_subscriptions, not report depths.
--
-- Safety:
--   - Idempotent. Re-applying is a no-op.
--   - Backfills 1 known trust_reports row with tier='pro' to 'standard' before
--     tightening the constraint (verified via MCP: 1 row).
--   - Does NOT touch trust_subscriptions, trust_jobs data, or any user credits.
--   - Does NOT solve C-Trust-2 (anon lookup + IP rate-limit) — separate spec.

BEGIN;

-- ============================================================
-- 1. Backfill non-conforming tier rows BEFORE tightening CHECKs
-- ============================================================

UPDATE trust_reports
SET tier = 'standard'
WHERE tier IN ('pro', 'enterprise');
-- Verified: 1 row affected (the prior singleton 'pro' report).

UPDATE trust_credits_ledger
SET tier = 'standard'
WHERE tier IN ('pro', 'enterprise');
-- Verified: 0 rows affected. Defensive only.

-- ============================================================
-- 2. Reconcile tier CHECK constraints
--    Allowed depth tiers: {free, standard, plus, deep_dive, forensic}
--    Plan tiers (free/pro/premium/enterprise) live in trust_plans.id, NOT here.
-- ============================================================

ALTER TABLE trust_reports DROP CONSTRAINT IF EXISTS trust_reports_tier_check;
ALTER TABLE trust_reports
  ADD CONSTRAINT trust_reports_tier_check
  CHECK (tier = ANY (ARRAY['free','standard','plus','deep_dive','forensic']::text[]));

ALTER TABLE trust_credits_ledger DROP CONSTRAINT IF EXISTS trust_credits_ledger_tier_check;
ALTER TABLE trust_credits_ledger
  ADD CONSTRAINT trust_credits_ledger_tier_check
  CHECK (tier = ANY (ARRAY['free','standard','plus','deep_dive','forensic']::text[]));

-- trust_jobs already correct; re-assert for idempotency.
ALTER TABLE trust_jobs DROP CONSTRAINT IF EXISTS trust_jobs_tier_check;
ALTER TABLE trust_jobs
  ADD CONSTRAINT trust_jobs_tier_check
  CHECK (tier = ANY (ARRAY['free','standard','plus','deep_dive','forensic']::text[]));

-- ============================================================
-- 3. Lock public-facing plans in trust_plans
-- ============================================================

-- Deactivate killed 'standard' plan (Q1 prototype, replaced 2026-04-29)
UPDATE trust_plans
SET is_active = false,
    tagline   = '[deprecated 2026-04-29 — replaced by Pro/Premium]',
    updated_at = now()
WHERE id = 'standard';

-- Fix Pro annual pricing to locked 20% discount
-- $49.99/mo monthly · $39.99/mo annual ($479.88/yr = 47988 cents)
UPDATE trust_plans
SET annual_price_cents = 47988,
    tagline = '50 credits/mo · Deep Dive included · 20% off annual ($39.99/mo)',
    updated_at = now()
WHERE id = 'pro';

-- Insert Premium ($100/mo · $80/mo annual ($960/yr = 96000 cents))
INSERT INTO trust_plans (
  id, display_name, tagline,
  monthly_credits, monthly_price_cents, annual_price_cents,
  allows_deep_dive, sort_order, is_active
) VALUES (
  'premium',
  'Premium',
  '150 credits/mo · Deep Dive + Forensic · Watch + alerts · 20% off annual ($80/mo)',
  150, 10000, 96000,
  true, 3, true
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tagline = EXCLUDED.tagline,
  monthly_credits = EXCLUDED.monthly_credits,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  annual_price_cents = EXCLUDED.annual_price_cents,
  allows_deep_dive = EXCLUDED.allows_deep_dive,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Insert Enterprise (sentinel pricing — UI renders "Talk to us" for price=0 + id=enterprise)
INSERT INTO trust_plans (
  id, display_name, tagline,
  monthly_credits, monthly_price_cents, annual_price_cents,
  allows_deep_dive, sort_order, is_active
) VALUES (
  'enterprise',
  'Enterprise',
  'Custom volume · API access · SLA · dedicated support — talk to us',
  0, 0, 0,
  true, 4, true
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tagline = EXCLUDED.tagline,
  monthly_credits = EXCLUDED.monthly_credits,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  annual_price_cents = EXCLUDED.annual_price_cents,
  allows_deep_dive = EXCLUDED.allows_deep_dive,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

COMMIT;
