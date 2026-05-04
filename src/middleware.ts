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
  const ADMIN_EMAIL = 'support@filldirtnearme.net'
  if (request.method === 'POST' && request.nextUrl.pathname === '/__gate') {
    const form = await request.formData().catch(() => null)
    const submittedEmail = (form?.get('email') as string | null)?.toLowerCase().trim() ?? ''
    const submittedPw = form?.get('pw')
    const next = (form?.get('next') as string) || '/'
    const emailOk = timingSafeEqual(submittedEmail, ADMIN_EMAIL)
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
<title>Earthmove · Launching May 5, 2026 — Denver + Dallas-Fort Worth</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --paper:#F1ECE2;
  --paper-2:#E9E3D5;
  --evergreen:#1F3D2E;
  --evergreen-2:#0E2A22;
  --ink:#15201B;
  --ink-2:#2A332E;
  --ink-3:#5C645F;
  --hair:#D8D2C4;
  --hair-strong:#C8C0AC;
  --safety:#E5701B;
  --emerald:#2DB37A;
  --cream:#F5F1E8;
  --serif:'Fraunces',Georgia,'Times New Roman',serif;
  --sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --mono:'JetBrains Mono',ui-monospace,monospace;
}
html,body{background:var(--paper);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
body{
  min-height:100vh;
  background:
    radial-gradient(900px 540px at 92% -10%, rgba(31,61,46,.09), transparent 60%),
    radial-gradient(700px 420px at -8% 105%, rgba(229,112,27,.06), transparent 65%),
    var(--paper);
  position:relative;
  overflow-x:hidden;
}
body::after{
  content:"";position:fixed;inset:0;pointer-events:none;opacity:.4;
  background-image:
    linear-gradient(to right, rgba(31,61,46,.045) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(31,61,46,.045) 1px, transparent 1px);
  background-size:64px 64px;
  mask-image:linear-gradient(180deg,#000 0,#000 70%,transparent 100%);
  -webkit-mask-image:linear-gradient(180deg,#000 0,#000 70%,transparent 100%);
  z-index:0;
}
.wrap{position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:32px 28px 64px}
@media (min-width:768px){.wrap{padding:40px 48px 96px}}

/* Header */
.hdr{display:flex;align-items:center;justify-content:space-between;gap:16px}
.status{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--evergreen);font-weight:600}
.pip{width:7px;height:7px;border-radius:50%;background:var(--emerald);box-shadow:0 0 0 0 rgba(45,179,122,.5);animation:pulse 1.8s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(45,179,122,.5)}50%{box-shadow:0 0 0 6px rgba(45,179,122,0)}}

/* Hero */
.hero{margin-top:72px}
@media (min-width:768px){.hero{margin-top:96px}}
.eyebrow{display:inline-flex;align-items:center;gap:10px;font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--evergreen);font-weight:600;margin-bottom:18px}
.eyebrow .dash{width:24px;height:1.5px;background:var(--evergreen);opacity:.5}
.h1-lead{font-family:var(--serif);font-style:normal;font-weight:500;font-size:clamp(48px,8vw,108px);letter-spacing:-.025em;line-height:.95;color:var(--evergreen);text-wrap:balance}
.h1-lead em{font-style:italic;font-weight:400}
.h1-coda{display:block;margin-top:8px;font-family:var(--serif);font-style:italic;font-weight:400;font-size:clamp(22px,3vw,40px);letter-spacing:-.015em;line-height:1.05;color:var(--ink-3)}
.lede{margin-top:32px;max-width:620px;font-size:17px;line-height:1.55;color:var(--ink-2)}
.lede b{color:var(--ink);font-weight:600}

