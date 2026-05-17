import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { isBotUserAgent, detectDevice, extractGeo } from '@/lib/server/bot-detect';
import type { PresenceRole } from '@/lib/realtime/presence-client';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  decodeSessionCookie,
  encodeSessionCookie,
  type SessionCookieValue,
} from '@/lib/server/session-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type SessionInitResponse = {
  session_id: string;
  user_id: string | null;
  role: PresenceRole;
  city: string | null;
  region: string | null;
  country: string | null;
  device: 'mobile' | 'desktop' | 'tablet';
  first_seen_at: number;
  page_view_count: number;
};

// Replaces /api/telemetry/heartbeat for the presence-channel world. Called once
// per tab on TelemetryProvider mount. Idempotent: returns existing cookie values
// if cookie present; mints a new envelope if absent. Bots get 204 + no cookie —
// keeps headless crawlers off the admin live grid.
export async function POST(req: Request) {
  const ua = req.headers.get('user-agent');
  if (isBotUserAgent(ua)) {
    return new NextResponse(null, { status: 204 });
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const decoded = raw ? decodeSessionCookie(raw) : null;

  const now = Date.now();
  const envelope: SessionCookieValue = decoded ?? {
    sid: randomUUID().replace(/-/g, ''),
    fsa: now,
    pvc: 0,
  };

  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await ssr.auth.getUser();

  let role: PresenceRole = user ? 'customer' : 'anon';
  if (user) {
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: profile } = await svc
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role) role = profile.role as PresenceRole;
  }

  const geo = extractGeo(req);
  const device = detectDevice(ua);

  const body: SessionInitResponse = {
    session_id: envelope.sid,
    user_id: user?.id ?? null,
    role,
    city: geo.city,
    region: geo.region,
    country: geo.country,
    device,
    first_seen_at: envelope.fsa,
    page_view_count: envelope.pvc,
  };

  const res = NextResponse.json(body);
  // Always rewrite the cookie so Max-Age slides forward on every active session,
  // and legacy hex cookies (pre-base64url-envelope) get migrated in place.
  res.cookies.set(SESSION_COOKIE, encodeSessionCookie(envelope), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
