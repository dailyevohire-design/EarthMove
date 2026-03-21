-- Allow public to read active pool entries (needed for price resolution on browse)
CREATE POLICY "pool_public_read" ON market_supply_pool FOR SELECT USING (is_active = true);

-- Allow public to read public, available offerings (needed for price display)
CREATE POLICY "offerings_public_read" ON supplier_offerings FOR SELECT USING (is_public = true AND is_available = true);