/* Markets grid */
.markets{margin-top:56px;display:grid;grid-template-columns:1fr;gap:18px}
@media (min-width:768px){.markets{grid-template-columns:1fr 1fr;gap:22px}}
.market{
  background:linear-gradient(180deg,#fff 0%,#FBF8F1 100%);
  border:1px solid var(--hair-strong);
  border-radius:18px;
  padding:24px;
  box-shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 0 0 1px rgba(20,50,42,.04), 0 24px 48px -28px rgba(14,42,34,.16);
  position:relative;
}
@media (min-width:768px){.market{padding:28px}}
.market-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.market-name{font-family:var(--serif);font-size:26px;font-weight:500;letter-spacing:-.015em;color:var(--evergreen);line-height:1.1}
.market-name .tld{font-family:var(--sans);font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);display:block;margin-top:6px}
.market-status{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:rgba(45,179,122,.08);border:1px solid rgba(45,179,122,.32);border-radius:6px;font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#1B7A50}
.market-status .pip{width:5px;height:5px}
.market-stats{margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:18px;padding-bottom:18px;border-bottom:1px solid var(--hair)}
.stat-num{font-family:var(--serif);font-style:italic;font-weight:500;font-size:36px;line-height:1;color:var(--evergreen);letter-spacing:-.03em}
.stat-lbl{margin-top:6px;font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);font-weight:600}
.market-mats{margin-top:18px}
.market-mats-eb{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);font-weight:600;margin-bottom:10px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{display:inline-flex;align-items:center;padding:5px 10px;background:var(--paper-2);border:1px solid var(--hair);border-radius:6px;font-size:12px;color:var(--ink-2);font-weight:500;letter-spacing:.005em}
.market-suppliers{margin-top:18px;padding-top:18px;border-top:1px solid var(--hair);font-size:13px;color:var(--ink-3);line-height:1.5}
.market-suppliers b{color:var(--ink-2);font-weight:600}

