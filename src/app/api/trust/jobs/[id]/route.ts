import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// GET /api/trust/jobs/[id] — owner-scoped status poll for an enqueued
// async trust job. Returns the trust_jobs columns the client cares about
// for poll UX. Cache-Control: no-store so polling clients always see fresh
// state.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('trust_jobs')
    .select(
      'id, status, sources_completed, sources_failed, total_sources_planned, ' +
      'evidence_count, enqueued_at, started_at, completed_at, report_id, ' +
      'error_message, requested_by_user_id'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[TrustAPI/jobs] query error', { id, err: error.message })
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
  // Mask not-found and not-owner as the same 404 — never leak job existence
  // to non-owners.
  if (!data || data.requested_by_user_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(
    {
      id:                    data.id,
      status:                data.status,
      sources_completed:     data.sources_completed,
      sources_failed:        data.sources_failed,
      total_sources_planned: data.total_sources_planned,
      evidence_count:        data.evidence_count,
      enqueued_at:           data.enqueued_at,
      started_at:            data.started_at,
      completed_at:          data.completed_at,
      report_id:             data.report_id,
      error_message:         data.error_message,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
