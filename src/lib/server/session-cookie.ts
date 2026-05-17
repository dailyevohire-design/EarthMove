import { createHmac, timingSafeEqual } from 'crypto';

// Shared __es_sid cookie helpers. The cookie carries a base64url-encoded JSON
// envelope so the session_id, first_seen_at, and page_view_count survive across
// tabs (presence state is per-tab; this is per-session).
//
// Wire format:
//   <base64url(JSON {sid, fsa, pvc})>.<base64url(HMAC-SHA256(payload, SECRET))[:16]>
//
// The signature stops a client from rewriting the cookie to inflate page_view_count
// or backdate first_seen_at to spoof "engaged session" sampling in /api/telemetry.
// 16-char truncated base64url ≈ 96 bits of MAC — adequate for a session cookie.
//
// Both /api/session/init and /api/session/pageview re-set the cookie with the
// same attributes on every write to slide Max-Age forward — a tab open for
// hours keeps the cookie alive without a separate refresh path.

const SECRET = process.env.SESSION_COOKIE_SECRET;
if (!SECRET) {
  // Throws at module import time. If SESSION_COOKIE_SECRET is missing in prod,
  // every request that touches the session cookie path 500s on import — set
  // this env var BEFORE deploying. Generate: openssl rand -base64 32
  throw new Error(
    'SESSION_COOKIE_SECRET env var is required (generate: openssl rand -base64 32)'
  );
}

export const SESSION_COOKIE = '__es_sid';
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Bounds — anything outside is treated as tampering and the cookie is rejected.
const FSA_MIN = 1_700_000_000_000; // 2023-11-14, before EarthMove existed
const FSA_FUTURE_TOLERANCE_MS = 60_000; // allow 1m clock skew
const PVC_MAX = 100_000;

export type SessionCookieValue = {
  sid: string;
  fsa: number; // first_seen_at, epoch ms
  pvc: number; // page_view_count
};

function signPayload(payload: string): string {
  return createHmac('sha256', SECRET as string)
    .update(payload)
    .digest('base64url')
    .slice(0, 16);
}

function verifyPayload(payload: string, sig: string): boolean {
  const expected = signPayload(payload);
  // Length check first — timingSafeEqual throws on length mismatch.
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sig, 'utf8'));
}

export function encodeSessionCookie(v: SessionCookieValue): string {
  const payload = Buffer.from(JSON.stringify(v), 'utf8').toString('base64url');
  return `${payload}.${signPayload(payload)}`;
}

// Decodes either the signed envelope or a legacy hex-only value. Returns null
// only if the raw string is unusable — callers should treat null as "mint a
// fresh session." Legacy hex values become { sid: raw, fsa: now, pvc: 0 } so
// existing sessions don't lose continuity through the migration.
export function decodeSessionCookie(raw: string): SessionCookieValue | null {
  if (!raw) return null;

  // Legacy path: no dot = pre-signing cookie. Must match the 32-hex shape
  // exactly to avoid migrating arbitrary garbage as a session.
  if (!raw.includes('.')) {
    if (/^[0-9a-f]{32}$/i.test(raw)) {
      return { sid: raw, fsa: Date.now(), pvc: 0 };
    }
    return null;
  }

  // Signed envelope: split on the LAST dot (payload is base64url which never
  // contains a dot, but be defensive against future format extensions).
  const lastDot = raw.lastIndexOf('.');
  const payload = raw.slice(0, lastDot);
  const sig = raw.slice(lastDot + 1);

  if (!verifyPayload(payload, sig)) return null;

  let parsed: Partial<SessionCookieValue>;
  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    parsed = JSON.parse(json) as Partial<SessionCookieValue>;
  } catch {
    return null;
  }

  if (
    typeof parsed.sid !== 'string' ||
    parsed.sid.length === 0 ||
    typeof parsed.fsa !== 'number' ||
    !Number.isFinite(parsed.fsa) ||
    typeof parsed.pvc !== 'number' ||
    !Number.isFinite(parsed.pvc)
  ) {
    return null;
  }

  // Bounds checks — out-of-range values mean tampering or a corrupted cookie.
  if (parsed.fsa < FSA_MIN || parsed.fsa > Date.now() + FSA_FUTURE_TOLERANCE_MS) {
    return null;
  }
  if (parsed.pvc < 0 || parsed.pvc > PVC_MAX) {
    return null;
  }

  return { sid: parsed.sid, fsa: parsed.fsa, pvc: parsed.pvc };
}

export const PAGE_VIEW_COUNT_MAX = PVC_MAX;
