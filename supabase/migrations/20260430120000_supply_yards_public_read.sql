-- Public read policy for supply_yards.
--
-- Without this policy, anonymous users get zero rows from supply_yards.
-- The /browse, /browse/[slug], and /[city] queries !inner-join supplier_offerings
-- against supply_yards (to filter by market_id), so the join drops every row for
-- non-supplier non-admin users — DFW and Denver browse pages render empty even
-- though the data is there.
--
-- supply_yards holds publicly-discoverable delivery yard locations; nothing
-- sensitive lives on this table. is_active=true gates inactive yards out of
-- the customer surface; suppliers and admins still see their own via the
-- existing yards_supplier_read / yards_admin policies.

DROP POLICY IF EXISTS yards_public_read ON public.supply_yards;
CREATE POLICY yards_public_read ON public.supply_yards
  FOR SELECT
  TO public
  USING (is_active = true);
