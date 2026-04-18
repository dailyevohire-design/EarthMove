/**
 * Opaque bearer tokens for driver sessions.
 * 32 random bytes → base64url → SHA-256 hex stored at rest.
 * Matches Groundcheck share-grant token pattern (src/lib/groundcheck/verification.ts).
 */
import { randomBytes, createHash } from 'node:crypto';

export function generateDriverToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function computeFingerprint(userAgent: string | null, ip: string | null, clientFp: string | null): string {
  const h = createHash('sha256');
  h.update(userAgent ?? '');
  h.update('|');
  h.update(ip ?? '');
  h.update('|');
  h.update(clientFp ?? '');
  return h.digest('hex');
}
