import { createPublicClient } from './server-client';
import { uaHash } from './ua-hash';
import { SECURITY } from './constants';

export async function pinAdminSession(sessionId: string, userId: string, ip: string, userAgent: string | null): Promise<void> {
  try {
    const sb = createPublicClient();
    await sb.schema('security').rpc('fn_pin_admin_session', {
      p_session_id: sessionId, p_user_id: userId, p_ip: ip,
      p_ua_hash: uaHash(userAgent), p_ttl_minutes: SECURITY.ADMIN.SESSION_TTL_MIN,
    });
  } catch { /* best-effort */ }
}

export type AdminSessionVerdict = 'ok' | 'unknown' | 'revoked' | 'expired' | 'ip_mismatch' | 'ua_mismatch' | 'error';

export async function validateAdminSession(sessionId: string, ip: string, userAgent: string | null): Promise<AdminSessionVerdict> {
  try {
    const sb = createPublicClient();
    const { data, error } = await sb.schema('security').rpc('fn_check_admin_session', {
      p_session_id: sessionId, p_ip: ip, p_ua_hash: uaHash(userAgent),
    });
    if (error || !data) return 'error';
    return data as AdminSessionVerdict;
  } catch { return 'error'; }
}
