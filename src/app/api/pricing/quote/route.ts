import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { resolveOffering, FulfillmentError } from '@/lib/fulfillment-resolver'
import { buildPriceQuote, PricingError } from '@/lib/pricing-engine'

const Schema = z.object({
  market_id:           z.string().uuid(),
  material_catalog_id: z.string().uuid(),
  quantity:            z.number().positive().max(10000),
  fulfillment_method:  z.enum(['delivery', 'pickup']).default('delivery'),
  delivery_type:       z.enum(['asap', 'scheduled']).default('asap'),
  distance_miles:      z.number().min(0).max(500).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 422 })
  }

  const input = parsed.data

  try {
    const resolved = await resolveOffering(input.market_id, input.material_catalog_id)
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    // Active promotion
    const { data: promo } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', now)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .or(`material_catalog_id.eq.${input.material_catalog_id},offering_id.eq.${resolved.offering.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Platform fee
    const { data: feeRule } = await supabase
      .from('pricing_rules')
      .select('config')
      .eq('rule_type', 'platform_fee')
      .eq('is_active', true)
      .or(`market_id.eq.${input.market_id},market_id.is.null`)
      .order('market_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    const platformFeeRate = feeRule?.config?.value ? feeRule.config.value / 100 : 0.09

    const quote = buildPriceQuote({
      offering:           resolved.offering,
      quantity:           input.quantity,
      fulfillment_method: input.fulfillment_method,
      delivery_type:      input.delivery_type,
      market_material_id: resolved.market_material.id,
      distance_miles:     input.distance_miles,
      promotion:          promo ?? null,
      platform_fee_rate:  platformFeeRate,
    })

    return NextResponse.json({ success: true, data: quote })
  } catch (err) {
    if (err instanceof FulfillmentError || err instanceof PricingError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 })
    }
    console.error('[/api/pricing/quote]', err)
    return NextResponse.json({ success: false, error: 'Failed to generate quote.' }, { status: 500 })
  }
}
