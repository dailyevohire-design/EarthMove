'use server'

import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { recalculatePoolScores } from '@/lib/fulfillment-resolver'
import type { ApiResult } from '@/types'

const UpdateSchema = z.object({
  is_visible:            z.boolean(),
  is_available:          z.boolean(),
  is_featured:           z.boolean(),
  price_display_mode:    z.enum(['exact', 'custom']),
  custom_display_price:  z.number().positive().nullable(),
  display_name:          z.string().max(200),
  display_description:   z.string().max(1000),
  unavailable_reason:    z.string().max(300),
  admin_notes:           z.string().max(2000),
  preferred_offering_id: z.string().uuid().nullable(),
  fallback_offering_id:  z.string().uuid().nullable(),
})

export async function updateMarketMaterial(
  mmId: string,
  raw: unknown
): Promise<ApiResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  const parsed = UpdateSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const {
    preferred_offering_id, fallback_offering_id,
    display_name, display_description, unavailable_reason, admin_notes,
    ...mmFields
  } = parsed.data

  const adminClient = createAdminClient()

  // Update market_material
  const { error } = await adminClient.from('market_materials').update({
    ...mmFields,
    display_name:         display_name || null,
    display_description:  display_description || null,
    unavailable_reason:   unavailable_reason || null,
    admin_notes:          admin_notes || null,
    last_reviewed_at:     new Date().toISOString(),
  }).eq('id', mmId)

  if (error) return { success: false, error: 'Failed to update market material.' }

  // Update pool preferred/fallback flags
  if (preferred_offering_id || fallback_offering_id) {
    // Clear all current preferred/fallback flags in this pool
    await adminClient.from('market_supply_pool').update({
      is_preferred: false,
      is_fallback: false,
    }).eq('market_material_id', mmId)

    // Set preferred
    if (preferred_offering_id) {
      // Ensure pool entry exists
      await adminClient.from('market_supply_pool').upsert(
        { market_material_id: mmId, offering_id: preferred_offering_id, is_preferred: true, is_active: true },
        { onConflict: 'market_material_id,offering_id' }
      )
    }

    // Set fallback
    if (fallback_offering_id && fallback_offering_id !== preferred_offering_id) {
      await adminClient.from('market_supply_pool').upsert(
        { market_material_id: mmId, offering_id: fallback_offering_id, is_fallback: true, is_active: true },
        { onConflict: 'market_material_id,offering_id' }
      )
    }

    // Recalculate scores
    await recalculatePoolScores(mmId)
  }

  await adminClient.from('audit_events').insert({
    actor_id:    user.id,
    actor_role:  'admin',
    event_type:  'marketplace.material_updated',
    entity_type: 'market_materials',
    entity_id:   mmId,
    payload:     { preferred_offering_id, fallback_offering_id },
  })

  return { success: true, data: undefined }
}
