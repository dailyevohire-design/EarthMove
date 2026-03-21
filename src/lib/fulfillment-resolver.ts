// src/lib/fulfillment-resolver.ts
// Server-side only.

import { createAdminClient } from '@/lib/supabase/server'
import type {
  ResolvedFulfillment,
  MarketMaterial,
  MarketSupplyPool,
  SupplierOffering,
  SupplyYard,
  Supplier,
} from '@/types'

// ── Error ─────────────────────────────────────────────────────

export class FulfillmentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'MARKET_MATERIAL_NOT_FOUND'
      | 'MATERIAL_UNAVAILABLE'
      | 'NO_POOL_ENTRIES'
      | 'POOL_EXHAUSTED'
  ) {
    super(message)
    this.name = 'FulfillmentError'
  }
}

// ── Resolver ─────────────────────────────────────────────────

/**
 * Given a market and canonical material, finds the best available
 * supplier offering from the supply pool.
 *
 * Selection order:
 *   1. is_preferred = true AND offering is available
 *   2. is_fallback = true AND offering is available
 *   3. Highest composite_score AND offering is available
 *
 * Scores are pre-computed (not recalculated per request).
 */
export async function resolveOffering(
  market_id: string,
  material_catalog_id: string
): Promise<ResolvedFulfillment> {
  const supabase = createAdminClient()

  // Step 1: Find market material record
  const { data: marketMaterial } = await supabase
    .from('market_materials')
    .select('*, material:material_catalog(*, category:material_categories(*))')
    .eq('market_id', market_id)
    .eq('material_catalog_id', material_catalog_id)
    .single()

  if (!marketMaterial) {
    throw new FulfillmentError(
      'This material is not available in your area.',
      'MARKET_MATERIAL_NOT_FOUND'
    )
  }

  if (!marketMaterial.is_visible || !marketMaterial.is_available) {
    throw new FulfillmentError(
      marketMaterial.unavailable_reason ?? 'This material is temporarily unavailable.',
      'MATERIAL_UNAVAILABLE'
    )
  }

  // Step 2: Fetch pool — preferred first, then fallback, then by composite score
  const { data: poolEntries } = await supabase
    .from('market_supply_pool')
    .select(`
      *,
      offering:supplier_offerings(
        *,
        supply_yard:supply_yards(
          *,
          supplier:suppliers(
            *,
            performance:supplier_performance(*)
          )
        )
      )
    `)
    .eq('market_material_id', marketMaterial.id)
    .eq('is_active', true)
    .order('is_preferred', { ascending: false })
    .order('is_fallback', { ascending: false })
    .order('composite_score', { ascending: false })

  if (!poolEntries || poolEntries.length === 0) {
    throw new FulfillmentError(
      'No suppliers are currently available for this material.',
      'NO_POOL_ENTRIES'
    )
  }

  // Step 3: Walk pool in priority order, find first available
  let selected: typeof poolEntries[0] | null = null

  for (const entry of poolEntries) {
    const o = entry.offering as SupplierOffering & {
      supply_yard: SupplyYard & { supplier: Supplier }
    }

    if (!o) continue
    if (!o.is_available || !o.available_for_delivery) continue
    if (!o.is_public) continue
    if (!o.supply_yard?.is_active) continue
    if (o.supply_yard.supplier?.status !== 'active') continue

    selected = entry
    break
  }

  if (!selected) {
    // Log pool exhaustion for admin visibility
    await supabase.from('audit_events').insert({
      event_type:  'fulfillment.pool_exhausted',
      entity_type: 'market_materials',
      entity_id:   marketMaterial.id,
      actor_role:  'admin',
      payload: {
        market_id,
        material_catalog_id,
        pool_size: poolEntries.length,
      },
    })

    throw new FulfillmentError(
      'All suppliers for this material are currently unavailable. Please try again later.',
      'POOL_EXHAUSTED'
    )
  }

  const offering = selected.offering as SupplierOffering
  const supplyYard = (offering as any).supply_yard as SupplyYard
  const supplier = (supplyYard as any).supplier as Supplier

  return {
    market_material: marketMaterial as MarketMaterial,
    pool_entry: selected as MarketSupplyPool,
    offering,
    supply_yard: supplyYard,
    supplier,
  }
}

