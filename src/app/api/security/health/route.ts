import { NextResponse, type NextRequest } from 'next/server';
import { getSecuritySnapshot } from '@/lib/security/snapshot';
import { rateLimitOrReject } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limited = await rateLimitOrReject(req, 'health', 60, 30);
  if (limited) return limited;

  const snap = await getSecuritySnapshot();
  if (!snap) return NextResponse.json({ ok: false, error: 'snapshot_unavailable' }, { status: 503 });
  const status = snap.critical_24h > 0 || snap.canary_hits_24h > 0 || snap.rls_findings > 0 ? 'degraded' : 'ok';
  return NextResponse.json({ ok: true, status, snapshot: snap, timestamp: new Date().toISOString() });
}
