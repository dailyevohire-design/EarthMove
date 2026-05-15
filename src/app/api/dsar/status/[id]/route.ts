import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitOrReject } from '@/lib/security/rate-limit';
import { createComplianceClient } from '@/lib/compliance/server-client';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimitOrReject(req, 'dsar_status', 60, 30);
  if (limited) return limited;
  try {
    const { id } = await params;
    const sb = createComplianceClient();
    const { data } = await sb.from('dsar_requests').select('id,request_type,status,fulfillment_deadline,created_at,fulfilled_at').eq('id', id).single();
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 }); }
}
