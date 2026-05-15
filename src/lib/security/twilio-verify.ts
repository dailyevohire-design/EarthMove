import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

/**
 * HMAC-SHA1 verification per Twilio spec.
 * signature = base64(HMAC-SHA1(authToken, url + sortedKeyValueConcat))
 *
 * Returns true iff valid OR if SECURITY_ALLOW_UNVERIFIED_TWILIO=true (dev only).
 */
export function verifyTwilioRequest(req: NextRequest, params: URLSearchParams | Record<string, string>): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return process.env.SECURITY_ALLOW_UNVERIFIED_TWILIO === 'true';

  const sig = req.headers.get('x-twilio-signature');
  if (!sig) return false;

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) return false;
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const url = `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;

  const entries: [string, string][] = params instanceof URLSearchParams
    ? Array.from(params.entries())
    : Object.entries(params);
  entries.sort(([a], [b]) => a.localeCompare(b));
  const canonical = url + entries.map(([k, v]) => k + v).join('');

  const expected = createHmac('sha1', authToken).update(canonical).digest('base64');

  try {
    const sigBuf = Buffer.from(sig, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
