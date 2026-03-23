import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD
  if (!password) return NextResponse.next()

  // Allow API routes
  if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next()

  // Check access cookie
  if (request.cookies.get('site_access')?.value === 'granted') return NextResponse.next()

  // Check if this is a password submission via query param
  const submittedPw = request.nextUrl.searchParams.get('pw')
  if (submittedPw === password) {
    const url = new URL(request.nextUrl.pathname, request.url)
    const response = NextResponse.redirect(url)
    response.cookies.set('site_access', 'granted', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return response
  }

  // Show password page
  return new NextResponse(gatePage(request.nextUrl.pathname), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

function gatePage(path: string) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Access Required</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.c{text-align:center;max-width:380px}
h1{font-size:18px;font-weight:700;color:#374151;margin-bottom:20px}
form{display:flex;gap:8px;max-width:300px;margin:0 auto}
input{flex:1;padding:12px 16px;border:1px solid #d1d5db;border-radius:10px;font-size:14px;outline:none}
input:focus{border-color:#059669;box-shadow:0 0 0 3px rgba(5,150,105,0.1)}
button{padding:12px 20px;background:#059669;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}
button:hover{background:#047857}
</style></head><body>
<div class="c">
<h1>This site is under construction.</h1>
<form method="GET" action="${path}">
<input type="password" name="pw" placeholder="Password" autocomplete="off" autofocus>
<button type="submit">Enter</button>
</form>
</div></body></html>`
}
