import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitOrReject } from '@/lib/security/rate-limit';
import { extractClientIp } from '@/lib/security/ip-utils';
import { sanitizeUserInput } from '@/lib/security/sanitize-input';
import { createDsarRequest } from '@/lib/compliance/dsar';
export const dynamic = 'force-dynamic';
const TYPES = ['access','portability','rectification','restriction','objection'] as const;
export async function POST(req: NextRequest) {
  const limited = await rateLimitOrReject(req, 'dsar_submit', 3600, 5);
  if (limited) return limited;
  try {
    const ip = extractClientIp(req); const ua = req.headers.get('user-agent'); const body = await req.json();
    const requestType = body.requestType;
    const subjectEmail = String(body.subjectEmail ?? '').toLowerCase().trim();
    const subjectPhone = body.subjectPhone ? String(body.subjectPhone) : undefined;
    if (!TYPES.includes(requestType)) return NextResponse.json({ error: 'invalid_request_type' }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(subjectEmail)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    if (subjectEmail.length > 255) return NextResponse.json({ error: 'email_too_long' }, { status: 400 });
    const safe = await sanitizeUserInput(subjectEmail, { ip: ip ?? undefined, sourceLabel: 'dsar_email' });
    if (!safe.safe) return NextResponse.json({ error: 'rejected' }, { status: 400 });
    const { id } = await createDsarRequest({ requestType, subjectEmail, subjectPhone, ip, userAgent: ua });
    return NextResponse.json({ id, ack: 'received', sla_days: 30 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'submission_failed' }, { status: 500 }); }
}
