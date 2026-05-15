import { HONEYPOT_PATHS, SECURITY } from './constants';
import { banIp } from './ban';
import { createSecurityClient } from './server-client';

export function isHoneypotPath(pathname: string): boolean {
  return HONEYPOT_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function recordHoneypotHit(req: Request, ip: string | null, pathname: string, body?: string): Promise<void> {
  try {
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { if (!['authorization', 'cookie'].includes(k.toLowerCase())) headers[k] = v; });
    const sb = createSecurityClient();
    await sb.from('honeypot_hits').insert({
      path: pathname,
      method: req.method,
      ip,
      user_agent: req.headers.get('user-agent'),
      referer: req.headers.get('referer'),
      headers,
      body_hash: body ? await sha256Hex(body) : null,
    });
    if (ip) await banIp(ip, `honeypot:${pathname}`, SECURITY.BAN.HONEYPOT_MINUTES, 'honeypot');
  } catch { /* silent */ }
}
