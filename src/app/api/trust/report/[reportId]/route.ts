import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 37 safe columns — full trust_reports row minus three internal-only fields:
//   api_cost_usd, job_id, report_summary_embedding.
const COLS =
  'id,user_id,contractor_name,city,state_code,tier,contractor_id,' +
  'trust_score,risk_level,confidence_level,' +
  'biz_status,biz_entity_type,biz_formation_date,' +
  'lic_status,lic_license_number,' +
  'bbb_rating,bbb_accredited,bbb_complaint_count,' +
  'review_avg_rating,review_total,review_sentiment,' +
  'legal_status,legal_findings,' +
  'osha_status,osha_violation_count,osha_serious_count,' +
  'red_flags,positive_indicators,summary,data_sources_searched,' +
  'raw_report,searches_performed,processing_ms,' +
  'created_at,report_version,evidence_ids,' +
  'synthesis_model,structured_source_hit_rate'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params
  if (!reportId) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // RLS owner-only SELECT on trust_reports. 404 for both "doesn't exist" and
  // "not yours" — intentional; do not reveal existence of other users' reports.
  const { data, error } = await supabase
    .from('trust_reports')
    .select(COLS)
    .eq('id', reportId)
    .maybeSingle()

  if (error) {
    console.error('[api/trust/report/:reportId] select error', { reportId, err: error.message })
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  })
}
