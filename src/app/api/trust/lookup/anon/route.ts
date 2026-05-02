/**
 * POST /api/trust/lookup/anon
 *
 * Public anonymous trust lookup. No auth required.
 * Behind Cloudflare Turnstile. Rate-limited per-IP via anon_trust_lookup RPC
 * (1/day cache-miss budget; cache hits unlimited).
 *
 * Request:  { contractor_name: string, state_code: string, turnstile_token: string }
 * Response: { status: 'ready' | 'queued' | 'rate_limited', ... }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest';
import { verifyTurnstileToken } from '@/lib/trust/turnstile';
import { toPublicAnonReport, type TrustReportRow } from '@/lib/trust/anon-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Event name + payload shape match the existing /api/trust route's JOB_TIERS branch
// (src/app/api/trust/route.ts ~line 278). Fan-out reads event.data.job_id.
const FANOUT_EVENT_V1 = 'trust/job.enqueued';
const FANOUT_EVENT_V2 = 'trust/job.requested.v2';

const MAX_NAME_LEN = 200;
const MIN_NAME_LEN = 2;

function extractClientIp(req: NextRequest): string {
  // Cloudflare (if proxy is in front) sets cf-connecting-ip — use that first.
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  // Vercel sets x-vercel-forwarded-for and x-forwarded-for; the existing trust
  // route uses x-real-ip first, so mirror that ordering.
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const xff = req.headers.get('x-forwarded-for') ?? req.headers.get('x-vercel-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return '0.0.0.0';
}

export async function POST(req: NextRequest) {
  // Parse + validate body
  let body: { contractor_name?: unknown; state_code?: unknown; turnstile_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const contractorName = typeof body.contractor_name === 'string' ? body.contractor_name.trim() : '';
  const stateCode = typeof body.state_code === 'string' ? body.state_code.trim().toUpperCase() : '';
  const turnstileToken = typeof body.turnstile_token === 'string' ? body.turnstile_token : '';

  if (contractorName.length < MIN_NAME_LEN || contractorName.length > MAX_NAME_LEN) {
    return NextResponse.json({ error: 'invalid_contractor_name' }, { status: 400 });
  }
  if (!/^[A-Z]{2}$/.test(stateCode)) {
    return NextResponse.json({ error: 'invalid_state_code' }, { status: 400 });
  }
  if (!turnstileToken) {
    return NextResponse.json({ error: 'turnstile_token_required' }, { status: 400 });
  }

  // Verify Turnstile (server-side, before any DB write)
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error('[anon-lookup] TURNSTILE_SECRET_KEY missing');
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }
  const ip = extractClientIp(req);
  const userAgent = req.headers.get('user-agent') ?? '';

  const turnstile = await verifyTurnstileToken({ token: turnstileToken, remoteIp: ip, secretKey });
  if (!turnstile.ok) {
    return NextResponse.json({ error: 'turnstile_failed', reason: turnstile.reason }, { status: 403 });
  }

  // Call the rate-limit + cache RPC
  const admin = createAdminClient();
  const { data: rpcData, error: rpcErr } = await admin.rpc('anon_trust_lookup', {
    p_ip: ip,
    p_contractor_name: contractorName,
    p_state_code: stateCode,
    p_user_agent: userAgent.slice(0, 500),
  });

  if (rpcErr) {
    console.error('[anon-lookup] RPC error:', rpcErr.message);
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }

  // anon_trust_lookup returns SETOF; take first row
  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!result || typeof result.outcome !== 'string') {
    console.error('[anon-lookup] RPC returned unexpected shape');
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }

  // Branch on outcome — values per migration 117_trust_anon_lookup.sql:
  //   'cached' | 'rate_limited' | 'queued' | 'error'
  if (result.outcome === 'rate_limited') {
    return NextResponse.json(
      {
        status: 'rate_limited',
        reset_at: result.reset_at,
        remaining: result.remaining ?? 0,
      },
      { status: 429 },
    );
  }

  if (result.outcome === 'cached') {
    if (!result.report_id) {
      console.error('[anon-lookup] cached outcome with no report_id');
      return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
    }
    const { data: report, error: reportErr } = await admin
      .from('trust_reports')
      .select(`
        id, contractor_name, city, state_code, tier, trust_score, risk_level,
        confidence_level, biz_status, biz_entity_type, biz_formation_date,
        lic_status, lic_license_number, bbb_rating, bbb_accredited, bbb_complaint_count,
        review_avg_rating, review_total, review_sentiment, legal_status, legal_findings,
        osha_status, osha_violation_count, osha_serious_count, red_flags,
        positive_indicators, summary, data_sources_searched, data_integrity_status,
        synthesis_model, created_at
      `)
      .eq('id', result.report_id)
      .single();
    if (reportErr || !report) {
      console.error('[anon-lookup] report fetch failed:', reportErr?.message);
      return NextResponse.json({ error: 'report_unavailable' }, { status: 500 });
    }
    return NextResponse.json({
      status: 'ready',
      remaining: result.remaining ?? null,
      reset_at: result.reset_at ?? null,
      report: toPublicAnonReport(report as TrustReportRow),
    });
  }

  if (result.outcome === 'queued') {
    // Insert a trust_jobs row via enqueue_trust_job RPC. Anon path: no user_id,
    // no credit_id. Mirrors the JOB_TIERS branch in src/app/api/trust/route.ts.
    const { data: jobData, error: jobErr } = await admin.rpc('enqueue_trust_job', {
      p_contractor_name: contractorName,
      p_state_code: stateCode,
      p_city: null,
      p_tier: 'free',
      p_user_id: null,
      p_credit_id: null,
      p_idempotency_key: null,
    });

    if (jobErr) {
      console.error('[anon-lookup] enqueue_trust_job failed:', jobErr.message);
      return NextResponse.json({ error: 'enqueue_failed' }, { status: 500 });
    }

    const jobRow = Array.isArray(jobData) ? jobData[0] : jobData;
    if (!jobRow?.id) {
      console.error('[anon-lookup] enqueue_trust_job returned no id');
      return NextResponse.json({ error: 'enqueue_failed' }, { status: 500 });
    }

    // Best-effort dispatch. Job row is durable; if Inngest unavailable a
    // fallback dispatcher (existing pattern) can re-emit the event.
    try {
      const trustJobVersion = process.env.TRUST_JOB_VERSION === 'v2' ? 'v2' : 'v1';
      const trustEventName = trustJobVersion === 'v2' ? FANOUT_EVENT_V2 : FANOUT_EVENT_V1;
      await inngest.send({
        name: trustEventName,
        data: { job_id: jobRow.id },
      });
    } catch (err) {
      console.error('[anon-lookup] Inngest send failed:', err);
      // Don't fail the request — job row is enqueued; can be redispatched.
    }

    return NextResponse.json({
      status: 'queued',
      job_id: jobRow.id,
      poll_url: `/api/trust/jobs/${jobRow.id}`,
      remaining: result.remaining ?? null,
      reset_at: result.reset_at ?? null,
    }, { status: 202 });
  }

  console.error('[anon-lookup] unknown outcome:', result.outcome);
  return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
}
