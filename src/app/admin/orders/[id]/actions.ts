'use server'

import { createClient } from '@/lib/supabase/server'
import {
  assignDispatch as _assign,
  markEnRoute as _enRoute,
  markDelivered as _delivered,
  markDispatchFailed as _failed,
} from '@/lib/dispatch'
import type { ApiResult } from '@/types'

async function getAdminId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return p?.role === 'admin' ? user.id : null
}

export async function assignDispatch(input: {
  orderId: string
  driverName?: string
  driverPhone?: string
  truckInfo?: string
  opsNotes?: string
  overrideOfferingId?: string
  overrideYardId?: string
  overrideSupplierId?: string
}): Promise<ApiResult<void>> {
  const adminId = await getAdminId()
  if (!adminId) return { success: false, error: 'Unauthorized.' }
  return _assign({ ...input, dispatcherId: adminId })
}

export async function markEnRoute(orderId: string): Promise<ApiResult<void>> {
  const adminId = await getAdminId()
  if (!adminId) return { success: false, error: 'Unauthorized.' }
  return _enRoute(orderId, adminId)
}

export async function markDelivered(orderId: string): Promise<ApiResult<void>> {
  const adminId = await getAdminId()
  if (!adminId) return { success: false, error: 'Unauthorized.' }
  return _delivered(orderId, adminId)
}

export async function markDispatchFailed(orderId: string, reason: string): Promise<ApiResult<void>> {
  const adminId = await getAdminId()
  if (!adminId) return { success: false, error: 'Unauthorized.' }
  return _failed(orderId, adminId, reason)
}
