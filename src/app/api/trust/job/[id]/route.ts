import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('trust_jobs')
    .select(
      'id, status, tier, sources_completed, total_sources_planned, evidence_count, progress_events, report_id, error_message, enqueued_at, started_at, completed_at, requested_by_user_id',
    )
    .eq('id', id)
    .eq('requested_by_user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[api/trust/job] select error', { err: error.message })
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json(data)
}
