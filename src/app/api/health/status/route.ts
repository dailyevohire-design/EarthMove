import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitOrReject } from '@/lib/security/rate-limit';
import { createPublicClient } from '@/lib/compliance/server-client';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const limited = await rateLimitOrReject(req, 'health_status', 60, 60);
  if (limited) return limited;
  try {
    const sb = createPublicClient();
    const { data: backup } = await sb.schema('compliance').from('v_backup_health').select('*').single();
    const { data: openIncidents } = await sb.schema('compliance').from('incidents').select('id,severity,status').not('status','eq','closed');
    const allOk = (openIncidents ?? []).length === 0 && (!backup || (backup as { days_since_last_backup: number }).days_since_last_backup <= 1);
    return NextResponse.json({ status: allOk ? 'operational' : 'degraded', backup_health: backup, open_incidents: (openIncidents ?? []).length, ts: new Date().toISOString() });
  } catch { return NextResponse.json({ status: 'unknown', ts: new Date().toISOString() }, { status: 503 }); }
}
