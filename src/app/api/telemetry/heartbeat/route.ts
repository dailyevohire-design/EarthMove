import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { isBotUserAgent, detectDevice, extractIp, extractGeo } from '@/lib/server/bot-detect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIE = '__es_sid';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type HeartbeatBody = {
  path?: string;
  referrer?: string;
  utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  cart?: { value_cents?: number; item_count?: number; market_slug?: string };
  has_groundcheck?: boolean;
};

export async function POST(req: Request) {
  const ua = req.headers.get('user-agent');
  if (isBotUserAgent(ua)) {
    return NextResponse.json({ ok: true, bot: true }, { status: 200 });
  }

  let body: HeartbeatBody = {};
  try {
    body = (await req.json()) as HeartbeatBody;
  } catch {
    /* allow empty body */
  }

  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const isNew = !sessionId;
  if (!sessionId) sessionId = randomUUID().replace(/-/g, '');

  // Read auth.uid() if signed in
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {/* no-op; auth refresh not needed for read-only */},
      },
    }
  );
  const { data: { user } } = await ssr.auth.getUser();

  // Look up role if signed in
  let role: string | null = user ? 'customer' : 'anon';
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
    if (profile?.role) role = profile.role as string;
  }

  const device = detectDevice(ua);
  const ip = extractIp(req);
  const geo = extractGeo(req);
  const cartValue = Math.max(0, Math.trunc(body.cart?.value_cents ?? 0));
  const cartCount = Math.max(0, Math.trunc(body.cart?.item_count ?? 0));
  const hasCart = cartCount > 0 || cartValue > 0;

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Upsert presence row. ON CONFLICT updates last_seen_at + mutable fields only.
  const { error } = await svc.from('live_sessions').upsert(
    {
      session_id: sessionId,
      user_id: user?.id ?? null,
      role,
      last_seen_at: new Date().toISOString(),
      current_path: body.path ?? null,
      referrer: body.referrer ?? null,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      device,
      user_agent: ua,
      ip,
      utm_source: body.utm?.source ?? null,
      utm_medium: body.utm?.medium ?? null,
      utm_campaign: body.utm?.campaign ?? null,
      utm_term: body.utm?.term ?? null,
      utm_content: body.utm?.content ?? null,
      cart_value_cents: cartValue,
      cart_item_count: cartCount,
      cart_market_slug: body.cart?.market_slug ?? null,
      has_signed_in: Boolean(user),
      has_cart: hasCart,
      has_groundcheck: Boolean(body.has_groundcheck),
      ...(isNew ? { first_seen_at: new Date().toISOString(), page_view_count: 1 } : {}),
    },
    { onConflict: 'session_id' }
  );

  if (error) {
    console.error('[telemetry/heartbeat] upsert failed', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, sid: sessionId, isNew });
  if (isNew) {
    res.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
    });
  }
  return res;
}
