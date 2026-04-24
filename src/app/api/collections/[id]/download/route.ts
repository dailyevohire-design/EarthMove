import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { assertCollectionsEnabled, isCollectionsEnabled } from '@/lib/collections/feature-flag'
import { generateAndStoreCase } from '@/lib/collections/generator'
import { getSignedDownloadUrls } from '@/lib/collections/storage'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isCollectionsEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  assertCollectionsEnabled()

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // RLS-scoped read — caller can only see their own row.
  const { data: caseRow, error } = await supabase
    .from('collections_cases')
    .select('id, user_id, status, state_code, kit_variant, documents_generated_at, download_count, first_downloaded_at')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  if (!caseRow) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (caseRow.status === 'refunded') {
    return NextResponse.json({ error: 'refunded' }, { status: 410 })
  }

  // If paid but docs not yet generated, attempt to generate now (lazy path — the
  // webhook is the happy path that pre-generates). If generation fails, return 202.
  if (caseRow.status === 'paid' && !caseRow.documents_generated_at) {
    try {
      await generateAndStoreCase(caseRow.id)
    } catch (err) {
      console.error('[collections/:id/download] generation failed', err)
      return NextResponse.json({ status: 'generation_in_progress' }, { status: 202 })
    }
  }

  // Re-read via admin to reflect the just-updated status
  const admin = createAdminClient()
  const { data: fresh } = await admin
    .from('collections_cases')
    .select('id, user_id, status, state_code, kit_variant, download_count, first_downloaded_at')
    .eq('id', caseRow.id)
    .maybeSingle()

  if (!fresh) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (fresh.status !== 'documents_ready' && fresh.status !== 'downloaded') {
    return NextResponse.json({ status: 'generation_in_progress' }, { status: 202 })
  }

  const signed = await getSignedDownloadUrls(fresh.user_id, fresh.id, fresh.state_code, fresh.kit_variant)

  const nextCount = (fresh.download_count ?? 0) + 1
  const updates: Record<string, unknown> = {
    download_count: nextCount,
    status: 'downloaded',
  }
  if (!fresh.first_downloaded_at) updates.first_downloaded_at = new Date().toISOString()

  await admin.from('collections_cases').update(updates).eq('id', fresh.id)
  await admin.from('collections_case_events').insert({
    case_id: fresh.id,
    event_type: 'downloaded',
    event_payload: { download_count: nextCount, state: fresh.state_code },
    actor_user_id: user.id,
  })

  return NextResponse.json({
    instruction_packet: signed.instruction_packet,
    demand_letter:      signed.demand_letter,
    doc2:               signed.doc2,
    lien:               signed.lien,
    doc2_type:          signed.doc2_type,
    is_full_kit:        signed.is_full_kit,
  })
}
