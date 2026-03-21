'use server'

import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { recalculatePoolScores } from '@/lib/fulfillment-resolver'
import type { ApiResult } from '@/types'

const Schema = z.object({
  material_catalog_id:    z.string().uuid(),
  price_per_unit:         z.number().positive(),
  unit:                   z.enum(['ton', 'cubic_yard', 'load', 'each']),
  minimum_order_quantity: z.number().positive(),
  typical_load_size:      z.number().positive().nullable(),
  load_size_label:        z.string().max(100).optional(),
  delivery_fee_base:      z.number().min(0).nullable(),
  delivery_fee_per_mile:  z.number().min(0).nullable(),
  max_delivery_miles:     z.number().positive().nullable(),
  availability_confidence: z.number().int().min(0).max(100),
  is_available:           z.boolean(),
  is_public:              z.boolean(),
  available_for_delivery: z.boolean(),
  internal_notes:         z.string().max(1000).optional(),
})

export async function saveOffering(
  offeringId: string | null,
  yardId: string,
  raw: unknown
): Promise<ApiResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  const parsed = Schema.safeParse(raw)
  if (!parsed.success) return { success: false, error: 'Invalid input: ' + parsed.error.issues[0]?.message }

  const adminClient = createAdminClient()

  if (offeringId) {
    const { error } = await adminClient.from('supplier_offerings').update({
      ...parsed.data,
      last_verified_at: new Date().toISOString(),
    }).eq('id', offeringId)
    if (error) return { success: false, error: 'Failed to update offering.' }
  } else {
    const { error } = await adminClient.from('supplier_offerings').insert({
      ...parsed.data,
      supply_yard_id: yardId,
      last_verified_at: new Date().toISOString(),
    })
    if (error) return { success: false, error: 'Failed to create offering.' }
  }

  // Recalculate scores for any pools using this offering
  if (offeringId) {
    const { data: poolEntries } = await adminClient
      .from('market_supply_pool').select('market_material_id').eq('offering_id', offeringId)
    for (const entry of poolEntries ?? []) {
      await recalculatePoolScores(entry.market_material_id)
    }
  }

  return { success: true, data: undefined }
}
