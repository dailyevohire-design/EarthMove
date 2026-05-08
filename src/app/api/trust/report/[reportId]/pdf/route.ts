import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { renderTrustPdf } from '@/lib/trust/pdf/render';

export const dynamic = 'force-dynamic';
// react-pdf renders synchronously and embeds woff2 fonts as base64 data URIs.
// Cold-start adds ~600ms one-shot for font registration; subsequent calls in
// the same lambda warm-instance reuse the registration.
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { reportId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(reportId)) {
    return NextResponse.json({ error: 'invalid_report_id' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Auth gate: same logic as create_trust_share_grant — owner OR job-requester OR access row
  const { data: report, error: rerr } = await admin
    .from('trust_reports')
    .select(
      'id, user_id, job_id, contractor_name, state_code, city, trust_score, risk_level, summary, created_at, ' +
      'lic_status, lic_license_number, biz_status, biz_entity_type, biz_formation_date, bbb_rating, ' +
      'osha_status, red_flags, positive_indicators, data_sources_searched, ' +
      'searched_as, raw_report',
    )
    .eq('id', reportId)
    .maybeSingle();

  if (rerr || !report) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let authorized = report.user_id === user.id;
  if (!authorized && report.job_id) {
    const { data: job } = await admin
      .from('trust_jobs').select('requested_by_user_id').eq('id', report.job_id).maybeSingle();
    authorized = job?.requested_by_user_id === user.id;
  }
  if (!authorized) {
    const { data: access } = await admin
      .from('trust_report_access').select('id').eq('report_id', reportId).eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString()).maybeSingle();
    authorized = !!access;
  }
  if (!authorized) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Paid-tier reports have an evidence chain — count for the QR card subtitle
  // and pull errored source_keys for the verification chip UNVERIFIED state.
  // Free-tier reports (job_id null) skip both lookups; render.ts handles null.
  let evidenceCount: number | null = null;
  let erroredSourceKeys: Set<string> | undefined;
  if (report.job_id) {
    const { count } = await admin
      .from('trust_evidence').select('id', { count: 'exact', head: true }).eq('job_id', report.job_id);
    evidenceCount = count ?? 0;

    const { data: erroredRows } = await admin
      .from('trust_evidence')
      .select('source_key')
      .eq('job_id', report.job_id)
      .eq('source_errored', true);
    if (erroredRows && erroredRows.length > 0) {
      erroredSourceKeys = new Set(
        (erroredRows as Array<{ source_key: string }>).map((r) => r.source_key),
      );
    }
  }

  const pdfBytes = await renderTrustPdf({
    report: {
      id: report.id,
      contractor_name: report.contractor_name,
      city: report.city,
      state_code: report.state_code,
      trust_score: report.trust_score,
      risk_level: report.risk_level,
      summary: report.summary,
      red_flags: report.red_flags,
      positive_indicators: report.positive_indicators,
      data_sources_searched: report.data_sources_searched,
      created_at: report.created_at,
      job_id: report.job_id,
      biz_entity_type: report.biz_entity_type,
      biz_formation_date: report.biz_formation_date,
      lic_license_number: report.lic_license_number,
      biz_status: report.biz_status,
      lic_status: report.lic_status,
      osha_status: report.osha_status,
      bbb_rating: report.bbb_rating,
      searched_as: report.searched_as,
      raw_report: report.raw_report as Record<string, unknown> | null,
    },
    evidenceCount,
    errored_source_keys: erroredSourceKeys,
    origin: req.nextUrl.origin,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="groundcheck-${slugify(report.contractor_name)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
