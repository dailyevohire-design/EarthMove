-- 233_orders_delivery_window_constraints.sql
--
-- MCP-applied 2026-05-11. Documents two new CHECK constraints on orders:
--
--   valid_delivery_window      — requested_delivery_window must be null OR one
--                                of the three canonical V2 picker values.
--   scheduled_requires_window  — companion to existing scheduled_requires_date.
--                                When delivery_type='scheduled', both date AND
--                                window must be set.
--
-- Canonical window values (lowercase, hyphenated, no spaces):
--   '9-10am' → display "9–10 AM"
--   '1-2pm'  → display "1–2 PM"
--   '4-5pm'  → display "4–5 PM"
--
-- Existing asap orders are unaffected: requested_delivery_window stays nullable
-- on the asap path. The 14 historical orders in the table (all asap, all null
-- window) pass both new constraints unchanged.
--
-- Idempotent. DROP IF EXISTS + ADD pattern. Safe to re-run against any state.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS valid_delivery_window;
ALTER TABLE orders ADD CONSTRAINT valid_delivery_window
  CHECK (
    requested_delivery_window IS NULL
    OR requested_delivery_window IN ('9-10am', '1-2pm', '4-5pm')
  );

ALTER TABLE orders DROP CONSTRAINT IF EXISTS scheduled_requires_window;
ALTER TABLE orders ADD CONSTRAINT scheduled_requires_window
  CHECK (
    delivery_type <> 'scheduled'::delivery_type
    OR requested_delivery_window IS NOT NULL
  );
