import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SITE_PASSWORD = process.env.SITE_PASSWORD || ''

export function middleware(request: NextRequest) {
  // If no password is set, allow all traffic
  if (!SITE_PASSWORD) return NextResponse.next()

  // Allow the unlock API route
  if (request.nextUrl.pathname === '/api/unlock') return NextResponse.next()

  // Check if user has the access cookie
  const hasAccess = request.cookies.get('site_access')?.value === 'granted'
  if (hasAccess) return NextResponse.next()

  // Show coming soon page
  return new NextResponse(comingSoonHTML(request.nextUrl.origin), {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}

function comingSoonHTML(origin: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EarthMove — Coming Soon</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f9fafb;
      color: #111827;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .container {
      text-align: center;
      max-width: 420px;
    }
    .logo {
      width: 56px; height: 56px;
      background: #059669;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
    }
    .logo svg { width: 24px; height: 24px; }
    h1 {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 8px;
      color: #111827;
    }
    h1 span { color: #059669; }
    p {
      color: #6b7280;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    form { display: flex; gap: 8px; max-width: 320px; margin: 0 auto; }
    input {
      flex: 1;
      padding: 12px 16px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      font-size: 14px;
      outline: none;
    }
    input:focus { border-color: #059669; box-shadow: 0 0 0 3px rgba(5,150,105,0.1); }
    button {
      padding: 12px 20px;
      background: #059669;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #047857; }
    .error { color: #dc2626; font-size: 13px; margin-top: 12px; display: none; }
    .sub { color: #9ca3af; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m8 3 4 8 5-5 2 15H2L8 3z"/>
      </svg>
    </div>
    <h1>Earth<span>Move</span></h1>
    <p>We're building something big. Bulk construction materials, delivered to your job site. Launching soon.</p>
    <form onsubmit="unlock(event)">
      <input type="password" id="pw" placeholder="Enter access code" autocomplete="off" />
      <button type="submit">Enter</button>
    </form>
    <div class="error" id="err">Incorrect access code.</div>
    <div class="sub">&copy; 2026 EarthMove. All rights reserved.</div>
  </div>
  <script>
    async function unlock(e) {
      e.preventDefault();
      const pw = document.getElementById('pw').value;
      const res = await fetch('${origin}/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) { window.location.reload(); }
      else { document.getElementById('err').style.display = 'block'; }
    }
  </script>
</body>
</html>`
}
