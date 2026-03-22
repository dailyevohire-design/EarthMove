-- 007_waitlist.sql
-- Waitlist table for zip codes outside current service areas.

CREATE TABLE waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  zip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_email ON waitlist(email);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public sign-up)
CREATE POLICY "waitlist_insert" ON waitlist FOR INSERT WITH CHECK (true);

-- Only admins can read / update / delete
CREATE POLICY "waitlist_admin" ON waitlist FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
