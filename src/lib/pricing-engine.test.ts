// src/lib/pricing-engine.test.ts
import { describe, it, expect } from 'vitest'
import { buildPriceQuote, PricingError } from './pricing-engine'
import type { SupplierOffering, Promotion } from '@/types'

const baseOffering: SupplierOffering = {
  id: 'off-1',
  supply_yard_id: 'yard-1',
  material_catalog_id: 'mat-1',
  supplier_material_name: 'Fill Dirt',
  supplier_description: null,
  unit: 'ton',
  price_per_unit: 12.00,
  minimum_order_quantity: 14,
  typical_load_size: 14,
  load_size_label: '14-ton load',
  is_available: true,
  available_for_delivery: true,
  available_for_pickup: false,
  stock_notes: null,
  delivery_fee_base: 95.00,
  delivery_fee_per_mile: 3.50,
  max_delivery_miles: 60,
  availability_confidence: 90,
  last_verified_at: new Date().toISOString(),
  daily_capacity_estimate: null,
  is_public: true,
  image_url: null,
  is_featured: false,
  sort_order: 0,
  internal_notes: null,
  data_source: 'manual',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const baseCtx = {
  offering: baseOffering,
  fulfillment_method: 'delivery' as const,
  delivery_type: 'asap' as const,
  market_material_id: 'mm-1',
  distance_miles: 10,
}

describe('buildPriceQuote', () => {
  describe('basic calculations', () => {
    it('calculates subtotal, delivery, platform fee, and total correctly', () => {
      const q = buildPriceQuote({ ...baseCtx, quantity: 14 })

      expect(q.price_per_unit).toBe(12.00)
      expect(q.subtotal).toBe(168.00)        // 12 × 14
      expect(q.delivery_fee).toBe(95.00)     // base fee; 10mi = 0 billable miles
      expect(q.platform_fee).toBe(           // 9% of (168 + 95)
        Math.round((168 + 95) * 0.09 * 100) / 100
      )
      expect(q.promotion_discount).toBe(0)
      expect(q.tax_amount).toBe(0)
      expect(q.total_amount).toBe(
        q.subtotal + q.delivery_fee + q.platform_fee
      )
    })

    it('applies per-mile fee beyond free miles threshold', () => {
      // 20 miles: 10 billable × $3.50 = $35 extra → $130 total delivery
      const q = buildPriceQuote({ ...baseCtx, quantity: 14, distance_miles: 20 })
      expect(q.delivery_fee).toBe(130.00)
    })

    it('correctly handles 0 billable miles at exact threshold', () => {
      const q = buildPriceQuote({ ...baseCtx, quantity: 14, distance_miles: 10 })
      expect(q.delivery_fee).toBe(95.00)
    })

    it('uses custom platform fee rate', () => {
      const q = buildPriceQuote({
        ...baseCtx, quantity: 14,
        platform_fee_rate: 0.05,
      })
      expect(q.platform_fee).toBe(Math.round((168 + 95) * 0.05 * 100) / 100)
    })
  })

  describe('minimum order enforcement', () => {
    it('throws PricingError when quantity below minimum', () => {
      expect(() =>
        buildPriceQuote({ ...baseCtx, quantity: 5 })
      ).toThrow(PricingError)

      expect(() =>
        buildPriceQuote({ ...baseCtx, quantity: 5 })
      ).toThrow('Minimum order is 14 tons')
    })

    it('passes at exact minimum order quantity', () => {
      expect(() =>
        buildPriceQuote({ ...baseCtx, quantity: 14 })
      ).not.toThrow()
    })
  })

  describe('delivery distance validation', () => {
    it('throws when distance exceeds max_delivery_miles', () => {
      expect(() =>
        buildPriceQuote({ ...baseCtx, quantity: 14, distance_miles: 100 })
      ).toThrow(PricingError)
    })

    it('throws when delivery_type is delivery but distance_miles is missing', () => {
      expect(() =>
        buildPriceQuote({
          offering: baseOffering,
          quantity: 14,
          fulfillment_method: 'delivery',
          delivery_type: 'asap',
          market_material_id: 'mm-1',
          // no distance_miles
        })
      ).toThrow(PricingError)
    })

    it('does not require distance_miles for pickup', () => {
      const pickupOffering = {
        ...baseOffering,
        available_for_pickup: true,
        delivery_fee_base: null,
      }
      expect(() =>
        buildPriceQuote({
          offering: pickupOffering,
          quantity: 14,
          fulfillment_method: 'pickup',
          delivery_type: 'asap',
          market_material_id: 'mm-1',
        })
      ).not.toThrow()
    })
  })

  describe('promotion handling', () => {
    const makePromo = (overrides: Partial<Promotion>): Promotion => ({
      id: 'promo-1',
      created_by: null,
      market_id: null,
      supplier_id: null,
      offering_id: 'off-1',
      material_catalog_id: null,
      title: 'Test Promo',
      description: null,
      badge_label: 'DEAL',
      is_deal_of_day: false,
      promotion_type: 'percentage',
      discount_value: 10,
      override_price: null,
      min_order_amount: null,
      max_uses: null,
      current_uses: 0,
      starts_at: new Date(Date.now() - 1000).toISOString(),
      ends_at: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    })

    it('applies percentage discount to subtotal', () => {
      const promo = makePromo({ discount_value: 10 })
      const q = buildPriceQuote({ ...baseCtx, quantity: 14, promotion: promo })
      expect(q.promotion_discount).toBe(16.80) // 10% of 168
      expect(q.total_amount).toBeLessThan(
        buildPriceQuote({ ...baseCtx, quantity: 14 }).total_amount
      )
    })

    it('applies flat amount discount', () => {
      const promo = makePromo({ promotion_type: 'flat_amount', discount_value: 25 })
      const q = buildPriceQuote({ ...baseCtx, quantity: 14, promotion: promo })
      expect(q.promotion_discount).toBe(25)
    })

    it('caps flat discount at subtotal', () => {
      const promo = makePromo({ promotion_type: 'flat_amount', discount_value: 10000 })
      const q = buildPriceQuote({ ...baseCtx, quantity: 14, promotion: promo })
      expect(q.promotion_discount).toBe(168) // capped at subtotal
    })

    it('applies price_override to per-unit price', () => {
      const promo = makePromo({ promotion_type: 'price_override', override_price: 9.50 })
      const q = buildPriceQuote({ ...baseCtx, quantity: 14, promotion: promo })
      expect(q.price_per_unit).toBe(9.50)
      expect(q.subtotal).toBe(133.00)       // 9.50 × 14
      expect(q.promotion_discount).toBe(0)  // no separate discount
    })

    it('respects min_order_amount', () => {
      const promo = makePromo({ min_order_amount: 500 }) // subtotal is 168, below 500
      const q = buildPriceQuote({ ...baseCtx, quantity: 14, promotion: promo })
      expect(q.promotion_discount).toBe(0)
    })
  })

  describe('review threshold flag', () => {
    it('does not flag orders below threshold', () => {
      const q = buildPriceQuote({ ...baseCtx, quantity: 14 })
      expect(q.needs_review).toBe(false)
      expect(q.review_reason).toBeNull()
    })

    it('flags large orders above threshold', () => {
      // 200 tons × $12 = $2400 + delivery + fees > $2500
      const q = buildPriceQuote({ ...baseCtx, quantity: 200, distance_miles: 15 })
      expect(q.needs_review).toBe(true)
      expect(q.review_reason).toContain('review threshold')
    })
  })

  describe('line items', () => {
    it('includes material line item always', () => {
      const q = buildPriceQuote({ ...baseCtx, quantity: 14 })
      expect(q.line_items.some(li => li.type === 'material')).toBe(true)
    })

    it('includes delivery line item for delivery orders', () => {
      const q = buildPriceQuote({ ...baseCtx, quantity: 14 })
      expect(q.line_items.some(li => li.type === 'delivery')).toBe(true)
    })

    it('includes negative discount line item when promotion applied', () => {
      const promo: Promotion = {
        id: 'p1', created_by: null, market_id: null, supplier_id: null,
        offering_id: 'off-1', material_catalog_id: null,
        title: '10% Off', description: null, badge_label: null,
        is_deal_of_day: false, promotion_type: 'percentage', discount_value: 10,
        override_price: null, min_order_amount: null, max_uses: null,
        current_uses: 0, starts_at: new Date().toISOString(), ends_at: null,
        is_active: true, created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const q = buildPriceQuote({ ...baseCtx, quantity: 14, promotion: promo })
      const discountItem = q.line_items.find(li => li.type === 'discount')
      expect(discountItem).toBeDefined()
      expect(discountItem!.amount).toBeLessThan(0)
    })
  })
})
