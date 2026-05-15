import { createHash } from 'crypto';

export function uaHash(ua: string | null | undefined): string {
  if (!ua) return 'no-ua';
  const normalized = ua.replace(/\d+\.\d+\.\d+/g, 'X.X.X').replace(/\d+/g, 'N').toLowerCase().trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}
