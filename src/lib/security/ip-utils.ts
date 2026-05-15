import type { NextRequest } from 'next/server';

export function extractClientIp(req: NextRequest | Request): string | null {
  const h = (req as NextRequest).headers ?? new Headers();
  const fwd = h.get('x-vercel-forwarded-for') ?? h.get('x-forwarded-for') ?? h.get('cf-connecting-ip') ?? h.get('x-real-ip');
  if (!fwd) return null;
  const first = fwd.split(',')[0]?.trim();
  return first && isValidIp(first) ? first : null;
}

export function isValidIp(s: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(s) || /^[\da-f:]+$/i.test(s);
}

export function ip24(ip: string): string {
  if (!isValidIp(ip)) return ip;
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 3).join(':') + '::/48';
  }
  const [a, b, c] = ip.split('.');
  return `${a}.${b}.${c}.0/24`;
}
