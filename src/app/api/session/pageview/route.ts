import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isBotUserAgent } from '@/lib/server/bot-detect';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  PAGE_VIEW_COUNT_MAX,
  decodeSessionCookie,
  encodeSessionCookie,
} from '@/lib/server/session-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fire-and-forget pageview increment. No body — server owns the counter so the
// client can't inflate page_view_count to game sampling decisions in
// /api/telemetry/route.ts. Always 204 (success or no-op).
export async function POST(req: Request) {
  if (isBotUserAgent(req.headers.get('user-agent'))) {
    return new NextResponse(null, { status: 204 });
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const decoded = raw ? decodeSessionCookie(raw) : null;

  // No cookie yet = client called pageview before init. Drop silently; init
  // will mint the envelope on its own (and set pvc=0 → 1 on the next nav).
  if (!decoded) return new NextResponse(null, { status: 204 });

  // Cap so a runaway client (or a long-lived bot session) can't grow the cookie
  // counter unboundedly — matches the decode-side bounds check.
  const next = { ...decoded, pvc: Math.min(decoded.pvc + 1, PAGE_VIEW_COUNT_MAX) };
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, encodeSessionCookie(next), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
