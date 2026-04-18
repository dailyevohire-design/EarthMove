/**
 * POST /api/driver/ping
 *
 * Auth: HttpOnly cookie em_driver_session (hashed, matched against session_token_hash).
 * Inserts one location_pings row with synchronous anti-spoof flags.
 * Updates driver_sessions.last_ping_at and drivers.current_lat/lng.
 *
 * Anomaly flags are ECHOED in `x-em-anomaly-flags` response header for PWA logging.
 * NEVER rejects for anomaly — flag, don't block.
 * Returns 204 No Content on success.
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { latLngToCell } from 'h3-js';
import { createAdminClient } from '@/lib/supabase/server';
import { hashToken } from '@/lib/driver/tokens';
import { driverPingRateLimiter } from '@/lib/driver/rate-limiter';
import { detectAnomalies } from '@/lib/driver/anti-spoof';

const BodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  recorded_at: z.string().datetime(),
  accuracy_m: z.number().nullable().optional(),
  speed_mps: z.number().min(0).max(100).nullable().optional(),
  heading_deg: z.number().min(0).max(360).nullable().optional(),
  altitude_m: z.number().nullable().optional(),
  battery_pct: z.number().int().min(0).max(100).nullable().optional(),
});

const SESSION_COOKIE = 'em_driver_session';

export async function POST(req: NextRequest) {
  // Auth: cookie from request (house pattern)
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const tokenHash = hashToken(token);

  const supabase = createAdminClient();

  // Load session (and validate active)
  const { data: session, error: sessErr } = await supabase
    .from('driver_sessions')
    .select('id, driver_id, dispatch_id, expires_at, revoked_at')
    .eq('session_token_hash', tokenHash)
    .maybeSingle();

  if (sessErr || !session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 401 });
  }
  if (session.revoked_at) {
    return NextResponse.json({ error: 'session_revoked' }, { status: 401 });
  }
  if (new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'session_expired' }, { status: 401 });
  }

  // Rate limit by session_id
  const rl = await driverPingRateLimiter.limit(session.id);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_s: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  // Parse body
  let body;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'invalid_payload', issues: e?.issues }, { status: 400 });
  }

  // Load previous ping for this session (anti-spoof context)
  const { data: prev } = await supabase
    .from('location_pings')
    .select('lat, lng, recorded_at')
    .eq('session_id', session.id)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Synchronous anti-spoof gates
  const flags = detectAnomalies(
    { lat: body.lat, lng: body.lng, recorded_at: body.recorded_at, accuracy_m: body.accuracy_m ?? null },
    prev ? { lat: prev.lat, lng: prev.lng, recorded_at: prev.recorded_at } : null
  );

  // Compute H3 r9 (h3-js v4 returns hex string; BigInt('0x'+hex) for bigint column).
  // Stored as decimal string via toString() — matches Uber h3-pg convention;
  // use to_hex(h3_r9) in SQL when hex display is needed.
  let h3_r9: string | null = null;
  try {
    const h3Hex = latLngToCell(body.lat, body.lng, 9);
    h3_r9 = BigInt('0x' + h3Hex).toString();
  } catch {
    flags.push('h3_compute_failed');
  }

  // Insert ping
  const { error: insertErr } = await supabase.from('location_pings').insert({
    session_id: session.id,
    dispatch_id: session.dispatch_id,
    driver_id: session.driver_id,
    recorded_at: body.recorded_at,
    lat: body.lat,
    lng: body.lng,
    h3_r9,
    accuracy_m: body.accuracy_m,
    speed_mps: body.speed_mps,
    heading_deg: body.heading_deg,
    altitude_m: body.altitude_m,
    source: 'browser',
    battery_pct: body.battery_pct,
    anomaly_flags: flags,
  });

  if (insertErr) {
    return NextResponse.json({ error: 'insert_failed', detail: insertErr.message }, { status: 500 });
  }

  // Fire-and-forget updates (don't block response)
  Promise.all([
    supabase
      .from('driver_sessions')
      .update({ last_ping_at: new Date().toISOString() })
      .eq('id', session.id),
    supabase
      .from('drivers')
      .update({
        current_lat: body.lat,
        current_lng: body.lng,
        current_location_updated_at: body.recorded_at,
      })
      .eq('id', session.driver_id)
      .or(`current_location_updated_at.is.null,current_location_updated_at.lt.${body.recorded_at}`),
  ]).catch(() => {
    // TODO: ship to Sentry; fire-and-forget for now
  });

  // 204 No Content with anomaly flags in header for PWA debug logging
  const res = new NextResponse(null, { status: 204 });
  if (flags.length > 0) {
    res.headers.set('x-em-anomaly-flags', flags.join(','));
  }
  return res;
}
