import { NextResponse, type NextRequest } from 'next/server';
import { preflightSecurity } from './middleware.security';
import { authMiddleware } from './middleware.auth';

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const verdict = await preflightSecurity(req);
  if (verdict.kind === 'terminate') return verdict.response;

  let response: NextResponse | undefined;
  const result = await authMiddleware(req);
  if (result instanceof NextResponse) response = result;
  response = response ?? NextResponse.next();
  return verdict.applyHeaders(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)'],
};
