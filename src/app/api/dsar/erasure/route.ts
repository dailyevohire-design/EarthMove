import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitOrReject } from '@/lib/security/rate-limit';
import { createErasureRequest } from '@/lib/compliance/dsar';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const limited = await rateLimitOrReject(req, 'dsar_erasure', 3600, 5);
  if (limited) return limited;
  try {
    const body = await req.json();
    const subjectEmail = String(body.subjectEmail ?? '').toLowerCase().trim();
    const reason = body.reason ? String(body.reason).slice(0, 500) : undefined;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(subjectEmail)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    const { id } = await createErasureRequest({ subjectEmail, reason });
    return NextResponse.json({ id, ack: 'received', sla_days: 30 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'submission_failed' }, { status: 500 }); }
}
