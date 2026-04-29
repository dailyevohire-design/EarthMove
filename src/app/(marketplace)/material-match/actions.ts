'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DFW market UUID — single market for v1 (Q3:A from prior memory)
const MARKET_ID_DFW = 'a9f89572-50c3-4a59-bbdf-78219c5199d6'

interface VerifiedIntentParams {
  material_catalog_id: string
  material_name: string
  tons: number | null
  zip: string | null
  project_type: string | null
  sub_type: string | null
  delivery_window: string | null
  anon_session_id?: string
}

/**
 * Records a verified-stock CTA click in material_match_intents and redirects
 * to /checkout/start with prefill params.
 *
 * resulted_in is left null at this point — set to 'order' or 'abandoned' by
 * downstream funnel events (post-checkout success or session-end sweep).
 */
export async function recordVerifiedIntent(params: VerifiedIntentParams): Promise<never> {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()

  const h = await headers()
  const ip_inet = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const user_agent = h.get('user-agent') ?? null

  const admin = createAdminClient()
  const { error } = await admin
    .from('material_match_intents')
    .insert({
      market_id: MARKET_ID_DFW,
      material_catalog_id: params.material_catalog_id,
      tons: params.tons,
      zip: params.zip,
      project_type: params.project_type,
      sub_type: params.sub_type,
      delivery_window: params.delivery_window,
      authed_user_id: user?.id ?? null,
      anon_session_id: user ? null : (params.anon_session_id ?? 'anon'),
      ip_inet,
      user_agent,
    })

  if (error) {
    // Telemetry failure must not block the user funnel.
    console.error('[material-match] intent insert failed', error)
  }

  // Build prefill URL for /checkout/start (C2 will read these in C3 wiring)
  const search = new URLSearchParams()
  search.set('material_catalog_id', params.material_catalog_id)
  search.set('material', params.material_name)
  if (params.tons != null) search.set('tons', String(params.tons))
  if (params.zip) search.set('zip', params.zip)
  if (params.project_type) search.set('project_type', params.project_type)
  if (params.sub_type) search.set('sub_type', params.sub_type)
  if (params.delivery_window) search.set('delivery_window', params.delivery_window)
  search.set('source', 'material-match')

  redirect(`/checkout/start?${search.toString()}`)
}

interface LeadFormResult {
  ok: boolean
  error?: string
  lead_id?: string
}

/**
 * Submits the sourcing-required lead form. Inserts directly via service-role
 * client (no internal fetch needed — same origin, same DB).
 */
export async function submitSourcingRequiredLead(formData: FormData): Promise<LeadFormResult> {
  const required = ['material_name_snapshot', 'full_name', 'email'] as const
  for (const field of required) {
    const v = formData.get(field)
    if (!v || typeof v !== 'string' || v.trim() === '') {
      return { ok: false, error: `Missing required field: ${field}` }
    }
  }

  const tonsRaw = formData.get('tons')
  let tons: number | null = null
  if (tonsRaw && typeof tonsRaw === 'string' && tonsRaw.trim() !== '') {
    const n = parseFloat(tonsRaw)
    if (Number.isFinite(n) && n > 0) tons = n
  }

  const validDelivery = new Set(['this_week', 'next_2_weeks', 'this_month', 'researching'])
  const validContact = new Set(['phone', 'text', 'email'])

  const dwRaw = formData.get('delivery_window')
  const delivery_window = typeof dwRaw === 'string' && validDelivery.has(dwRaw) ? dwRaw : null

  const cmRaw = formData.get('contact_method')
  const contact_method = typeof cmRaw === 'string' && validContact.has(cmRaw) ? cmRaw : null

  const h = await headers()
  const ip_inet = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const user_agent = h.get('user-agent') ?? null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('material_match_leads')
    .insert({
      market_id: MARKET_ID_DFW,
      material_catalog_id: (formData.get('material_catalog_id') as string) || null,
      material_name_snapshot: formData.get('material_name_snapshot') as string,
      tons,
      zip: (formData.get('zip') as string) || null,
      project_type: (formData.get('project_type') as string) || null,
      sub_type: (formData.get('sub_type') as string) || null,
      delivery_window,
      full_name: formData.get('full_name') as string,
      phone: (formData.get('phone') as string) || null,
      email: formData.get('email') as string,
      contact_method,
      best_time: (formData.get('best_time') as string) || null,
      ip_inet,
      user_agent,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[material-match] lead insert failed', error)
    return { ok: false, error: 'Failed to record lead. Please try again or call us directly.' }
  }

  return { ok: true, lead_id: data.id }
}
