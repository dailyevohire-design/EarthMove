import { createAdminClient } from '@/lib/supabase/server'

export type MatchedSupplier = {
  offering_id: string
  supply_yard_id: string
  supplier_id: string
  supplier_name: string
  yard_name: string | null
  yard_city: string | null
  yard_lat: number | null
  yard_lng: number | null
  material_catalog_id: string
  material_name: string
  unit: string
  price_per_unit: number
  price_per_ton: number | null
  price_per_cuyd: number | null
  delivery_fee_base: number | null
  delivery_fee_per_mile: number | null
  max_delivery_miles: number | null
  minimum_order_quantity: number
  last_verified_at: string | null
  verification_status: string
  confidence: number | null     // supplier_offerings.confidence (0-100)
  distance_miles: number | null
  estimated_delivery_fee: number | null
  weighted_score: number
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export async function matchSuppliers(args: {
  material_catalog_id: string
  quantity: number
  unit: 'ton' | 'cuyd'
  destination?: { lat: number; lng: number } | null
  marketId?: string | null
  limit?: number
}): Promise<MatchedSupplier[]> {
  const db = createAdminClient()

  // Destination fallback: market center if none given.
  let dest = args.destination ?? null
  if (!dest && args.marketId) {
    const { data: market } = await db
      .from('markets')
      .select('center_lat, center_lng')
      .eq('id', args.marketId).maybeSingle()
    if (market?.center_lat && market?.center_lng) {
      dest = { lat: Number(market.center_lat), lng: Number(market.center_lng) }
    }
  }

  const { data: rows } = await db
    .from('supplier_offerings')
    .select(`
      id, supply_yard_id, material_catalog_id, unit,
      price_per_unit, price_per_ton, price_per_cuyd,
      delivery_fee_base, delivery_fee_per_mile, max_delivery_miles,
      minimum_order_quantity, last_verified_at, verification_status,
      availability_confidence, confidence,
      is_available, available_for_delivery, is_public,
      supply_yard:supply_yards!inner ( id, supplier_id, name, city, lat, lng, is_active ),
      material:material_catalog!inner ( id, name ),
      supplier:supply_yards!inner ( supplier_id )
    `)
    .eq('material_catalog_id', args.material_catalog_id)
    .eq('is_available', true).eq('available_for_delivery', true)
    .eq('is_public', true)
    .limit(50)

  if (!rows) return []

  const enriched: MatchedSupplier[] = []
  for (const r of rows as any[]) {
    if (!r.supply_yard?.is_active) continue
    if (r.minimum_order_quantity && args.quantity < Number(r.minimum_order_quantity)) continue

    const yLat = r.supply_yard?.lat ? Number(r.supply_yard.lat) : null
    const yLng = r.supply_yard?.lng ? Number(r.supply_yard.lng) : null

    let distance: number | null = null
    if (dest && yLat != null && yLng != null) {
      distance = Math.round(haversine(dest.lat, dest.lng, yLat, yLng) * 10) / 10
      if (r.max_delivery_miles && distance > Number(r.max_delivery_miles)) continue
    }

    const deliveryFee = distance != null && r.delivery_fee_per_mile != null
      ? Math.round((Number(r.delivery_fee_base ?? 0) + Number(r.delivery_fee_per_mile) * distance) * 100) / 100
      : (r.delivery_fee_base != null ? Number(r.delivery_fee_base) : null)

    const supplierName = await resolveSupplierName(r.supply_yard.supplier_id)

    const confidence = r.confidence != null ? Number(r.confidence) : (r.availability_confidence ?? 75)
    const trustPenalty = 1 + (1 - Math.min(100, Math.max(0, confidence)) / 100) * 0.2
    const price = Number(r.price_per_unit)
    const weighted = price * trustPenalty + (distance ?? 0) * 0.05

    enriched.push({
      offering_id: r.id,
      supply_yard_id: r.supply_yard_id,
      supplier_id: r.supply_yard.supplier_id,
      supplier_name: supplierName,
      yard_name: r.supply_yard?.name ?? null,
      yard_city: r.supply_yard?.city ?? null,
      yard_lat: yLat, yard_lng: yLng,
      material_catalog_id: r.material_catalog_id,
      material_name: r.material?.name ?? '',
      unit: r.unit,
      price_per_unit: price,
      price_per_ton: r.price_per_ton != null ? Number(r.price_per_ton) : null,
      price_per_cuyd: r.price_per_cuyd != null ? Number(r.price_per_cuyd) : null,
      delivery_fee_base: r.delivery_fee_base != null ? Number(r.delivery_fee_base) : null,
      delivery_fee_per_mile: r.delivery_fee_per_mile != null ? Number(r.delivery_fee_per_mile) : null,
      max_delivery_miles: r.max_delivery_miles != null ? Number(r.max_delivery_miles) : null,
      minimum_order_quantity: Number(r.minimum_order_quantity ?? 1),
      last_verified_at: r.last_verified_at ?? null,
      verification_status: r.verification_status ?? 'unverified',
      confidence,
      distance_miles: distance,
      estimated_delivery_fee: deliveryFee,
      weighted_score: Math.round(weighted * 100) / 100,
    })
  }

  enriched.sort((a, b) => a.weighted_score - b.weighted_score)
  return enriched.slice(0, args.limit ?? 3)
}

const supplierNameCache = new Map<string, string>()
async function resolveSupplierName(supplierId: string): Promise<string> {
  if (!supplierId) return 'Unknown supplier'
  if (supplierNameCache.has(supplierId)) return supplierNameCache.get(supplierId)!
  const db = createAdminClient()
  const { data } = await db.from('suppliers').select('name').eq('id', supplierId).maybeSingle()
  const name = data?.name ?? 'Unknown supplier'
  supplierNameCache.set(supplierId, name)
  return name
}

export type OrderTotals = {
  price_per_unit: number
  subtotal: number
  delivery_fee: number
  platform_fee: number
  tax_amount: number
  total_amount: number
}

export function computeOrderTotals(args: {
  quantity: number
  price_per_unit: number
  delivery_fee: number
  platform_fee_rate?: number  // e.g. 0.09
}): OrderTotals {
  const subtotal = Math.round(args.quantity * args.price_per_unit * 100) / 100
  const platformRate = args.platform_fee_rate ?? 0.09
  const platform_fee = Math.round(subtotal * platformRate * 100) / 100
  const tax = 0
  const total = Math.round((subtotal + args.delivery_fee + platform_fee + tax) * 100) / 100
  return {
    price_per_unit: args.price_per_unit,
    subtotal,
    delivery_fee: args.delivery_fee,
    platform_fee,
    tax_amount: tax,
    total_amount: total,
  }
}

export async function submitOrder(args: {
  placed_by_profile_id: string
  market_id: string
  material_catalog_id: string
  supplier_offering_id: string
  supply_yard_id: string
  quantity: number
  unit: 'ton' | 'cuyd'
  delivery_address_id: string
  project_id: string | null
  requested_delivery_date: string | null
  delivery_notes: string | null
  spend_limit_cents: number | null   // team member limit; null = no limit
}): Promise<{ order_id: string; requires_approval: boolean }> {
  const db = createAdminClient()

  const { data: off } = await db
    .from('supplier_offerings')
    .select(`
      id, material_catalog_id, unit, price_per_unit, delivery_fee_base, delivery_fee_per_mile,
      supply_yard:supply_yards!inner (id, supplier_id, name, lat, lng, market_id,
        supplier:suppliers!inner (id, name)),
      material:material_catalog!inner (id, name)
    `)
    .eq('id', args.supplier_offering_id).single()
  if (!off) throw new Error('Offering not found')

  const { data: addr } = await db
    .from('addresses')
    .select('id, street_line_1, street_line_2, city, state, zip, lat, lng, delivery_notes, market_id')
    .eq('id', args.delivery_address_id).single()
  if (!addr) throw new Error('Delivery address not found')

  const yardLat = (off as any).supply_yard?.lat ? Number((off as any).supply_yard.lat) : null
  const yardLng = (off as any).supply_yard?.lng ? Number((off as any).supply_yard.lng) : null
  const aLat = addr.lat ? Number(addr.lat) : null
  const aLng = addr.lng ? Number(addr.lng) : null
  const distance = yardLat != null && yardLng != null && aLat != null && aLng != null
    ? haversine(aLat, aLng, yardLat, yardLng)
    : 0

  const delivery_fee =
    Number(off.delivery_fee_base ?? 0)
    + Number(off.delivery_fee_per_mile ?? 0) * distance

  const totals = computeOrderTotals({
    quantity: args.quantity,
    price_per_unit: Number(off.price_per_unit),
    delivery_fee: Math.round(delivery_fee * 100) / 100,
  })

  const requiresApproval = args.spend_limit_cents != null
    && totals.total_amount * 100 > args.spend_limit_cents

  const supplierId = (off as any).supply_yard?.supplier_id
  const supplierName = (off as any).supply_yard?.supplier?.name ?? 'Unknown supplier'
  const yardName = (off as any).supply_yard?.name ?? 'Yard'
  const materialName = (off as any).material?.name ?? 'Material'

  const deliverySnapshot = {
    street_line_1: addr.street_line_1,
    street_line_2: addr.street_line_2,
    city: addr.city, state: addr.state, zip: addr.zip,
    lat: aLat, lng: aLng,
    delivery_notes: addr.delivery_notes,
  }

  const { data: order, error } = await db.from('orders').insert({
    market_id: args.market_id,
    material_catalog_id: args.material_catalog_id,
    supply_yard_id: args.supply_yard_id,
    supplier_id: supplierId,
    resolved_offering_id: args.supplier_offering_id,
    status: 'pending_payment',
    material_name_snapshot: materialName,
    supplier_name_snapshot: supplierName,
    supply_yard_name_snapshot: yardName,
    quantity: args.quantity,
    unit: args.unit,
    delivery_address_id: args.delivery_address_id,
    delivery_address_snapshot: deliverySnapshot,
    requested_delivery_date: args.requested_delivery_date,
    delivery_notes: args.delivery_notes,
    price_per_unit: totals.price_per_unit,
    subtotal: totals.subtotal,
    delivery_fee: totals.delivery_fee,
    platform_fee: totals.platform_fee,
    tax_amount: totals.tax_amount,
    total_amount: totals.total_amount,
    line_items_snapshot: [{
      material_catalog_id: args.material_catalog_id,
      material_name: materialName,
      quantity: args.quantity,
      unit: args.unit,
      price_per_unit: totals.price_per_unit,
      subtotal: totals.subtotal,
    }],
    project_id: args.project_id,
    placed_by_profile_id: args.placed_by_profile_id,
    requires_approval: requiresApproval,
    customer_id: args.placed_by_profile_id,
    source: 'contractor_portal',
  }).select('id').single()

  if (error || !order) throw new Error(error?.message ?? 'Order insert failed')
  return { order_id: order.id, requires_approval: requiresApproval }
}
