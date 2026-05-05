// src/lib/best-offering.ts
// Pick the best offering for a given customer + material across multiple yards.
//
// Selection rule (option 1.b — customer-cheapest with margin tie-break):
//   1. Compute delivered $/unit for each qualifying offering at the customer's zip.
//   2. Drop offerings outside the service area.
//   3. Among the remaining, find the minimum delivered price.
//   4. Tie-break: among offerings whose delivered price is within
//      TIE_BREAK_PER_UNIT of that minimum, prefer the one with the highest
//      price_per_unit (highest absolute margin given the constant 20% markup).
//
// The tie-break is intentionally tight (50¢/unit) so the customer-cheapest
// promise stays load-bearing — it only redirects volume between yards that
// look identically priced to the customer.

import { getDeliveredPerUnitPrice } from '@/lib/pricing-engine'
import { resolveDriveMinutes } from '@/lib/eta'

const TIE_BREAK_PER_UNIT = 0.5

export interface BestOfferingInput {
  /** Offering identity — opaque to the picker but returned in the result. */
  id: string
  /** Yard identity + coords; needed by resolveDriveMinutes. */
  yardId: string
  yardLat: number | null
  yardLng: number | null
  /** Pricing fields read by getDeliveredPerUnitPrice. */
  pricePerUnit: number
  deliveryFeeBase: number | null
  deliveryFeePerMile: number | null
  maxDeliveryMiles: number | null
  typicalLoadSize: number | null
}

export interface BestOfferingResult {
  offering: BestOfferingInput
  deliveredPerUnit: number
  miles: number | null
  driveMinutes: number | null
}

/**
 * Pick the best (cheapest delivered, margin-tie-broken) offering for a
 * customer at `customerZip`. When `customerZip` is null, falls back to the
 * cheapest by base price_per_unit.
 */
export async function pickBestOffering(
  offerings: BestOfferingInput[],
  customerZip: string | null,
): Promise<BestOfferingResult | null> {
  if (offerings.length === 0) return null

  // No zip → can't compute delivered; pick cheapest base price as a stand-in.
  if (!customerZip || !/^\d{5}$/.test(customerZip)) {
    const cheapest = offerings.reduce((a, b) => (a.pricePerUnit <= b.pricePerUnit ? a : b))
    return { offering: cheapest, deliveredPerUnit: cheapest.pricePerUnit, miles: null, driveMinutes: null }
  }

  // Resolve drive time once per unique yard (multiple offerings can share a yard).
  const uniqueYards = new Map<string, { lat: number; lng: number }>()
  for (const o of offerings) {
    if (uniqueYards.has(o.yardId)) continue
    if (typeof o.yardLat !== 'number' || typeof o.yardLng !== 'number') continue
    uniqueYards.set(o.yardId, { lat: o.yardLat, lng: o.yardLng })
  }

  const driveByYard = new Map<string, { miles: number; minutes: number }>()
  await Promise.all(
    Array.from(uniqueYards.entries()).map(async ([yardId, { lat, lng }]) => {
      const dt = await resolveDriveMinutes(customerZip, { yard_id: yardId, lat, lng }).catch(() => null)
      if (dt) driveByYard.set(yardId, { miles: dt.miles, minutes: dt.minutes })
    })
  )

  type Scored = BestOfferingResult & { offering: BestOfferingInput }
  const scored: Scored[] = []
  for (const o of offerings) {
    const dt = driveByYard.get(o.yardId)
    if (!dt) continue
    const delivered = getDeliveredPerUnitPrice(
      {
        price_per_unit: o.pricePerUnit,
        delivery_fee_base: o.deliveryFeeBase,
        delivery_fee_per_mile: o.deliveryFeePerMile,
        max_delivery_miles: o.maxDeliveryMiles,
        typical_load_size: o.typicalLoadSize,
      },
      dt.miles,
      { driveMinutes: dt.minutes },
    )
    if (delivered == null) continue // outside service area
    scored.push({ offering: o, deliveredPerUnit: delivered, miles: dt.miles, driveMinutes: dt.minutes })
  }

  if (scored.length === 0) return null

  // Cheapest delivered.
  const minDelivered = scored.reduce((m, s) => Math.min(m, s.deliveredPerUnit), Infinity)

  // Tie-break: among offerings within TIE_BREAK_PER_UNIT of min, prefer
  // highest pricePerUnit (highest absolute margin under constant markup).
  const ties = scored.filter((s) => s.deliveredPerUnit - minDelivered <= TIE_BREAK_PER_UNIT)
  ties.sort((a, b) => b.offering.pricePerUnit - a.offering.pricePerUnit)
  return ties[0]
}
