import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BodySchema = z.object({
  email: z.string().email().max(200),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { error } = await admin.from('waitlist').insert({
    email: parsed.data.email,
    waitlist_type: 'broker_payment',
    user_id: user?.id ?? null,
  })

  if (error) {
    console.error('[collections/broker-waitlist] insert failed', error)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
