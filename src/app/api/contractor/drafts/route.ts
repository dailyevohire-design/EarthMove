import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { resolveContractorAccess, isAuthorized } from '@/lib/contractor/access'

export async function GET() {
  const supabase = await createClient()
  const ctx = await resolveContractorAccess(supabase)
  if (ctx.access === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAuthorized(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('order_drafts')
    .select('id, project_id, step, payload, last_saved_at, created_at')
    .eq('profile_id', ctx.userId)
    .order('last_saved_at', { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ drafts: data ?? [] })
}

const CreateSchema = z.object({
  project_id: z.string().uuid().optional().nullable(),
  payload: z.record(z.string(), z.any()).optional(),
  step: z.number().int().min(1).max(5).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await resolveContractorAccess(supabase)
  if (ctx.access === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAuthorized(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body ?? {})
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const { data, error } = await supabase
    .from('order_drafts')
    .insert({
      profile_id: ctx.userId,
      project_id: parsed.data.project_id ?? null,
      step: parsed.data.step ?? 1,
      payload: parsed.data.payload ?? {},
    })
    .select('id').single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  return NextResponse.json({ draft_id: data.id })
}
