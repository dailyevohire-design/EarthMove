// src/lib/pricing-engine.ts
// Server-side only. Never import from client components.

import type {
  SupplierOffering,
  Promotion,
  PriceQuote,
  QuoteLineItem,
  FulfillmentMethod,
  DeliveryType,
  MaterialUnit,
} from '@/types'

// ── Constants ─────────────────────────────────────────────────

const DEFAULT_PLATFORM_FEE_RATE = 0.09
const DEFAULT_FREE_DELIVERY_MILES = 10
const REVIEW_THRESHOLD_DOLLARS = 2500  // auto-flag orders above this amount

// ── Error ─────────────────────────────────────────────────────

export class PricingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PricingError'
  }
}

// ── Input/Output ──────────────────────────────────────────────

export interface PricingContext {
  offering: SupplierOffering
  quantity: number
  fulfillment_method: FulfillmentMethod
  delivery_type: DeliveryType
  market_material_id: string
  distance_miles?: number
  promotion?: Promotion | null
  platform_fee_rate?: number
  free_delivery_miles?: number
}

export interface PriceQuoteWithFlags extends PriceQuote {
  needs_review: boolean
  review_reason: string | null
}

// ── Main ──────────────────────────────────────────────────────

export function buildPriceQuote(ctx: PricingContext): PriceQuoteWithFlags {
  const {
    offering,
    quantity,
    fulfillment_method,
    delivery_type,
    market_material_id,
    distance_miles,
    promotion = null,
    platform_fee_rate = DEFAULT_PLATFORM_FEE_RATE,
    free_delivery_miles = DEFAULT_FREE_DELIVERY_MILES,
  } = ctx

  // ── Validation ────────────────────────────────────────────

  if (quantity < offering.minimum_order_quantity) {
    throw new PricingError(
      `Minimum order is ${offering.minimum_order_quantity} ${unitLabel(offering.unit, offering.minimum_order_quantity)}.`
    )
  }

  if (!offering.is_available) {
    throw new PricingError('This material is currently unavailable.')
  }

  if (fulfillment_method === 'delivery' && !offering.available_for_delivery) {
    throw new PricingError('This material is not available for delivery.')
  }

  if (fulfillment_method === 'pickup' && !offering.available_for_pickup) {
    throw new PricingError('This material is not available for pickup.')
  }

  if (fulfillment_method === 'delivery' && distance_miles == null) {
    throw new PricingError('Delivery distance is required to calculate delivery pricing.')
  }

  // ── Price computation ──────────────────────────────────────

  // Effective unit price (promotion may override)
  const pricePerUnit = getEffectivePricePerUnit(offering, promotion)

  // Subtotal
  const subtotal = round(pricePerUnit * quantity)

  // Delivery fee
  let deliveryFee = 0
  if (fulfillment_method === 'delivery' && distance_miles != null) {
    deliveryFee = computeDeliveryFee(offering, distance_miles, free_delivery_miles)
  }

  // Promotion discount (percentage or flat — applied to subtotal)
  const promotionDiscount = computePromotionDiscount(promotion, subtotal)

  // Platform fee: applied to (subtotal + delivery), before discount
  const platformFee = round((subtotal + deliveryFee) * platform_fee_rate)

  // Tax: TX construction aggregates are sales-tax exempt. Zero for now.
  // TODO: make market-configurable when expanding to other states.
  const taxAmount = 0

  const totalAmount = round(
    subtotal + deliveryFee + platformFee - promotionDiscount + taxAmount
  )

  // ── Line items ────────────────────────────────────────────

  const lineItems: QuoteLineItem[] = [
    {
      label: `${offering.supplier_material_name ?? 'Material'} × ${quantity} ${unitLabel(offering.unit, quantity)}`,
      amount: subtotal,
      type: 'material',
    },
  ]

  if (deliveryFee > 0) {
    lineItems.push({ label: 'Delivery', amount: deliveryFee, type: 'delivery' })
  }

  if (platformFee > 0) {
    lineItems.push({ label: 'Service fee', amount: platformFee, type: 'fee' })
  }

  if (promotionDiscount > 0) {
    lineItems.push({
      label: promotion?.title ?? 'Discount',
      amount: -promotionDiscount,
      type: 'discount',
    })
  }

  if (taxAmount > 0) {
    lineItems.push({ label: 'Tax', amount: taxAmount, type: 'tax' })
  }

  // ── Review flag ───────────────────────────────────────────

  const needsReview = totalAmount > REVIEW_THRESHOLD_DOLLARS
  const reviewReason = needsReview
    ? `Order total ${formatCurrency(totalAmount)} exceeds review threshold of ${formatCurrency(REVIEW_THRESHOLD_DOLLARS)}.`
    : null

  return {
    market_material_id,
    offering_id: offering.id,
    quantity,
    unit: offering.unit,
    price_per_unit: pricePerUnit,
    subtotal,
    delivery_fee: deliveryFee,
    platform_fee: platformFee,
    promotion_discount: promotionDiscount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    promotion_id: promotion?.id ?? null,
    promotion_title: promotion?.title ?? null,
    fulfillment_method,
    delivery_type,
    line_items: lineItems,
    needs_review: needsReview,
    review_reason: reviewReason,
  }
}

// ── Helpers ───────────────────────────────────────────────────

function getEffectivePricePerUnit(
  offering: SupplierOffering,
  promotion: Promotion | null
): number {
  if (
    promotion?.promotion_type === 'price_override' &&
    promotion.override_price != null
  ) {
    return promotion.override_price
  }
  return offering.price_per_unit
}

function computeDeliveryFee(
  offering: SupplierOffering,
  distanceMiles: number,
  freeDeliveryMiles: number
): number {
  if (!offering.delivery_fee_base) return 0

  const maxMiles = offering.max_delivery_miles ?? 60
  if (distanceMiles > maxMiles) {
    throw new PricingError(
      `Delivery address is outside the ${maxMiles}-mile service area for this material.`
    )
  }

  const billableMiles = Math.max(0, distanceMiles - freeDeliveryMiles)
  const perMileRate = offering.delivery_fee_per_mile ?? 0
  return round(offering.delivery_fee_base + billableMiles * perMileRate)
}

function computePromotionDiscount(
  promotion: Promotion | null,
  subtotal: number
): number {
  if (!promotion) return 0
  if (promotion.min_order_amount && subtotal < promotion.min_order_amount) return 0

  switch (promotion.promotion_type) {
    case 'percentage':
      return round(subtotal * ((promotion.discount_value ?? 0) / 100))
    case 'flat_amount':
      return Math.min(promotion.discount_value ?? 0, subtotal)
    case 'price_override':
      return 0 // handled at price_per_unit level
    default:
      return 0
  }
}

// ── Display utilities (shared server + client) ─────────────────

export function unitLabel(unit: MaterialUnit, qty: number): string {
  const map: Record<MaterialUnit, [string, string]> = {
    ton:        ['ton', 'tons'],
    cubic_yard: ['cubic yard', 'cubic yards'],
    load:       ['load', 'loads'],
    each:       ['unit', 'units'],
  }
  const [singular, plural] = map[unit]
  return qty === 1 ? singular : plural
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function round(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Derive display price for a market material card.
 * Called server-side when building the catalog page.
 */
export function deriveDisplayPrice(
  mode: string,
  customPrice: number | null,
  preferredOffering: SupplierOffering | null
): number | null {
  if (mode === 'custom' && customPrice != null) return customPrice
  if (mode === 'exact' && preferredOffering) return preferredOffering.price_per_unit
  return null
}
