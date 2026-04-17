import { createAdminClient } from './server'

// Dispatch data currently lives in the main EarthMove Supabase project
// (NEXT_PUBLIC_SUPABASE_URL = DISPATCH_SUPABASE_URL). The separate Sarah/Jesse
// project never materialized. This file stays as a compatibility shim so
// callers that import createDispatchClient keep working — swap the body back
// to a dedicated client if a second project is ever provisioned.
export function createDispatchClient() {
  return createAdminClient()
}

export async function checkDispatchDbHealth(): Promise<{
  ok: boolean
  dispatch_orders_count?: number
  driver_count?: number
  error?: string
}> {
  try {
    const db = createDispatchClient()
    const [dispatches, drivers] = await Promise.all([
      db.from('dispatches').select('id', { count: 'exact', head: true }),
      db.from('drivers').select('id', { count: 'exact', head: true }).eq('active', true),
    ])
    return {
      ok: !dispatches.error && !drivers.error,
      dispatch_orders_count: dispatches.count ?? 0,
      driver_count: drivers.count ?? 0,
      error: dispatches.error?.message || drivers.error?.message,
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Connection failed' }
  }
}
