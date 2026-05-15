import { NextResponse, type NextRequest } from 'next/server';
import { createSecurityClient } from '@/lib/security/server-client';
import { rateLimitOrReject } from '@/lib/security/rate-limit';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const limited = await rateLimitOrReject(req, 'canary_email', 60, 60);
  if (limited) return limited;

  const { secret: providedSecret } = await params;
  const expectedSecret = process.env.CANARY_EMAIL_SECRET ?? '';
  if (!expectedSecret || !constantTimeEq(providedSecret, expectedSecret)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    const body = await req.json();
    const to = body.to ?? body.envelope?.to ?? '';
    const from = body.from ?? body.envelope?.from ?? '';
    const sb = createSecurityClient();
    const { data: canary } = await sb.from('canary_listings')
      .select('id').eq('identifier', to).eq('canary_type', 'supplier').single();
    if (canary) {
      await sb.from('canary_hits').insert({
        canary_id: canary.id, hit_source: 'sendgrid_inbound',
        email_from: from, raw_payload: body,
      });
    }
  } catch { /* best-effort */ }
  return new NextResponse(null, { status: 204 });
}
