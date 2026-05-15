import { NextResponse, type NextRequest } from 'next/server';
import { extractClientIp } from '@/lib/security/ip-utils';
import { recordHoneypotHit } from '@/lib/security/honeypot';

export const dynamic = 'force-dynamic';

async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const ip = extractClientIp(req);
  const resolved = await params;
  const path = '/' + resolved.path.join('/');
  let body: string | undefined;
  try { body = req.method !== 'GET' ? await req.text() : undefined; } catch { body = undefined; }
  await recordHoneypotHit(req, ip, path, body);
  return new NextResponse('Not Found', { status: 404 });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
export const OPTIONS = handle;
export const HEAD = handle;
