'use server'

import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { recalculatePoolScores } from '@/lib/fulfillment-resolver'
import type { ApiResult } from '@/types'

// ── Create batch ──────────────────────────────────────────────

const CreateBatchSchema = z.object({
  source_name: z.string().optional(),
  source_url:  z.string().url().optional(),
  market_id:   z.string().uuid().optional(),
  format:      z.enum(['json', 'csv']),
  raw_content: z.string().min(2).max(500_000),
})

export async function createImportBatch(raw: unknown): Promise<ApiResult<{ batch_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  const parsed = CreateBatchSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const { format, raw_content, source_name, source_url, market_id } = parsed.data
  const adminClient = createAdminClient()

  // Parse records
  let records: Record<string, string>[] = []
  try {
    if (format === 'json') {
      const arr = JSON.parse(raw_content)
      if (!Array.isArray(arr)) throw new Error('Expected JSON array.')
      records = arr.map((r: any) => (typeof r === 'object' ? r : {}))
    } else {
      // Minimal CSV parse (header row + data rows)
      const lines = raw_content.trim().split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      records = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
      })
    }
  } catch (err: any) {
    return { success: false, error: `Parse error: ${err.message}` }
  }

  if (records.length === 0) return { success: false, error: 'No records found.' }
  if (records.length > 500) return { success: false, error: 'Max 500 records per batch.' }

  // Create batch
  const { data: batch, error: batchErr } = await adminClient
    .from('import_batches')
    .insert({
      source:       format,
      source_url:   source_url ?? null,
      source_name:  source_name ?? null,
      market_id:    market_id ?? null,
      total_records: records.length,
      raw_payload:  { format, records },
    })
    .select('id').single()

  if (batchErr || !batch) return { success: false, error: 'Failed to create batch.' }

  // Insert records
  const importRows = records.map(r => ({
    batch_id:          batch.id,
    raw_supplier_name: r.supplier_name ?? r.supplier ?? r.company ?? null,
    raw_yard_address:  r.yard_address ?? r.address ?? null,
    raw_yard_city:     r.yard_city ?? r.city ?? null,
    raw_yard_state:    r.yard_state ?? r.state ?? null,
    raw_yard_zip:      r.yard_zip ?? r.zip ?? null,
    raw_yard_phone:    r.yard_phone ?? r.phone ?? null,
    raw_material_name: r.material_name ?? r.material ?? r.product ?? null,
    raw_price:         r.price ?? r.cost ?? null,
    raw_unit:          r.unit ?? null,
    raw_min_order:     r.min_order ?? r.minimum ?? null,
    raw_notes:         r.notes ?? r.comments ?? null,
    raw_data:          r,
    status:            'pending_review',
  }))

  await adminClient.from('import_records').insert(importRows)

  return { success: true, data: { batch_id: batch.id } }
}

// ── Approve record ────────────────────────────────────────────

const ApproveSchema = z.object({
  record_id:    z.string().uuid(),
  supplier_id:  z.string().uuid(),
  yard_id:      z.string().uuid(),
  catalog_id:   z.string().uuid(),
  parsed_price: z.number().positive(),
  parsed_unit:  z.enum(['ton', 'cubic_yard', 'load', 'each']),
  parsed_min:   z.number().positive(),
  admin_notes:  z.string().max(500).optional(),
})

export async function approveImportRecord(raw: unknown): Promise<ApiResult<{ offering_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  const parsed = ApproveSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const { record_id, supplier_id, yard_id, catalog_id, parsed_price, parsed_unit, parsed_min, admin_notes } = parsed.data
  const adminClient = createAdminClient()

  // Upsert offering (idempotent)
  const { data: existing } = await adminClient
    .from('supplier_offerings')
    .select('id')
    .eq('supply_yard_id', yard_id)
    .eq('material_catalog_id', catalog_id)
    .maybeSingle()

  let offeringId: string

  if (existing) {
    await adminClient.from('supplier_offerings').update({
      price_per_unit:         parsed_price,
      unit:                   parsed_unit,
      minimum_order_quantity: parsed_min,
      data_source:            'scraped',
      last_verified_at:       new Date().toISOString(),
      availability_confidence: 70,
      internal_notes:          admin_notes ?? null,
    }).eq('id', existing.id)
    offeringId = existing.id
  } else {
    const { data: newOff, error } = await adminClient.from('supplier_offerings').insert({
      supply_yard_id:         yard_id,
      material_catalog_id:    catalog_id,
      unit:                   parsed_unit,
      price_per_unit:         parsed_price,
      minimum_order_quantity: parsed_min,
      data_source:            'scraped',
      last_verified_at:       new Date().toISOString(),
      availability_confidence: 70,
      internal_notes:          admin_notes ?? null,
    }).select('id').single()
    if (error || !newOff) return { success: false, error: 'Failed to create offering.' }
    offeringId = newOff.id
  }

  // Mark record imported
  await adminClient.from('import_records').update({
    status:               'imported',
    resolved_supplier_id: supplier_id,
    resolved_yard_id:     yard_id,
    resolved_catalog_id:  catalog_id,
    resolved_offering_id: offeringId,
    reviewed_by:          user.id,
    reviewed_at:          new Date().toISOString(),
    admin_notes:          admin_notes ?? null,
    parsed_price,
    parsed_unit,
    parsed_min_quantity: parsed_min,
  }).eq('id', record_id)

  // Recalculate scores for any pools using this offering
  const { data: poolEntries } = await adminClient
    .from('market_supply_pool')
    .select('market_material_id')
    .eq('offering_id', offeringId)

  for (const entry of poolEntries ?? []) {
    await recalculatePoolScores(entry.market_material_id)
  }

  await adminClient.from('audit_events').insert({
    actor_id:    user.id,
    actor_role:  'admin',
    event_type:  'import.record_approved',
    entity_type: 'import_records',
    entity_id:   record_id,
    payload:     { offering_id: offeringId, parsed_price, catalog_id },
  })

  return { success: true, data: { offering_id: offeringId } }
}

export async function rejectImportRecord(
  recordId: string,
  reason: string
): Promise<ApiResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  const adminClient = createAdminClient()
  await adminClient.from('import_records').update({
    status:           'rejected',
    rejection_reason: reason,
    reviewed_by:      user.id,
    reviewed_at:      new Date().toISOString(),
  }).eq('id', recordId)

  return { success: true, data: undefined }
}
