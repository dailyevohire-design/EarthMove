import { NextResponse, type NextRequest } from 'next/server';
import { createSecurityClient } from '@/lib/security/server-client';
import { extractClientIp } from '@/lib/security/ip-utils';
import { rateLimitOrReject } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const limited = await rateLimitOrReject(req, 'csp_report', 60, 60);
  if (limited) return limited;
  try {
    const ip = extractClientIp(req);
    const body = await req.json();
    const sb = createSecurityClient();
    await sb.from('ai_injection_attempts').insert({
      source: 'csp_violation',
      pattern_matched: body['csp-report']?.['violated-directive'] ?? 'unknown',
      excerpt: JSON.stringify(body).slice(0, 500),
      ip,
      action_taken: 'flagged',
      metadata: body,
    });
  } catch { /* untrusted */ }
  return new NextResponse(null, { status: 204 });
}
