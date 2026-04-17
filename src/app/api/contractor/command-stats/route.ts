import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveContractorAccess, isAuthorized } from '@/lib/contractor/access'
import { getCommandStats } from '@/lib/services/contractor-command.service'

export async function GET() {
  const supabase = await createClient()
  const ctx = await resolveContractorAccess(supabase)
  if (ctx.access === 'unauth') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAuthorized(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const stats = await getCommandStats(ctx.organizationId)
    return NextResponse.json(stats)
  } catch (err: any) {
    console.error('[contractor/command-stats] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
