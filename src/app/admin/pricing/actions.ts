'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ApiResult } from '@/types'

export async function savePricingRule(ruleId: string, config: Record<string, unknown>): Promise<ApiResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized.' }
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('pricing_rules').update({ config }).eq('id', ruleId)
  if (error) return { success: false, error: 'Failed to save pricing rule.' }

  await adminClient.from('audit_events').insert({
    actor_id: user.id, actor_role: 'admin',
    event_type: 'pricing_rule.updated', entity_type: 'pricing_rules', entity_id: ruleId,
    payload: { config },
  })

  return { success: true, data: undefined }
}
