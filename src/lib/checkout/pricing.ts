// Hardcoded v1 pricing. Followup #C3.1 replaces with real query against
// supplier_offerings filtered by supply_yards.market_id + verified_flag.
//
// Cents-based math throughout — Stripe takes cents, we store DB amounts in
// dollars (numeric column), so we divide by 100 only at the persistence
// boundary. Avoids floating-point pricing errors mid-pipeline.

export interface PriceQuote {
  pricePerTonCents: number  // unit price
  subtotalCents: number     // pricePerTonCents * tons (rounded)
  deliveryFeeCents: number  // flat for v1
  totalCents: number        // subtotal + delivery (pre-discount)
  materialName: string
}

// Catalog UUID → { display name, $/ton in cents }. Mirrors the M
// dictionary in material-quiz.tsx but uses a single mid-range price (not a
// range) so the order total is deterministic at session creation.
const PRICE_PER_TON_CENTS: Record<string, { name: string; cents: number }> = {
  '7b0cee52-a89a-4601-98b9-f027c809e529': { name: '#57 Crushed Stone', cents: 4000 },
  '00b032d1-f6b4-406f-bdad-6da3869f7241': { name: 'Road Base',         cents: 2700 },
  'ba7d5c6c-4595-4a3d-ac94-45f0b2003efa': { name: 'Fill Dirt',         cents: 1400 },
  '5914c3ff-a3f9-45f6-8080-edccc1fd7396': { name: 'Topsoil',           cents: 4500 },
}

const DEFAULT_PRICE_PER_TON_CENTS = 3000   // $30/ton fallback for unknown UUID
const FLAT_DELIVERY_FEE_CENTS    = 12500   // $125 flat truckload delivery, single drop

export function quoteOrder(input: {
  material_catalog_id: string | null | undefined
  material_name?: string
  tons: number
}): PriceQuote {
  const found = input.material_catalog_id ? PRICE_PER_TON_CENTS[input.material_catalog_id] : null
  const pricePerTonCents = found?.cents ?? DEFAULT_PRICE_PER_TON_CENTS
  const materialName = found?.name ?? input.material_name ?? 'Bulk Material'
  const subtotalCents = Math.round(pricePerTonCents * input.tons)
  const deliveryFeeCents = FLAT_DELIVERY_FEE_CENTS
  const totalCents = subtotalCents + deliveryFeeCents
  return { pricePerTonCents, subtotalCents, deliveryFeeCents, totalCents, materialName }
}

export const WELCOME5_DISCOUNT_RATE = 0.05  // 5% off subtotal (not delivery fee)

export function computeWelcome5DiscountCents(subtotalCents: number): number {
  return Math.round(subtotalCents * WELCOME5_DISCOUNT_RATE)
}