// ── Score recalculation ───────────────────────────────────────

/**
 * Recalculates composite scores for all entries in a pool.
 * Called by: admin save, import approval, background job.
 * NOT called per-request.
 */
export async function recalculatePoolScores(
  market_material_id: string
): Promise<void> {
  const supabase = createAdminClient()

  const { data: entries } = await supabase
    .from('market_supply_pool')
    .select(`
      id, admin_override_score,
      weight_price, weight_distance, weight_reliability, weight_availability,
      offering:supplier_offerings(
        price_per_unit, availability_confidence,
        supply_yard:supply_yards(
          lat, lng,
          market:markets(center_lat, center_lng),
          supplier:suppliers(
            performance:supplier_performance(performance_score)
          )
        )
      )
    `)
    .eq('market_material_id', market_material_id)
    .eq('is_active', true)

  if (!entries || entries.length === 0) return

  // Compute price range across pool for relative scoring
  const prices: number[] = entries
    .map((e: any) => e.offering?.price_per_unit)
    .filter((p: any): p is number => typeof p === 'number')

  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const priceRange = maxPrice - minPrice || 1

  for (const entry of entries as any[]) {
    // Admin override pins the score
    if (entry.admin_override_score != null) {
      await supabase.from('market_supply_pool').update({
        composite_score:      entry.admin_override_score,
        scores_calculated_at: new Date().toISOString(),
      }).eq('id', entry.id)
      continue
    }

    const offering = entry.offering
    const yard = offering?.supply_yard
    const market = yard?.market
    const perfScore = yard?.supplier?.performance?.performance_score ?? 75

    // Price score: lower price = higher score (inverted, 0–100)
    const priceScore = offering
      ? Math.round(100 - ((offering.price_per_unit - minPrice) / priceRange) * 100)
      : 50

    // Distance score: based on haversine distance from market center
    const distanceScore = computeDistanceScore(
      yard?.lat, yard?.lng,
      market?.center_lat, market?.center_lng
    )

    // Reliability score: from supplier_performance
    const reliabilityScore = perfScore

    // Availability score: from offering.availability_confidence
    const availabilityScore = offering?.availability_confidence ?? 75

    const composite = Math.round(
      priceScore        * entry.weight_price +
      distanceScore     * entry.weight_distance +
      reliabilityScore  * entry.weight_reliability +
      availabilityScore * entry.weight_availability
    )

    await supabase.from('market_supply_pool').update({
      price_score:          priceScore,
      distance_score:       distanceScore,
      reliability_score:    reliabilityScore,
      availability_score:   availabilityScore,
      composite_score:      clamp(composite, 0, 100),
      scores_calculated_at: new Date().toISOString(),
    }).eq('id', entry.id)
  }
}

// ── Performance scoring ───────────────────────────────────────

export function computePerformanceScore(metrics: {
  on_time_rate: number
  cancellation_rate: number
  avg_response_hours: number
  total_orders: number
}): number {
  // Not enough data — return default
  if (metrics.total_orders < 5) return 75

  const onTimeComponent       = metrics.on_time_rate * 0.50
  const cancellationComponent = Math.max(0, 100 - metrics.cancellation_rate * 10) * 0.30
  const responseComponent     = Math.max(0, 100 - metrics.avg_response_hours * 5) * 0.20

  return clamp(
    Math.round(onTimeComponent + cancellationComponent + responseComponent),
    0, 100
  )
}

// ── Utilities ─────────────────────────────────────────────────

function computeDistanceScore(
  yardLat?: number | null,
  yardLng?: number | null,
  marketLat?: number | null,
  marketLng?: number | null
): number {
  if (!yardLat || !yardLng || !marketLat || !marketLng) return 75

  const R = 3959
  const dLat = toRad(marketLat - yardLat)
  const dLng = toRad(marketLng - yardLng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(yardLat)) * Math.cos(toRad(marketLat)) *
    Math.sin(dLng / 2) ** 2
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  if (dist <= 10) return 100
  if (dist <= 25) return 80
  if (dist <= 40) return 60
  if (dist <= 60) return 40
  return 20
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}
