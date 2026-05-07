// /api/contact — public contact form intake from /contact page.
// Mirrors /api/join: validate -> persist to audit_events -> best-effort email.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { sendContactInquiry } from '@/lib/email'

export const runtime = 'nodejs'

const Schema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email:    z.string().trim().toLowerCase().email().max(160),
  role:     z.enum(['homeowner', 'contractor', 'driver', 'supplier', 'other']),
  subject:  z.string().trim().min(2).max(180),
  message:  z.string().trim().min(2).max(4000),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Please fill in all required fields.' },
      { status: 422 }
    )
  }

  const inquiry = parsed.data
  const supabase = createAdminClient()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

  await supabase.from('audit_events').insert({
    event_type:  'contact.inquiry',
    entity_type: 'contact_inquiries',
    actor_role:  null,
    actor_id:    null,
    payload: {
      full_name: inquiry.fullName,
      email:     inquiry.email,
      role:      inquiry.role,
      subject:   inquiry.subject,
      message:   inquiry.message,
    },
    ip_address: ip,
  })

  await sendContactInquiry(inquiry)

  return NextResponse.json({ ok: true })
}
