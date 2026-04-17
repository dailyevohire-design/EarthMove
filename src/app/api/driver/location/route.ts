import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GPS beacon. Writes a no-op-phase dispatch_events row — the events table
// is now the source of truth for driver motion, not drivers.current_location.
// Accepts an explicit dispatch_id; if omitted, attaches to the driver's
// currently-active dispatch (current_phase != 'ticket_submitted').
const Schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  dispatch_id: z.string().uuid().optional(),
  heading: z.number().min(0).max(360).optional(),
  speed_mph: z.number().min(0).max(200).optional(),
  accuracy_m: z.number().min(0).max(5000).optional(),
  gps_timestamp: z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: driver } = await admin
    .from('drivers').select('id').eq('user_id', user.id).maybeSingle()
  if (!driver) return NextResponse.json({ error: 'Not a driver' }, { status: 403 })

  let dispatchId = parsed.data.dispatch_id
  let currentPhase: string | null = null
  if (!dispatchId) {
    const { data: active } = await admin
      .from('dispatches')
      .select('id, current_phase')
      .eq('driver_id', driver.id)
      .neq('current_phase', 'ticket_submitted')
      .order('updated_at', { ascending: false })
      .limit(1).maybeSingle()
    if (!active) return NextResponse.json({ ok: true, logged: false, reason: 'no_active_dispatch' })
    dispatchId = active.id
    currentPhase = active.current_phase
  } else {
    const { data: d } = await admin.from('dispatches').select('current_phase').eq('id', dispatchId).maybeSingle()
    currentPhase = d?.current_phase ?? null
  }

  if (!currentPhase) {
    return NextResponse.json({ ok: true, logged: false, reason: 'unknown_phase' })
  }

  // TODO(scale): at >100 drivers, split gps pings to a dedicated gps_pings table with 7-day TTL. Current approach writes every beacon to dispatch_events which will grow fast (~1k rows/driver/shift). See migration TBD.
  const { error } = await admin.from('dispatch_events').insert({
    dispatch_id: dispatchId,
    driver_id:   driver.id,
    phase:       currentPhase,
    ts:          parsed.data.gps_timestamp ?? new Date().toISOString(),
    lat:         parsed.data.lat,
    lng:         parsed.data.lng,
    source:      'driver_app',
    payload: {
      kind: 'gps',
      heading:    parsed.data.heading,
      speed_mph:  parsed.data.speed_mph,
      accuracy_m: parsed.data.accuracy_m,
    },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, logged: true })
}
