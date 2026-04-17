import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { resolveContractorAccess, isAuthorized } from '@/lib/contractor/access'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await resolveContractorAccess(supabase)
  if (ctx.access === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAuthorized(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('order_drafts')
    .select('id, project_id, step, payload, last_saved_at, created_at')
    .eq('id', id).eq('profile_id', ctx.userId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

const PatchSchema = z.object({
  step: z.number().int().min(1).max(5).optional(),
  payload: z.record(z.string(), z.any()).optional(),
  project_id: z.string().uuid().nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await resolveContractorAccess(supabase)
  if (ctx.access === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAuthorized(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const update: Record<string, unknown> = { last_saved_at: new Date().toISOString() }
  if (parsed.data.step != null) update.step = parsed.data.step
  if (parsed.data.payload != null) update.payload = parsed.data.payload
  if (parsed.data.project_id !== undefined) update.project_id = parsed.data.project_id

  const { error } = await supabase
    .from('order_drafts').update(update)
    .eq('id', id).eq('profile_id', ctx.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, saved_at: update.last_saved_at })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await resolveContractorAccess(supabase)
  if (ctx.access === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAuthorized(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('order_drafts').delete()
    .eq('id', id).eq('profile_id', ctx.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
