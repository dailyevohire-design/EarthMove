import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, UnauthorizedError, ForbiddenError, logAdminAction } from '@/lib/security/admin-auth';
import { createPublicClient } from '@/lib/compliance/server-client';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const { userId, ip, userAgent } = await requireAdmin();
    const url = new URL(req.url);
    const since = url.searchParams.get('since') ?? new Date(Date.now() - 7*86400_000).toISOString();
    const until = url.searchParams.get('until') ?? new Date().toISOString();
    const sb = createPublicClient();
    const { data: admin } = await sb.schema('security').from('admin_actions').select('*').gte('performed_at', since).lte('performed_at', until).order('performed_at',{ascending:true}).limit(10000);
    const { data: incidents } = await sb.schema('compliance').from('incidents').select('*').gte('detected_at', since).lte('detected_at', until).limit(10000);
    await logAdminAction({ actorUserId: userId, action: 'audit_export', targetType: 'audit', targetId: null, ip, userAgent, reason: `since=${since} until=${until}` });
    return NextResponse.json({
      schema: 'earthmove-audit-export-v1',
      generated_at: new Date().toISOString(),
      requested_by: userId,
      window: { since, until },
      admin_actions: admin ?? [],
      incidents: incidents ?? [],
      attestation: { source: 'security.admin_actions + compliance.incidents', tamper_evident: true, chain_verification: '/admin/compliance/integrity' },
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) return new NextResponse('Unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('Forbidden', { status: 403 });
    return new NextResponse('Internal error', { status: 500 });
  }
}
