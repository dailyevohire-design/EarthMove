import { createAdminClient } from '@/lib/supabase/server'

export type ProjectRow = {
  id: string
  organization_id: string
  name: string
  status: string
  phase_label: string | null
  progress_pct: number
  budget_cents: number | null
  spend_cents: number
  at_risk: boolean
  due_date: string | null
  lat: number | null
  lng: number | null
}

export async function listActiveProjects(organizationId: string, limit = 10): Promise<ProjectRow[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('projects')
    .select('id, organization_id, name, status, phase_label, progress_pct, budget_cents, spend_cents, at_risk, due_date, lat, lng')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'bid'])
    .order('spend_cents', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ProjectRow[]
}

export async function getProject(id: string, organizationId: string): Promise<ProjectRow | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('projects')
    .select('id, organization_id, name, status, phase_label, progress_pct, budget_cents, spend_cents, at_risk, due_date, lat, lng')
    .eq('id', id).eq('organization_id', organizationId).maybeSingle()
  if (error) throw error
  return (data as ProjectRow | null) ?? null
}
