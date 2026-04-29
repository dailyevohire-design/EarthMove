import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Forward the request pathname as x-pathname header so server components
  // (e.g. dashboard/layout.tsx) can read it via headers() and seed redirectTo.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  const passThrough = () => NextResponse.next({ request: { headers: requestHeaders } })

  const password = process.env.SITE_PASSWORD
  if (!password) return passThrough()

  // Allow API routes
  if (request.nextUrl.pathname.startsWith('/api/')) return passThrough()

  // Check access cookie
  if (request.cookies.get('site_access')?.value === 'granted') return passThrough()

  // Handle password submission via POST (never via query string — Referer leaks)
  if (request.method === 'POST' && request.nextUrl.pathname === '/__gate') {
    const form = await request.formData().catch(() => null)
    const submittedPw = form?.get('pw')
    const next = (form?.get('next') as string) || '/'
    if (typeof submittedPw === 'string' && timingSafeEqual(submittedPw, password)) {
      const url = new URL(next.startsWith('/') ? next : '/', request.url)
      const response = NextResponse.redirect(url, 303)
      response.cookies.set('site_access', 'granted', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
      return response
    }
    return new NextResponse(gatePage(next, true), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Show password page
  return new NextResponse(gatePage(request.nextUrl.pathname, false), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function gatePage(nextPath: string, failed: boolean) {
  const safeNext = escapeHtml(nextPath || '/')
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Access Required</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.c{text-align:center;max-width:380px}
h1{font-size:18px;font-weight:700;color:#374151;margin-bottom:20px}
.err{font-size:13px;color:#b91c1c;margin-bottom:12px}
form{display:flex;gap:8px;max-width:300px;margin:0 auto}
input{flex:1;padding:12px 16px;border:1px solid #d1d5db;border-radius:10px;font-size:14px;outline:none}
input:focus{border-color:#059669;box-shadow:0 0 0 3px rgba(5,150,105,0.1)}
button{padding:12px 20px;background:#059669;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}
button:hover{background:#047857}
</style></head><body>
<div class="c">
<h1>This site is under construction.</h1>
${failed ? '<div class="err">Incorrect password.</div>' : ''}
<form method="POST" action="/__gate" autocomplete="off">
<input type="hidden" name="next" value="${safeNext}">
<input type="password" name="pw" placeholder="Password" autocomplete="off" autofocus>
<button type="submit">Enter</button>
</form>
</div></body></html>`
}
