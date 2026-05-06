// /api/join — driver + contractor signup intake from /join page.
// Validates input, persists a lead row to audit_events (so leads are recoverable
// even if email transport is down), and notifies the internal team via Resend.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { sendJoinLeadNotification } from '@/lib/email'

export const runtime = 'nodejs'

const Schema = z.object({
  role:               z.enum(['driver', 'contractor']),
  fullName:           z.string().trim().min(1).max(120),
  companyName:        z.string().trim().max(160).optional(),
  email:              z.string().trim().toLowerCase().email().max(160),
  phone:              z.string().trim().min(7).max(40),
  primaryLocation:    z.string().trim().max(80).optional(),
  yearsInBusiness:    z.coerce.number().int().min(0).max(80).optional(),
  // Drivers: truck types. Contractors: equipment types. Multi-select.
  primaryTypes:       z.array(z.string().trim().min(1).max(80)).max(20),
  // Drivers: how many trucks. Contractors: how many pieces of equipment.
  count:              z.coerce.number().int().min(0).max(500).optional(),
  availability:       z.array(z.string().trim().min(1).max(40)).max(10),
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

  const lead = parsed.data
  const supabase = createAdminClient()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

  // Persist as the source of truth — survives even if Resend is down or the
  // email lands in spam. Pull leads later via:
  //   SELECT * FROM audit_events WHERE event_type='join.lead' ORDER BY created_at DESC;
  await supabase.from('audit_events').insert({
    event_type:  'join.lead',
    entity_type: 'join_signups',
    actor_role:  null,
    actor_id:    null,
    payload: {
      role:             lead.role,
      full_name:        lead.fullName,
      company_name:     lead.companyName ?? null,
      email:            lead.email,
      phone:            lead.phone,
      primary_location: lead.primaryLocation ?? null,
      years_in_business: lead.yearsInBusiness ?? null,
      primary_types:    lead.primaryTypes,
      count:            lead.count ?? null,
      availability:     lead.availability,
    },
    ip_address: ip,
  })

  // Best-effort email — already swallows internal errors, so the API call
  // never fails for missing RESEND_API_KEY or transient Resend issues.
  await sendJoinLeadNotification({
    role:             lead.role,
    fullName:         lead.fullName,
    companyName:      lead.companyName ?? null,
    email:            lead.email,
    phone:            lead.phone,
    primaryLocation:  lead.primaryLocation ?? null,
    yearsInBusiness:  lead.yearsInBusiness ?? null,
    primaryTypes:     lead.primaryTypes,
    count:            lead.count ?? null,
    availability:     lead.availability,
  })

  return NextResponse.json({ ok: true })
}
