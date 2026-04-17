import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveContractorAccess, isAuthorized } from '@/lib/contractor/access'
import { matchSuppliers } from '@/lib/services/place-order.service'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await resolveContractorAccess(supabase)
  if (ctx.access === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAuthorized(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const material_catalog_id = req.nextUrl.searchParams.get('material_catalog_id')
  const qty = parseFloat(req.nextUrl.searchParams.get('qty') || '0')
  const unit = (req.nextUrl.searchParams.get('unit') || 'ton') as 'ton' | 'cuyd'
  const zip = req.nextUrl.searchParams.get('zip')
  const limitRaw = req.nextUrl.searchParams.get('limit')
  const limit = Math.min(10, Math.max(1, parseInt(limitRaw || '3')))

  if (!material_catalog_id || !qty) {
    return NextResponse.json({ error: 'material_catalog_id + qty required' }, { status: 422 })
  }

  // Destination from zip lookup OR profile.default_market_id fallback
  let destination: { lat: number; lng: number } | null = null
  const admin = createAdminClient()
  if (zip) {
    const { data: addr } = await admin
      .from('addresses').select('lat, lng').eq('zip', zip)
      .not('lat', 'is', null).limit(1).maybeSingle()
    if (addr?.lat && addr?.lng) destination = { lat: Number(addr.lat), lng: Number(addr.lng) }
  }

  try {
    const matches = await matchSuppliers({
      material_catalog_id,
      quantity: qty,
      unit,
      destination,
      marketId: ctx.profile.default_market_id,
      limit,
    })
    return NextResponse.json({ matches, count: matches.length })
  } catch (err: any) {
    console.error('[suppliers/match] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
