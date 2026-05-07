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

  // Handle admin login submission via POST (never via query string — Referer leaks).
  // Both email AND password must match. Email is non-secret (cosmetic identity),
  // password is the real secret in SITE_PASSWORD env.
  const ADMIN_EMAILS = ['support@filldirtnearme.net', 'john@filldirtnearme.net']
  if (request.method === 'POST' && request.nextUrl.pathname === '/__gate') {
    const form = await request.formData().catch(() => null)
    const submittedEmail = (form?.get('email') as string | null)?.toLowerCase().trim() ?? ''
    const submittedPw = form?.get('pw')
    const next = (form?.get('next') as string) || '/'
    // Timing-safe email check across the allowlist — always run all comparisons,
    // OR the results, so total time is constant regardless of which email matched.
    let emailOk = false
    for (const allowed of ADMIN_EMAILS) {
      if (timingSafeEqual(submittedEmail, allowed)) emailOk = true
    }
    const pwOk = typeof submittedPw === 'string' && timingSafeEqual(submittedPw, password)
    if (emailOk && pwOk) {
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
<meta name="robots" content="noindex,nofollow">
<title>Earthmove · Network warming up</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#F4F1EA;
  --bg-2:#ECE7DC;
  --paper:#FAF7F0;
  --ink:#1A1B1E;
  --ink-2:#2A2C30;
  --ink-3:#4A4E54;
  --mute:#7A7E84;
  --rule:rgba(26,27,30,0.08);
  --rule-2:rgba(26,27,30,0.14);
  --orange:#9B5530;
  --orange-2:#B66A3F;
  --green:#4F7A52;
  --green-2:#6BBF85;
  --serif:'Instrument Serif','Times New Roman',serif;
  --sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --mono:'JetBrains Mono',ui-monospace,monospace;
}
html,body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-feature-settings:"ss01","cv11"}
body{
  min-height:100vh;
  background:
    radial-gradient(900px 540px at 92% -10%, rgba(155,85,48,.06), transparent 60%),
    radial-gradient(700px 420px at -8% 105%, rgba(79,122,82,.05), transparent 65%),
    var(--bg);
  position:relative;
  overflow-x:hidden;
}
body::after{
  content:"";position:fixed;inset:0;pointer-events:none;opacity:.5;
  background-image:
    linear-gradient(to right, rgba(26,27,30,.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(26,27,30,.04) 1px, transparent 1px);
  background-size:48px 48px;
  mask-image:linear-gradient(180deg,#000 0,#000 70%,transparent 100%);
  -webkit-mask-image:linear-gradient(180deg,#000 0,#000 70%,transparent 100%);
  z-index:0;
}
.wrap{position:relative;z-index:1;max-width:560px;margin:0 auto;padding:24px 22px 48px}
@media (min-width:768px){.wrap{max-width:640px;padding:32px 32px 80px}}

/* Header */
.hdr{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--rule)}
.brand{display:inline-flex;align-items:center;color:#14302A;height:22px}
.status{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:var(--mute);font-weight:500}
.pip{width:6px;height:6px;border-radius:50%;background:var(--green-2);box-shadow:0 0 0 0 rgba(107,191,133,.5);animation:pulse 1.8s ease-in-out infinite;flex-shrink:0}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(107,191,133,.5)}50%{box-shadow:0 0 0 6px rgba(107,191,133,0)}}

/* Hero */
.hero{margin-top:56px}
@media (min-width:768px){.hero{margin-top:80px}}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--orange);font-weight:500;margin-bottom:18px}
.eyebrow .dot{width:6px;height:6px;border-radius:50%;background:var(--orange);animation:pulse 2s infinite}
.h1{font-family:var(--serif);font-weight:400;font-size:clamp(48px,8vw,72px);letter-spacing:-.025em;line-height:.96;color:var(--ink);margin:0 0 16px;text-wrap:balance}
.h1 em{font-style:italic;color:var(--orange)}
.lede{font-size:15px;line-height:1.5;color:var(--ink-3);max-width:34ch;margin:0}

