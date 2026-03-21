'use server'

import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ApiResult } from '@/types'

const SupplierSchema = z.object({
  name:                  z.string().min(2).max(200),
  status:                z.enum(['pending', 'active', 'inactive', 'suspended']),
  primary_contact_name:  z.string().max(200),
  primary_contact_phone: z.string().max(30),
  primary_contact_email: z.string().email().or(z.literal('')),
  website:               z.string().url().or(z.literal('')),
  portal_enabled:        z.boolean(),
  internal_notes:        z.string().max(2000),
})

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return p?.role === 'admin' ? user.id : null
}

export async function saveSupplier(supplierId: string, raw: unknown): Promise<ApiResult<void>> {
  const adminId = await assertAdmin()
  if (!adminId) return { success: false, error: 'Unauthorized.' }

  const parsed = SupplierSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const { primary_contact_email, website, ...rest } = parsed.data
  const adminClient = createAdminClient()

  const { error } = await adminClient.from('suppliers').update({
    ...rest,
    primary_contact_email: primary_contact_email || null,
    website:               website || null,
  }).eq('id', supplierId)

  if (error) return { success: false, error: 'Failed to save supplier.' }

  await adminClient.from('audit_events').insert({
    actor_id: adminId, actor_role: 'admin',
    event_type: 'supplier.updated', entity_type: 'suppliers', entity_id: supplierId,
    payload: { status: parsed.data.status },
  })

  return { success: true, data: undefined }
}

export async function createSupplier(raw: unknown): Promise<ApiResult<{ supplier_id: string }>> {
  const adminId = await assertAdmin()
  if (!adminId) return { success: false, error: 'Unauthorized.' }

  const parsed = SupplierSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const { primary_contact_email, website, ...rest } = parsed.data
  const adminClient = createAdminClient()

  const { data, error } = await adminClient.from('suppliers').insert({
    ...rest,
    primary_contact_email: primary_contact_email || null,
    website: website || null,
  }).select('id').single()

  if (error || !data) return { success: false, error: 'Failed to create supplier.' }
  return { success: true, data: { supplier_id: data.id } }
}
