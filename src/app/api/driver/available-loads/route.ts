import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Pivoted to internal public.dispatches (see migration 019). Unclaimed loads
// are status='pending' AND driver_id IS NULL. Distance filtering is dropped
// because dispatches stores pickup/delivery as text only; lat/lng will be
// added later via a join to supply_yards/addresses.
export async function GET(req: NextRequest) {
  try {
    const driverUserId = req.nextUrl.searchParams.get('driver_id')
    const limitParam = req.nextUrl.searchParams.get('limit')
    const limit = Math.min(50, Math.max(1, parseInt(limitParam || '20')))

    if (!driverUserId) {
      return NextResponse.json({ error: 'driver_id required' }, { status: 400 })
    }

    const db = createAdminClient()

    const { data: driver } = await db
      .from('drivers').select('id, truck_type, capacity_tons')
      .eq('user_id', driverUserId).maybeSingle()
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

    const { data: rows, error } = await db
      .from('dispatches')
      .select('id, material_type, tons, pickup_address, delivery_address, driver_pay, driver_bonus, is_backhaul, created_at, notes')
      .eq('status', 'pending')
      .is('driver_id', null)
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const loads = (rows || []).map((r: Record<string, any>) => ({
      id:              r.id,
      material:        r.material_type,
      tons:            Number(r.tons),
      pickup:          r.pickup_address,
      deliver:         r.delivery_address,
      pay_dollars:     Number(r.driver_pay) + Number(r.driver_bonus || 0),
      per_ton:         Number(r.tons) > 0
        ? Math.round(((Number(r.driver_pay) + Number(r.driver_bonus || 0)) / Number(r.tons)) * 100) / 100
        : 0,
      is_backhaul:     !!r.is_backhaul,
      source:          'dispatches',
      notes:           r.notes?.slice(0, 120) || null,
      distance_miles:  null,
      eta_minutes:     null,
    }))

    return NextResponse.json({ loads, count: loads.length })
  } catch (err: any) {
    console.error('[available-loads] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
