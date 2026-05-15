import { NextResponse, type NextRequest } from 'next/server';
import { extractClientIp } from './lib/security/ip-utils';
import { isBanned, banIp } from './lib/security/ban';
import { isHoneypotPath } from './lib/security/honeypot';
import { generateCspNonce, buildCspHeader, SECURITY_HEADERS } from './lib/security/csp';
import { SECURITY } from './lib/security/constants';

export type SecurityVerdict =
  | { kind: 'terminate'; response: NextResponse }
  | { kind: 'pass'; nonce: string; applyHeaders: (res: NextResponse) => NextResponse };

export async function preflightSecurity(req: NextRequest): Promise<SecurityVerdict> {
  const ip = extractClientIp(req);
  const { pathname } = req.nextUrl;

  if (ip && (await isBanned(ip))) {
    return { kind: 'terminate', response: new NextResponse('Forbidden', { status: 403 }) };
  }

  if (isHoneypotPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = `/api/security/honeypot${pathname}`;
    return { kind: 'terminate', response: NextResponse.rewrite(url) };
  }

  if (pathname.startsWith('/admin')) {
    const allowlist = (process.env.ADMIN_IP_ALLOWLIST ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (allowlist.length > 0 && ip && !allowlist.includes(ip)) {
      await banIp(ip, `admin_route_unallowed_ip:${pathname}`, SECURITY.BAN.SCRAPER_MINUTES, 'admin_ip_gate');
      return { kind: 'terminate', response: new NextResponse('Forbidden', { status: 403 }) };
    }
  }

  const nonce = generateCspNonce();
  const applyHeaders = (res: NextResponse): NextResponse => {
    res.headers.set('Content-Security-Policy', buildCspHeader(nonce));
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
    res.headers.set('x-csp-nonce', nonce);
    return res;
  };
  return { kind: 'pass', nonce, applyHeaders };
}

export async function securityMiddleware(req: NextRequest): Promise<NextResponse> {
  const v = await preflightSecurity(req);
  if (v.kind === 'terminate') return v.response;
  return v.applyHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)'],
};
