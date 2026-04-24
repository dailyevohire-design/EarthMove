import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isCollectionsEnabled } from '@/lib/collections/feature-flag'
import { getAssessorUrl } from '@/lib/collections/county-assessors'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isCollectionsEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const state = url.searchParams.get('state')
  const county = url.searchParams.get('county') ?? ''
  if (state !== 'CO' && state !== 'TX') {
    return NextResponse.json({ error: 'invalid_state' }, { status: 400 })
  }
  if (!county) return NextResponse.json({ error: 'missing_county' }, { status: 400 })

  const assessor = getAssessorUrl(state, county)
  if (assessor) {
    return NextResponse.json({ url: assessor, county_name: county, state })
  }
  return NextResponse.json({
    url: null,
    fallback_query: `${county} County ${state === 'CO' ? 'Colorado' : 'Texas'} appraisal district OR assessor`,
  })
}