/* Promise band */
.promise{margin-top:56px;padding:36px 28px;background:var(--evergreen);border-radius:20px;color:var(--cream);position:relative;overflow:hidden}
@media (min-width:768px){.promise{padding:48px;margin-top:72px}}
.promise::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(700px 360px at 100% 0%,rgba(229,112,27,.18),transparent 60%)}
.promise-eb{position:relative;font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(245,241,232,.7);font-weight:600;display:inline-flex;align-items:center;gap:8px}
.promise-h{position:relative;margin-top:14px;font-family:var(--serif);font-weight:500;font-size:clamp(26px,4vw,42px);letter-spacing:-.02em;line-height:1.15;color:#fff;text-wrap:balance}
.promise-h em{font-style:italic;font-weight:400;color:#FFD78A}
.promise-grid{position:relative;margin-top:28px;display:grid;grid-template-columns:1fr;gap:20px}
@media (min-width:640px){.promise-grid{grid-template-columns:repeat(3,1fr);gap:28px}}
.promise-item-eb{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#FFD78A;font-weight:600}
.promise-item-h{margin-top:8px;font-family:var(--serif);font-weight:500;font-size:18px;letter-spacing:-.01em;color:#fff;line-height:1.25}
.promise-item-p{margin-top:6px;font-size:13.5px;color:rgba(245,241,232,.72);line-height:1.55}

/* Email + access */
.signup{margin-top:48px;padding:28px;background:#fff;border:1px solid var(--hair-strong);border-radius:18px;box-shadow:0 24px 48px -28px rgba(14,42,34,.16)}
@media (min-width:768px){.signup{padding:36px 36px 32px;display:grid;grid-template-columns:5fr 7fr;gap:32px;align-items:center}}
.signup-l h3{font-family:var(--serif);font-weight:500;font-size:24px;letter-spacing:-.015em;color:var(--evergreen);line-height:1.2}
.signup-l p{margin-top:8px;font-size:14px;color:var(--ink-3);line-height:1.55}
.signup-r{margin-top:18px}
@media (min-width:768px){.signup-r{margin-top:0}}
.email-form{display:flex;gap:8px;flex-wrap:wrap}
.email-input{flex:1;min-width:0;height:50px;padding:0 16px;background:var(--paper);border:1px solid var(--hair-strong);border-radius:11px;font-family:var(--sans);font-size:15px;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s}
.email-input:focus{border-color:var(--evergreen);box-shadow:0 0 0 4px rgba(31,61,46,.10);background:#fff}
.email-input::placeholder{color:var(--ink-3)}
.email-cta{height:50px;padding:0 22px;background:var(--safety);color:#fff;border:0;border-radius:11px;font-family:var(--sans);font-weight:600;font-size:14.5px;letter-spacing:.005em;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -1.5px 0 rgba(0,0,0,.22),0 10px 22px -10px rgba(229,112,27,.55);transition:background .15s,transform .12s}
.email-cta:hover{background:#C95F12}
.email-cta:active{transform:translateY(1px)}
.email-msg{margin-top:14px;font-size:13px;color:var(--ink-3);min-height:1em}
.email-msg.ok{color:#1B7A50}
.email-msg.err{color:#A6391E}

/* Footer */
.foot{margin-top:48px;padding-top:28px;border-top:1px solid var(--hair);display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--ink-3)}
.foot a{color:var(--ink-3);text-decoration:none}
.foot a:hover{color:var(--evergreen)}
.foot details{position:relative}
.foot summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;text-transform:lowercase;color:rgba(92,100,95,.55);font-weight:500;user-select:none}
.foot summary:hover{color:var(--ink-3)}
.foot summary::-webkit-details-marker{display:none}
.foot details[open] summary{color:var(--ink-3)}
.foot-pwbox{position:absolute;bottom:calc(100% + 12px);right:0;background:#fff;border:1px solid var(--hair-strong);border-radius:12px;padding:18px;box-shadow:0 24px 48px -16px rgba(14,42,34,.22);width:300px;z-index:5}
.foot-pwbox-h{font-family:var(--serif);font-style:italic;font-weight:500;font-size:16px;color:var(--evergreen);letter-spacing:-.01em;margin-bottom:12px}
.foot-pwbox .err{font-size:12px;color:#A6391E;margin-bottom:10px}
.foot-pwbox form{display:flex;flex-direction:column;gap:8px}
.foot-pwbox input{width:100%;height:40px;padding:0 12px;border:1px solid var(--hair);border-radius:8px;font-family:var(--sans);font-size:14px;color:var(--ink);outline:none;background:#fff}
.foot-pwbox input:focus{border-color:var(--evergreen);box-shadow:0 0 0 3px rgba(31,61,46,.10)}
.foot-pwbox input::placeholder{color:var(--ink-3)}
.foot-pwbox button{height:40px;padding:0 14px;background:var(--evergreen);color:#fff;border:0;border-radius:8px;font-weight:600;font-size:13.5px;cursor:pointer;letter-spacing:.005em;transition:background .15s}
.foot-pwbox button:hover{background:var(--evergreen-2)}
</style></head><body>
<div class="wrap">
  <header class="hdr">
    <span role="img" aria-label="Earthmove" style="display:inline-flex"><span style="display:inline-flex;align-items:center;gap:2px"><svg width="18" height="20" viewBox="0 0 72 78" style="display:block;flex-shrink:0" aria-hidden="true"><path d="M0 0 L64 0 L72 6 L64 12 L0 12 Z" fill="#1F3D2E"></path><path d="M0 33 L46 33 L54 39 L46 45 L0 45 Z" fill="#1F3D2E"></path><path d="M0 66 L64 66 L72 72 L64 78 L0 78 Z" fill="#1F3D2E"></path></svg><span style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:28px;font-weight:500;color:#1F3D2E;letter-spacing:-0.05em;line-height:1;margin-left:-1px">ar</span><span style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:28px;font-weight:500;color:#1F3D2E;letter-spacing:-0.05em;line-height:1;margin-left:1px">thmove</span></span></span>
    <span class="status"><span class="pip"></span>Network · standby</span>
  </header>

  <section class="hero">
    <div class="eyebrow"><span class="dash"></span>Launching Monday · May 5, 2026</div>
    <h1 class="h1-lead">We move <em>earth</em>.<span class="h1-coda">All of it.</span></h1>
    <p class="lede">
      Earthmove launches <b>May 5</b> in <b>Denver</b> and <b>Dallas–Fort Worth</b> with five verified
      suppliers across thirteen yards. The smartest dispatch in the industry — real load matching from
      the closest yard, lower delivered cost than any broker, and a truck that actually shows up.
    </p>
  </section>

  <section class="markets" aria-label="Launch markets">
    <article class="market">
      <div class="market-head">
        <div>
          <div class="market-name">Denver<span class="tld">Colorado · Front Range</span></div>
        </div>
        <div class="market-status"><span class="pip"></span>Live May 5</div>
      </div>
      <div class="market-stats">
        <div><div class="stat-num">6</div><div class="stat-lbl">Verified yards</div></div>
        <div><div class="stat-num">2</div><div class="stat-lbl">Launch suppliers</div></div>
      </div>
      <div class="market-mats">
        <div class="market-mats-eb">Day-one materials</div>
        <div class="chips">
          <span class="chip">Class 6 base</span>
          <span class="chip">Recycled concrete</span>
          <span class="chip">Recycled asphalt (RAP)</span>
          <span class="chip">#57 washed rock</span>
          <span class="chip">Concrete sand</span>
          <span class="chip">Mason sand</span>
        </div>
      </div>
    </article>

    <article class="market">
      <div class="market-head">
        <div>
          <div class="market-name">Dallas–Fort Worth<span class="tld">Texas · Metroplex</span></div>
        </div>
        <div class="market-status"><span class="pip"></span>Live May 5</div>
      </div>
      <div class="market-stats">
        <div><div class="stat-num">7</div><div class="stat-lbl">Verified yards</div></div>
        <div><div class="stat-num">3</div><div class="stat-lbl">Launch suppliers</div></div>
      </div>
      <div class="market-mats">
        <div class="market-mats-eb">Day-one materials</div>
        <div class="chips">
          <span class="chip">Select fill</span>
          <span class="chip">Flex base</span>
          <span class="chip">Crushed limestone</span>
          <span class="chip">Decomposed granite</span>
          <span class="chip">Concrete sand</span>
          <span class="chip">Mason sand</span>
          <span class="chip">Pea gravel</span>
        </div>
      </div>
    </article>
  </section>

  <section class="promise">
    <div class="promise-eb"><span class="pip" style="background:#FFD78A"></span>What ships day one</div>
    <h2 class="promise-h">Closest yard wins. Live ETA. <em>Photo-confirmed</em> drop.</h2>
    <div class="promise-grid">
      <div>
        <div class="promise-item-eb">Closest yard wins</div>
        <div class="promise-item-h">Routed, not queued</div>
        <p class="promise-item-p">Every load matched to the nearest verified yard for the lowest delivered cost — not the yard that picks up the phone first.</p>
      </div>
      <div>
        <div class="promise-item-eb">Live ETA</div>
        <div class="promise-item-h">Arrival to the minute</div>
        <p class="promise-item-p">Driver assigned, route locked, GPS-tracked from the scale. No "later this week."</p>
      </div>
      <div>
        <div class="promise-item-eb">Photo-confirmed drop</div>
        <div class="promise-item-h">BOL on tip</div>
        <p class="promise-item-p">Geotagged photo + signed ticket attached to the invoice the moment the truck tips. Proof on file before the driver leaves.</p>
      </div>
    </div>
  </section>

  <section class="signup" aria-label="Notify me">
    <div class="signup-l">
      <h3>Be among the first to order.</h3>
      <p>Drop your email. We'll send a single message the morning we go live in your market. Nothing else.</p>
    </div>
    <div class="signup-r">
      <form class="email-form" id="waitForm" autocomplete="off">
        <input id="waitEmail" class="email-input" type="email" name="email" placeholder="you@company.com" required autocomplete="email" inputmode="email">
        <button class="email-cta" type="submit">Notify me<span aria-hidden="true">→</span></button>
      </form>
      <div class="email-msg" id="waitMsg" aria-live="polite"></div>
    </div>
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
    m.textContent = 'Saving...';
    m.className = 'email-msg';
    fetch('/api/waitlist', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email: e.value })
    }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
      .then(function(res){
        if(res.ok){
          m.textContent = "You're on the list. We'll be in touch on May 5.";
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
