import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

interface LeadBody {
  market_id?: string
  material_catalog_id?: string | null
  material_name_snapshot?: string
  tons?: number | string | null
  zip?: string | null
  project_type?: string | null
  sub_type?: string | null
  delivery_window?: 'this_week' | 'next_2_weeks' | 'this_month' | 'researching' | null
  full_name?: string
  phone?: string | null
  email?: string
  contact_method?: 'phone' | 'text' | 'email' | null
  best_time?: string | null
}

const VALID_DELIVERY = new Set(['this_week', 'next_2_weeks', 'this_month', 'researching'])
const VALID_CONTACT = new Set(['phone', 'text', 'email'])

export async function POST(request: NextRequest) {
  let body: LeadBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // Required fields
  const missing: string[] = []
  if (!body.market_id) missing.push('market_id')
  if (!body.material_name_snapshot) missing.push('material_name_snapshot')
  if (!body.full_name) missing.push('full_name')
  if (!body.email) missing.push('email')
  if (missing.length) {
    return NextResponse.json({ ok: false, error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
  }

  // Optional enums — only persist if valid, otherwise null
  const delivery_window = body.delivery_window && VALID_DELIVERY.has(body.delivery_window) ? body.delivery_window : null
  const contact_method = body.contact_method && VALID_CONTACT.has(body.contact_method) ? body.contact_method : null

  // Coerce tons to numeric or null
  let tons: number | null = null
  if (body.tons !== undefined && body.tons !== null && body.tons !== '') {
    const n = typeof body.tons === 'string' ? parseFloat(body.tons) : body.tons
    if (Number.isFinite(n) && n > 0) tons = n
  }

  // Provenance
  const ip_inet = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const user_agent = request.headers.get('user-agent') ?? null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('material_match_leads')
    .insert({
      market_id: body.market_id,
      material_catalog_id: body.material_catalog_id ?? null,
      material_name_snapshot: body.material_name_snapshot,
      tons,
      zip: body.zip ?? null,
      project_type: body.project_type ?? null,
      sub_type: body.sub_type ?? null,
      delivery_window,
      full_name: body.full_name,
      phone: body.phone ?? null,
      email: body.email,
      contact_method,
      best_time: body.best_time ?? null,
      ip_inet,
      user_agent,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[material-match/lead] insert failed', error)
    return NextResponse.json({ ok: false, error: 'Failed to record lead' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, lead_id: data.id })
}
