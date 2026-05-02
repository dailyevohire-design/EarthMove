/**
 * Cloudflare Turnstile server-side token verification.
 * Pure function — fetches from Cloudflare's siteverify endpoint.
 * Returns true only if token is valid AND for our configured site.
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function verifyTurnstileToken(args: {
  token: string;
  remoteIp?: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
}): Promise<TurnstileVerifyResult> {
  const { token, remoteIp, secretKey, fetchImpl = fetch } = args;

  if (!token || token.length < 10) {
    return { ok: false, reason: 'token_missing_or_invalid' };
  }
  if (!secretKey) {
    return { ok: false, reason: 'secret_key_missing' };
  }

  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (remoteIp) formData.append('remoteip', remoteIp);

  let resp: Response;
  try {
    resp = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
  } catch (err) {
    return { ok: false, reason: `network_error: ${err instanceof Error ? err.message : 'unknown'}` };
  }

  if (!resp.ok) {
    return { ok: false, reason: `siteverify_http_${resp.status}` };
  }

  let body: { success?: boolean; 'error-codes'?: string[] };
  try {
    body = await resp.json();
  } catch {
    return { ok: false, reason: 'siteverify_invalid_json' };
  }

  if (body.success === true) return { ok: true };
  return {
    ok: false,
    reason: `siteverify_failed: ${(body['error-codes'] ?? []).join(',') || 'unknown'}`,
  };
}
