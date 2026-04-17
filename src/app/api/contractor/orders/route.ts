import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveContractorAccess, isAuthorized } from '@/lib/contractor/access'
import { submitOrder } from '@/lib/services/place-order.service'

const BodySchema = z.object({
  draft_id: z.string().uuid().optional().nullable(),
  material_catalog_id: z.string().uuid(),
  supplier_offering_id: z.string().uuid(),
  supply_yard_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.enum(['ton', 'cuyd']),
  delivery_address_id: z.string().uuid(),
  project_id: z.string().uuid().optional().nullable(),
  requested_delivery_date: z.string().optional().nullable(),
  delivery_notes: z.string().max(1000).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await resolveContractorAccess(supabase)
  if (ctx.access === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAuthorized(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!ctx.permissions.can_place_orders) {
    return NextResponse.json({ error: 'Not permitted to place orders' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  // Resolve market_id from supply_yard
  const admin = createAdminClient()
  const { data: yard } = await admin
    .from('supply_yards').select('market_id').eq('id', parsed.data.supply_yard_id).maybeSingle()
  if (!yard?.market_id) {
    return NextResponse.json({ error: 'Supply yard has no market' }, { status: 422 })
  }

  try {
    const res = await submitOrder({
      placed_by_profile_id: ctx.userId,
      market_id: yard.market_id,
      material_catalog_id: parsed.data.material_catalog_id,
      supplier_offering_id: parsed.data.supplier_offering_id,
      supply_yard_id: parsed.data.supply_yard_id,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      delivery_address_id: parsed.data.delivery_address_id,
      project_id: parsed.data.project_id ?? null,
      requested_delivery_date: parsed.data.requested_delivery_date ?? null,
      delivery_notes: parsed.data.delivery_notes ?? null,
      spend_limit_cents: ctx.permissions.spend_limit_cents,
    })

    if (parsed.data.draft_id) {
      await supabase.from('order_drafts').delete().eq('id', parsed.data.draft_id).eq('profile_id', ctx.userId)
    }

    return NextResponse.json(res)
  } catch (err: any) {
    console.error('[contractor/orders] error:', err)
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}
