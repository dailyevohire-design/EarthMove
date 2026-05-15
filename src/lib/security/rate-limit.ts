import { createPublicClient } from './server-client';
import { extractClientIp } from './ip-utils';
import { NextResponse, type NextRequest } from 'next/server';

export type RateLimitResult = { allowed: boolean; hits: number; retryAfterSec: number };

export async function rateLimit(
  bucketKey: string,
  windowSec: number,
  limit: number
): Promise<RateLimitResult> {
  try {
    const sb = createPublicClient();
    const { data } = await sb.schema('security').rpc('fn_rate_check', {
      p_key: bucketKey, p_window_sec: windowSec, p_limit: limit,
    });
    if (!data || (Array.isArray(data) && data.length === 0)) return { allowed: true, hits: 0, retryAfterSec: 0 };
    const row = Array.isArray(data) ? data[0] : data;
    return { allowed: Boolean(row.allowed), hits: Number(row.hits), retryAfterSec: Number(row.retry_after_sec) };
  } catch {
    return { allowed: true, hits: 0, retryAfterSec: 0 };
  }
}

export async function rateLimitOrReject(
  req: NextRequest | Request,
  scope: string,
  windowSec: number,
  limit: number
): Promise<NextResponse | null> {
  const ip = extractClientIp(req) ?? 'unknown';
  const key = `${scope}:${ip}`;
  const r = await rateLimit(key, windowSec, limit);
  if (r.allowed) return null;
  return new NextResponse('Too Many Requests', {
    status: 429,
    headers: {
      'Retry-After': String(r.retryAfterSec),
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Hits': String(r.hits),
    },
  });
}
