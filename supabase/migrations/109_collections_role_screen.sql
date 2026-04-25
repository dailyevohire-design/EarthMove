-- 109_collections_role_screen.sql
-- Adds three screen-out values to collections_contractor_role enum to support
-- the intake wizard's screening question, plus extends the existing waitlist
-- table with a waitlist_type discriminator so /api/collections/broker-waitlist
-- can reuse it for the broker-payment notify list.
--
-- All statements are idempotent (IF NOT EXISTS). Avoid wrapping in BEGIN/COMMIT
-- when re-running manually — PG forbids using a freshly-added enum value in
-- the same transaction it was added, which has historically tripped this
-- pattern under some migration runners.

ALTER TYPE collections_contractor_role ADD VALUE IF NOT EXISTS 'hired_by_broker';
ALTER TYPE collections_contractor_role ADD VALUE IF NOT EXISTS 'hired_by_staffing';
ALTER TYPE collections_contractor_role ADD VALUE IF NOT EXISTS 'not_construction_work';

ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS waitlist_type text NOT NULL DEFAULT 'zip_gate';
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_waitlist_type ON waitlist(waitlist_type);
