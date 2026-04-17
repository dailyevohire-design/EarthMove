import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isPhase, isLegalTransition, type Phase } from '@/lib/driver/phase-machine'

const Schema = z.object({
  dispatch_id: z.string().uuid(),
  next_phase: z.string(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  payload: z.record(z.string(), z.any()).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const { dispatch_id, next_phase, lat, lng, payload } = parsed.data
  if (!isPhase(next_phase)) {
    return NextResponse.json({ error: 'Unknown phase' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: driver } = await admin
    .from('drivers').select('id').eq('user_id', user.id).maybeSingle()
  if (!driver) return NextResponse.json({ error: 'Not a driver' }, { status: 403 })

  const { data: dispatch, error: dispErr } = await admin
    .from('dispatches')
    .select('id, driver_id, current_phase, driver_pay, driver_bonus, tons, completed_at')
    .eq('id', dispatch_id).maybeSingle()
  if (dispErr || !dispatch) return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })
  if (dispatch.driver_id !== driver.id) {
    return NextResponse.json({ error: 'Not your dispatch' }, { status: 403 })
  }

  const from = (dispatch.current_phase || 'ready') as Phase
  if (!isLegalTransition(from, next_phase)) {
    return NextResponse.json(
      { error: `Illegal transition ${from} → ${next_phase}`, current_phase: from },
      { status: 409 }
    )
  }

  const { error: insErr } = await admin.from('dispatch_events').insert({
    dispatch_id,
    driver_id: driver.id,
    phase: next_phase,
    lat: lat ?? null,
    lng: lng ?? null,
    source: 'driver_app',
    payload: payload ?? {},
  })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Trigger sync_dispatch_phase updates dispatches.current_phase + completed_at.
  const earnings = next_phase === 'ticket_submitted'
    ? Number(dispatch.driver_pay || 0) + Number(dispatch.driver_bonus || 0)
    : null

  return NextResponse.json({
    ok: true,
    dispatch_id,
    phase: next_phase,
    earnings_dollars: earnings,
    tons: dispatch.tons,
  })
}
