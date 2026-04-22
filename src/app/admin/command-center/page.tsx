import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mergeWithInitial } from './seed'
import type { DashboardState } from './types'
import CommandCenterClient from './CommandCenterClient'

export const dynamic = 'force-dynamic'

export default async function CommandCenterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Admin gate is enforced by /admin/layout.tsx, but page is still dynamic —
  // a missing user here is defensive only.
  if (!user) redirect('/login')

  const { data: row, error } = await supabase
    .from('dashboard_state')
    .select('state, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    // Row-not-found is not an error here (maybeSingle returns null). Anything
    // else — RLS misconfig, schema drift — surface visibly rather than render
    // a silently broken dashboard.
    throw new Error('Failed to load dashboard_state: ' + error.message)
  }

  const initial: DashboardState = mergeWithInitial((row?.state as Partial<DashboardState> | undefined) ?? null)
  const initialUpdatedAt: string | null = row?.updated_at ?? null

  return (
    <CommandCenterClient
      userId={user.id}
      initial={initial}
      initialUpdatedAt={initialUpdatedAt}
    />
  )
}
