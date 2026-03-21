'use server'

import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ApiResult } from '@/types'

const Schema = z.object({
  name:                  z.string().min(2).max(200),
  market_id:             z.string().uuid(),
  address_line_1:        z.string().max(200).optional(),
  city:                  z.string().max(100).optional(),
  state:                 z.string().length(2).optional(),
  zip:                   z.string().max(10).optional(),
  phone:                 z.string().max(30).optional(),
  delivery_radius_miles: z.number().positive(),
  delivery_enabled:      z.boolean(),
  pickup_enabled:        z.boolean(),
  internal_notes:        z.string().max(1000).optional(),
})

export async function createYard(supplierId: string, raw: unknown): Promise<ApiResult<{ yard_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized.' }
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  const parsed = Schema.safeParse(raw)
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.from('supply_yards').insert({
    supplier_id: supplierId,
    ...parsed.data,
    address_line_1: parsed.data.address_line_1 || null,
    city:           parsed.data.city || null,
    state:          parsed.data.state || null,
    zip:            parsed.data.zip || null,
    phone:          parsed.data.phone || null,
    internal_notes: parsed.data.internal_notes || null,
  }).select('id').single()

  if (error || !data) return { success: false, error: 'Failed to create yard.' }
  return { success: true, data: { yard_id: data.id } }
}