/* Live markers */
.markers{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.marker{
  background:var(--paper);
  border:1px solid var(--rule);
  border-radius:12px;
  padding:14px 16px;
}
.marker-name{font-family:var(--serif);font-size:22px;letter-spacing:-.02em;color:var(--ink);line-height:1;margin-bottom:8px}
.marker-meta{display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:9.5px;letter-spacing:.10em;text-transform:uppercase;color:var(--green)}
.marker-meta .pip{width:5px;height:5px;background:var(--green-2)}

/* Email signup */
.signup{margin-top:32px;background:var(--paper);border:1px solid var(--rule);border-radius:14px;padding:20px;box-shadow:0 18px 40px -22px rgba(14,20,16,.18)}
.signup h3{font-family:var(--serif);font-weight:400;font-size:22px;letter-spacing:-.02em;color:var(--ink);line-height:1.1;margin:0 0 6px}
.signup p{font-size:13px;color:var(--ink-3);line-height:1.5;margin:0 0 14px;max-width:42ch}
.email-form{display:flex;gap:8px;flex-wrap:wrap}
.email-input{flex:1;min-width:0;height:46px;padding:0 14px;background:var(--bg);border:1px solid var(--rule-2);border-radius:10px;font-family:var(--sans);font-size:14px;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s}
.email-input:focus{border-color:var(--ink);box-shadow:0 0 0 3px rgba(26,27,30,.08);background:#fff}
.email-input::placeholder{color:var(--mute)}
.email-cta{height:46px;padding:0 18px;background:var(--ink);color:#fff;border:0;border-radius:10px;font-family:var(--sans);font-weight:500;font-size:14px;letter-spacing:-.005em;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:background .15s,transform .12s}
.email-cta:hover{background:var(--ink-2)}
.email-cta:active{transform:scale(.985)}
.email-msg{margin-top:12px;font-family:var(--mono);font-size:11px;letter-spacing:.04em;color:var(--mute);min-height:1em;text-transform:uppercase}
.email-msg.ok{color:var(--green)}
.email-msg.err{color:#A6391E}

/* Footer */
.foot{margin-top:48px;padding-top:18px;border-top:1px solid var(--rule);display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;font-family:var(--mono);font-size:9px;letter-spacing:.10em;color:var(--mute);text-transform:uppercase}
.foot details{position:fixed;right:14px;bottom:12px;z-index:9;padding:4px 10px;border-radius:6px;background:rgba(244,241,234,.78);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.foot summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;text-transform:lowercase;color:rgba(122,126,132,.55);font-weight:500;user-select:none}
.foot summary:hover{color:var(--ink-3)}
.foot summary::-webkit-details-marker{display:none}
.foot details[open] summary{color:var(--ink-3)}
.foot-pwbox{position:absolute;bottom:calc(100% + 12px);right:0;background:#fff;border:1px solid var(--rule-2);border-radius:12px;padding:18px;box-shadow:0 24px 48px -16px rgba(14,20,16,.22);width:300px;z-index:5}
.foot-pwbox-h{font-family:var(--serif);font-style:italic;font-size:18px;color:var(--ink);letter-spacing:-.01em;margin-bottom:12px}
.foot-pwbox .err{font-family:var(--mono);font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:#A6391E;margin-bottom:10px}
.foot-pwbox form{display:flex;flex-direction:column;gap:8px}
.foot-pwbox input{width:100%;height:40px;padding:0 12px;border:1px solid var(--rule);border-radius:8px;font-family:var(--sans);font-size:14px;color:var(--ink);outline:none;background:#fff}
.foot-pwbox input:focus{border-color:var(--ink);box-shadow:0 0 0 3px rgba(26,27,30,.08)}
.foot-pwbox input::placeholder{color:var(--mute)}
.foot-pwbox button{height:40px;padding:0 14px;background:var(--ink);color:#fff;border:0;border-radius:8px;font-weight:500;font-size:13.5px;cursor:pointer;letter-spacing:-.005em;transition:background .15s}
.foot-pwbox button:hover{background:var(--ink-2)}
</style></head><body>
<div class="wrap">
  <header class="hdr">
    <span class="brand" role="img" aria-label="Earthmove">
      <svg width="146" height="22" viewBox="0 0 200 36" fill="none" aria-hidden="true">
        <rect x="0" y="6" width="22" height="3.4" fill="currentColor"></rect>
        <rect x="0" y="16.3" width="18" height="3.4" fill="currentColor"></rect>
        <rect x="0" y="26.6" width="22" height="3.4" fill="currentColor"></rect>
        <text x="28" y="28" font-family="'Inter', system-ui, sans-serif" font-size="26" font-weight="600" letter-spacing="-0.02em" fill="currentColor">arthmove</text>
      </svg>
    </span>
    <span class="status"><span class="pip"></span>Network · standby</span>
  </header>

  <section class="hero">
    <div class="eyebrow"><span class="dot"></span>Live routing · launching today</div>
    <h1 class="h1">Delivered price.<br><em>In seconds.</em></h1>
    <p class="lede">Aggregate routing infrastructure. We open access in waves — drop your email and we'll send a single message when your market clears.</p>
  </section>

  <section class="markers" aria-label="Live markets">
    <div class="marker">
      <div class="marker-name">Denver</div>
      <div class="marker-meta"><span class="pip"></span>Live</div>
    </div>
    <div class="marker">
      <div class="marker-name">Dallas–Fort Worth</div>
      <div class="marker-meta"><span class="pip"></span>Live</div>
    </div>
  </section>

  <section class="signup" aria-label="Notify me">
    <h3>Be among the first to order.</h3>
    <p>One message per market when access opens. No newsletter, no follow-ups.</p>
    <form class="email-form" id="waitForm" autocomplete="off">
      <input id="waitEmail" class="email-input" type="email" name="email" placeholder="you@company.com" required autocomplete="email" inputmode="email">
      <button class="email-cta" type="submit">Notify me<span aria-hidden="true">→</span></button>
    </form>
    <div class="email-msg" id="waitMsg" aria-live="polite"></div>
  </section>

  <footer class="foot">
    <span>&copy; 2026 Earth Pro Connect LLC · Earthmove™</span>
    <details>
      <summary>· admin</summary>
      <div class="foot-pwbox">
        <div class="foot-pwbox-h">Admin sign in</div>
        ${failed ? '<div class="err">Incorrect email or password.</div>' : ''}
        <form method="POST" action="/__gate" autocomplete="off">
          <input type="hidden" name="next" value="${safeNext}">
          <input type="email" name="email" placeholder="Email" autocomplete="email" inputmode="email" required autofocus>
          <input type="password" name="pw" placeholder="Password" autocomplete="current-password" required>
          <button type="submit">Sign in</button>
        </form>
      </div>
    </details>
  </footer>
</div>

<script>
(function(){
  var f = document.getElementById('waitForm');
  var m = document.getElementById('waitMsg');
  var e = document.getElementById('waitEmail');
  if(!f) return;
  f.addEventListener('submit', function(ev){
    ev.preventDefault();
    m.textContent = 'Saving…';
    m.className = 'email-msg';
    fetch('/api/waitlist', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email: e.value })
    }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
      .then(function(res){
        if(res.ok){
          m.textContent = "You're on the list.";
          m.className = 'email-msg ok';
          e.value = '';
        } else {
          m.textContent = (res.j && res.j.error) || 'Something went wrong. Try again.';
          m.className = 'email-msg err';
        }
      })
      .catch(function(){
        m.textContent = 'Network error. Try again.';
        m.className = 'email-msg err';
      });
  });
})();
</script>
</body></html>`
}
