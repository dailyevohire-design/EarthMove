/**
 * POST /api/driver/session
 *
 * Consumes a one-time bootstrap_token from the SMS dispatch link.
 * Mints a durable session bearer token bound to device fingerprint.
 * Writes PEWC consent grant to sms_consent ledger.
 *
 * Replay / expired / revoked → 401 with reason code.
 * Already consumed → 409 with close_reason='token_replay'.
 *
 * Sets HttpOnly SameSite=Strict cookie `em_driver_session`.
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { generateDriverToken, hashToken, computeFingerprint } from '@/lib/driver/tokens';
import { driverSessionRateLimiter } from '@/lib/driver/rate-limiter';
import { PEWC_DISCLOSURE_V1, PEWC_DISCLOSURE_V1_VERSION, disclosureSha256 } from '@/lib/compliance/pewc-text';

const BodySchema = z.object({
  bootstrap_token: z.string().min(32).max(128),
  consent_accepted: z.literal(true, {
    errorMap: () => ({ message: 'consent_required' }),
  }),
  disclosure_version: z.string().min(1).max(32),
  client_fingerprint: z.string().length(64).nullable().optional(),
});

const SESSION_COOKIE = 'em_driver_session';
const SESSION_MAX_AGE_S = 8 * 60 * 60; // 8h

export async function POST(req: NextRequest) {
  // Read IP + UA from the request (house pattern: no next/headers import)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? null;
  const ua = req.headers.get('user-agent');

  // Rate limit by IP
  if (ip) {
    const rl = await driverSessionRateLimiter.limit(ip);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_s: Math.ceil((rl.reset - Date.now()) / 1000) },
        { status: 429 }
      );
    }
  }

  // Parse body
  let body;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e: any) {
    if (e?.issues) {
      // consent_required is a domain error, not a validation error
      const consentIssue = e.issues.find((i: any) => i.message === 'consent_required');
      if (consentIssue) {
        return NextResponse.json({ error: 'consent_required' }, { status: 400 });
      }
      return NextResponse.json({ error: 'invalid_payload', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const bootstrapHash = hashToken(body.bootstrap_token);

  // Look up session by bootstrap_token_hash
  const { data: session, error: lookupErr } = await supabase
    .from('driver_sessions')
    .select('id, driver_id, dispatch_id, phone_e164, expires_at, bootstrap_consumed_at, revoked_at')
    .eq('bootstrap_token_hash', bootstrapHash)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: 'bootstrap_not_found' }, { status: 404 });
  }
  if (session.revoked_at) {
    return NextResponse.json({ error: 'session_revoked' }, { status: 410 });
  }
  if (new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'session_expired' }, { status: 410 });
  }
  if (session.bootstrap_consumed_at) {
    return NextResponse.json({ error: 'bootstrap_already_consumed' }, { status: 409 });
  }

  // Mint new session token
  const sessionToken = generateDriverToken();
  const sessionTokenHash = hashToken(sessionToken);
  const fingerprint = computeFingerprint(ua, ip, body.client_fingerprint ?? null);

  // Atomic consume: only succeeds if bootstrap_consumed_at is still NULL
  const { data: updated, error: updateErr } = await supabase
    .from('driver_sessions')
    .update({
      bootstrap_consumed_at: new Date().toISOString(),
      session_token_hash: sessionTokenHash,
      device_fingerprint_sha256: fingerprint,
      user_agent: ua,
      ip_inet: ip,
      consent_recorded_at: new Date().toISOString(),
    })
    .eq('id', session.id)
    .is('bootstrap_consumed_at', null)
    .is('revoked_at', null)
    .select('id, driver_id, dispatch_id, phone_e164, expires_at')
    .maybeSingle();

  if (updateErr || !updated) {
    // Someone else consumed it between our SELECT and UPDATE — race lost
    return NextResponse.json({ error: 'bootstrap_already_consumed' }, { status: 409 });
  }

  // Write PEWC consent grant (append-only ledger)
  const { error: consentErr } = await supabase.from('sms_consent').insert({
    phone_e164: updated.phone_e164,
    driver_id: updated.driver_id,
    event_type: 'grant',
    consent_type: 'dispatch_plus_location',
    disclosure_version: PEWC_DISCLOSURE_V1_VERSION,
    disclosure_text_sha256: disclosureSha256(PEWC_DISCLOSURE_V1),
    disclosure_text_full: PEWC_DISCLOSURE_V1,
    method: 'web_form_checkbox',
    evidence: {
      bootstrap_token_hash: bootstrapHash,
      session_id: updated.id,
      dispatch_id: updated.dispatch_id,
      device_fingerprint_sha256: fingerprint,
    },
    e_sign_attested: true,
    ip_inet: ip,
    user_agent: ua,
    recorded_by: 'service',
  });

  if (consentErr) {
    // Hard fail: consent not recorded = we can't legally SMS. Roll back session consumption.
    await supabase
      .from('driver_sessions')
      .update({ revoked_at: new Date().toISOString(), closed_reason: 'revoked_by_ops' })
      .eq('id', updated.id);
    return NextResponse.json({ error: 'consent_record_failed' }, { status: 500 });
  }

  // Build response with HttpOnly cookie set on the response object (house pattern)
  const res = NextResponse.json(
    {
      dispatch_id: updated.dispatch_id,
      driver_id: updated.driver_id,
      session_expires_at: updated.expires_at,
      tracking_mode: 'link_pwa',
    },
    { status: 200 }
  );
  res.cookies.set({
    name: SESSION_COOKIE,
    value: sessionToken,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
