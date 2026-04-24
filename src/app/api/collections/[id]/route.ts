import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isCollectionsEnabled } from '@/lib/collections/feature-flag'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isCollectionsEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // RLS restricts to the authenticated user's own cases.
  const { data, error } = await supabase
    .from('collections_cases')
    .select(
      'id, user_id, status, state_code, contractor_role, property_type, is_homestead, claimant_name, respondent_name, property_street_address, property_city, property_state, property_zip, property_county, work_description, first_day_of_work, last_day_of_work, amount_owed_cents, paid_at, documents_generated_at, download_count, first_downloaded_at, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[collections/:id] fetch error', error)
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json(data)
}
