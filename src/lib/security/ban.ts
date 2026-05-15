import { createPublicClient } from './server-client';

const banCache = new Map<string, { banned: boolean; expires: number }>();

export async function isBanned(ip: string): Promise<boolean> {
  if (!ip) return false;
  const now = Date.now();
  const cached = banCache.get(ip);
  if (cached && cached.expires > now) return cached.banned;
  try {
    const sb = createPublicClient();
    const { data, error } = await sb.schema('security').rpc('fn_is_banned', { p_ip: ip });
    if (error) { banCache.set(ip, { banned: false, expires: now + 30000 }); return false; }
    const banned = Boolean(data);
    banCache.set(ip, { banned, expires: now + 30000 });
    return banned;
  } catch { return false; }
}

export async function banIp(ip: string, reason: string, minutes: number, source = 'auto'): Promise<void> {
  if (!ip) return;
  try {
    const sb = createPublicClient();
    await sb.schema('security').rpc('fn_ban_ip', { p_ip: ip, p_reason: reason, p_minutes: minutes, p_source: source });
    banCache.set(ip, { banned: true, expires: Date.now() + 30000 });
  } catch { /* best-effort */ }
}
