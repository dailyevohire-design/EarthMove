import { createSecurityClient, createPublicClient } from './server-client';
import { SECURITY } from './constants';
import { banIp } from './ban';

export async function recordFailedAuth(identifier: string, reason: string, ip: string | null, userAgent: string | null): Promise<void> {
  try {
    const sb = createSecurityClient();
    await sb.from('failed_auth').insert({ identifier, reason, ip, user_agent: userAgent });
  } catch { /* best-effort */ }
}

export async function isLockedOut(identifier: string): Promise<boolean> {
  try {
    const sb = createPublicClient();
    const { data } = await sb.schema('security').rpc('fn_check_failed_auth', {
      p_identifier: identifier,
      p_window_minutes: SECURITY.AUTH.LOCKOUT_WINDOW_MIN,
      p_threshold: SECURITY.AUTH.LOCKOUT_THRESHOLD,
    });
    return Boolean(data);
  } catch { return false; }
}

export async function handleFailedAuth(identifier: string, reason: string, ip: string | null, userAgent: string | null): Promise<{ locked: boolean }> {
  await recordFailedAuth(identifier, reason, ip, userAgent);
  const locked = await isLockedOut(identifier);
  if (locked && ip) await banIp(ip, `failed_auth:${identifier}`, SECURITY.BAN.FAILED_AUTH_MINUTES, 'failed_auth');
  return { locked };
}
