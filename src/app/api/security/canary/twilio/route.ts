import { NextResponse, type NextRequest } from 'next/server';
import { createSecurityClient } from '@/lib/security/server-client';
import { verifyTwilioRequest } from '@/lib/security/twilio-verify';
import { rateLimitOrReject } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const limited = await rateLimitOrReject(req, 'canary_twilio', 60, 60);
  if (limited) return limited;

  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    form.forEach((v, k) => { params[k] = String(v); });

    if (!verifyTwilioRequest(req, params)) {
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const to = params['To'] ?? '';
    const from = params['From'] ?? '';
    const body = params['Body'] ?? '';

    const sb = createSecurityClient();
    const { data: canary } = await sb.from('canary_listings')
      .select('id').eq('identifier', to).eq('canary_type', 'supplier').single();

    if (canary) {
      await sb.from('canary_hits').insert({
        canary_id: canary.id,
        hit_source: 'twilio_inbound',
        caller_id: from,
        raw_payload: { to, from, body },
      });
    }
  } catch { /* never throw at Twilio */ }

  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Message>This number is no longer active.</Message></Response>',
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}
