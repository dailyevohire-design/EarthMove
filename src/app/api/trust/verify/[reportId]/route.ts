import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyChain, type EvidenceChainNode } from '@/lib/trust/chain-verify';

export const dynamic = 'force-dynamic';

/**
 * Public chain verification endpoint. Anonymous-safe.
 *
 * Given a report_id, fetches all evidence rows for that report's underlying job,
 * recomputes each chain_hash from raw inputs, compares to stored chain_hash,
 * returns a tamper-detection result.
 *
 * The integrity claim: if this returns {verified: true}, every evidence row
 * in the report is byte-identical to what was first written, AND no row has
 * been inserted, deleted, or reordered without leaving a detectable mismatch.
 *
 * GET /api/trust/verify/[reportId]
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(reportId)) {
    return NextResponse.json({ error: 'invalid_report_id' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve report → job_id
  const { data: report, error: rerr } = await admin
    .from('trust_reports')
    .select('id, job_id, contractor_name, state_code, trust_score, created_at')
    .eq('id', reportId)
    .maybeSingle();

  if (rerr) {
    return NextResponse.json({ error: 'internal', message: rerr.message }, { status: 500 });
  }
  if (!report || !report.job_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Pull evidence chain in canonical order
  const { data: evidence, error: eerr } = await admin
    .from('trust_evidence')
    .select('id, job_id, sequence_number, finding_type, response_sha256, prev_hash, chain_hash')
    .eq('job_id', report.job_id)
    .order('sequence_number', { ascending: true });

  if (eerr) {
    return NextResponse.json({ error: 'internal', message: eerr.message }, { status: 500 });
  }

  const result = verifyChain((evidence ?? []) as EvidenceChainNode[]);

  return NextResponse.json({
    report_id: report.id,
    contractor_name: report.contractor_name,
    state_code: report.state_code,
    trust_score: report.trust_score,
    report_created_at: report.created_at,
    verified: result.verified,
    evidence_count: result.evidence_count,
    mismatches: result.mismatches,
  });
}
