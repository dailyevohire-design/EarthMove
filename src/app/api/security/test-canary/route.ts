import { NextResponse, type NextRequest } from 'next/server';
import { createSecurityClient } from '@/lib/security/server-client';
import { requireAdmin, UnauthorizedError, ForbiddenError, logAdminAction } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  try {
    const { userId, ip, userAgent } = await requireAdmin();

    const sb = createSecurityClient();
    const { data: canary } = await sb.from('canary_listings').select('id, identifier').limit(1).single();
    if (!canary) return NextResponse.json({ error: 'no_canary_planted' }, { status: 500 });

    const { data: hit, error } = await sb.from('canary_hits').insert({
      canary_id: canary.id,
      hit_source: 'admin_test',
      caller_id: 'simulated',
      raw_payload: { simulated: true, by: userId },
    }).select('id').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAdminAction({
      actorUserId: userId,
      action: 'test_canary_pipeline',
      targetType: 'canary',
      targetId: canary.id,
      ip, userAgent,
      reason: 'end-to-end pipeline validation',
    });

    return NextResponse.json({ ok: true, canary_id: canary.id, identifier: canary.identifier, hit_id: hit?.id });
  } catch (e) {
    if (e instanceof UnauthorizedError) return new NextResponse('Unauthorized', { status: 401 });
    if (e instanceof ForbiddenError)    return new NextResponse('Forbidden', { status: 403 });
    return new NextResponse('Internal error', { status: 500 });
  }
}
