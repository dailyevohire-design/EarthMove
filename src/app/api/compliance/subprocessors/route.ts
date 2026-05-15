import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitOrReject } from '@/lib/security/rate-limit';
import { getPublicSubprocessors } from '@/lib/compliance/snapshot';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const limited = await rateLimitOrReject(req, 'compliance_subprocessors', 60, 30);
  if (limited) return limited;
  const rows = await getPublicSubprocessors();
  return NextResponse.json({ subprocessors: rows, count: rows.length, retrieved_at: new Date().toISOString() });
}
