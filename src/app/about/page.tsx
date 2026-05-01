// src/app/(marketplace)/about/page.tsx
//
// About page. Story-driven Server Component. No tagline overload — direct, factual.

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About · EarthMove',
  description:
    'EarthMove is the marketplace for bulk aggregate materials. We started in Denver in 2026 with a simple idea: the dirt economy is a real economy, and it deserves real software.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About EarthMove',
    description: 'The marketplace for bulk aggregate materials.',
    url: '/about',
    type: 'website',
  },
};

const ABOUT_CSS = `
.ab-page {
  --paper:#F1ECE2; --paper-2:#E9E3D5; --card:#FFFFFF; --card-muted:#F6F2E8;
  --panel:#14322A;
  --ink:#15201B; --ink-2:#2A332E; --ink-3:#5C645F;
  --orange:#E5701B; --emerald:#2DB37A; --emerald-soft:#1F8A5C;
  --hair:#D8D2C4; --hair-strong:#C8C0AC;
  background: var(--paper); color: var(--ink);
  font-family: var(--font-inter), -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.ab-page main { max-width: 820px; margin: 0 auto; padding: 80px 32px 96px; }
.ab-page a { color: var(--ink); text-decoration: underline; text-decoration-color: var(--orange); text-underline-offset: 4px; }
.ab-page a:hover { text-decoration-thickness: 2px; }

.ab-page .label {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
  display: inline-flex; align-items: center; gap: 10px; margin-bottom: 14px;
}
.ab-page .label::before { content: ""; width: 18px; height: 1.5px; background: var(--ink-3); }

.ab-page h1 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: clamp(40px, 6vw, 64px); line-height: 1.04; letter-spacing: -0.025em;
  margin: 0 0 24px;
}
.ab-page h1 em { font-style: italic; font-weight: 500; }

.ab-page .lede {
  font-size: 19px; line-height: 1.55; color: var(--ink-2); max-width: 680px; margin: 0 0 64px;
}
.ab-page .lede b { color: var(--ink); font-weight: 600; }

.ab-page section { margin-bottom: 56px; }
.ab-page section h2 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: 30px; line-height: 1.1; letter-spacing: -0.02em;
  margin: 0 0 18px;
}
.ab-page section h2 em { font-style: italic; font-weight: 500; }

.ab-page section p { font-size: 16px; line-height: 1.7; color: var(--ink-2); margin: 0 0 18px; max-width: 680px; }
.ab-page section p b { color: var(--ink); font-weight: 600; }

.ab-page .pull-quote {
  font-family: var(--font-fraunces), serif; font-style: italic; font-weight: 500;
  font-size: 26px; line-height: 1.4; color: var(--ink);
  border-left: 3px solid var(--orange); padding: 8px 0 8px 24px; margin: 32px 0; max-width: 680px;
}

.ab-page .stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0;
  background: var(--card); border: 1px solid var(--hair); border-radius: 14px;
  overflow: hidden; margin: 40px 0;
}
.ab-page .stats .cell { padding: 24px; border-right: 1px solid var(--hair); }
.ab-page .stats .cell:last-child { border-right: 0; }
.ab-page .stats .cell .l {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3);
}
.ab-page .stats .cell .v {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: 32px; letter-spacing: -0.02em; line-height: 1.05; margin: 6px 0 4px;
}
.ab-page .stats .cell .v em { color: var(--orange); font-style: normal; font-weight: 700; }
.ab-page .stats .cell .sub { font-size: 12.5px; color: var(--ink-3); line-height: 1.4; }

.ab-page .principles {
  display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 24px;
}
.ab-page .principles .p {
  background: var(--card); border: 1px solid var(--hair); border-radius: 12px;
  padding: 24px;
}
.ab-page .principles .p .num {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.14em; color: var(--ink-3);
}
.ab-page .principles .p h3 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: 18px; letter-spacing: -0.01em; margin: 8px 0 8px;
}
.ab-page .principles .p p { font-size: 14px; line-height: 1.55; color: var(--ink-2); margin: 0; max-width: none; }

.ab-page .cta-band {
  background: var(--panel); color: #F1ECE2; border-radius: 18px;
  padding: 48px; margin-top: 64px; text-align: center;
}
.ab-page .cta-band h2 { color: #fff; margin: 0 0 12px; font-size: 32px; }
.ab-page .cta-band p { color: #A9B4AC; max-width: 540px; margin: 0 auto 24px; }
.ab-page .cta-band a {
  display: inline-block; background: var(--orange); color: #fff; text-decoration: none;
  padding: 14px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; letter-spacing: -0.005em;
}
.ab-page .cta-band a:hover { background: #C95F12; }

@media (max-width: 760px) {
  .ab-page main { padding: 48px 22px 64px; }
  .ab-page .stats { grid-template-columns: 1fr; }
  .ab-page .stats .cell { border-right: 0; border-bottom: 1px solid var(--hair); }
  .ab-page .stats .cell:last-child { border-bottom: 0; }
  .ab-page .principles { grid-template-columns: 1fr; }
  .ab-page .pull-quote { font-size: 22px; }
}

.ab-page .topnav { border-bottom: 1px solid var(--hair); background: var(--paper); }
.ab-page .topnav .wrap { max-width: 1100px; margin: 0 auto; padding: 18px 32px; display: flex; align-items: center; justify-content: space-between; }
.ab-page .topnav .brand { display: flex; align-items: center; gap: 10px; font-family: var(--font-fraunces), serif; font-weight: 700; font-size: 18px; letter-spacing: -0.01em; color: var(--ink); text-decoration: none; }
.ab-page .topnav .brand .logo { width: 30px; height: 30px; border-radius: 7px; background: var(--panel); color: #F1ECE2; display: flex; align-items: center; justify-content: center; }
.ab-page .topnav .links { display: flex; gap: 24px; font-size: 13.5px; color: var(--ink-2); }
.ab-page .topnav .links a { color: var(--ink-2); text-decoration: none; }
.ab-page .topnav .links a:hover { color: var(--ink); }

.ab-page .page-footer { background: var(--paper); border-top: 1px solid var(--hair); padding: 32px; margin-top: 48px; }
.ab-page .page-footer .wrap { max-width: 1100px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; }
.ab-page .page-footer .left { font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; color: var(--ink-3); letter-spacing: 0.04em; }
.ab-page .page-footer .right { display: flex; gap: 20px; font-size: 12.5px; color: var(--ink-3); }
.ab-page .page-footer .right a { color: var(--ink-3); text-decoration: none; }
.ab-page .page-footer .right a:hover { color: var(--ink); }

@media (max-width: 760px) {
  .ab-page .topnav .wrap { padding: 14px 22px; }
  .ab-page .topnav .links { gap: 14px; font-size: 12.5px; }
  .ab-page .topnav .links a:nth-child(3) { display: none; }
}
`;

export default function AboutPage() {
  return (
    <div className="ab-page">
      <style dangerouslySetInnerHTML={{ __html: ABOUT_CSS }} />
      <header className="topnav">
        <div className="wrap">
          <Link href="/" className="brand">
            <span className="logo">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8 L7 12 L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            EarthMove
          </Link>
          <nav className="links">
            <Link href="/about">About</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/trust">Groundcheck</Link>
            <a href="mailto:support@earthmove.io">Contact</a>
          </nav>
        </div>
      </header>
      <main>
        <span className="label">About EarthMove</span>
        <h1>The marketplace for the <em>dirt economy.</em></h1>
        <p className="lede">
          EarthMove connects homeowners and contractors with suppliers and drivers for the bulk aggregate materials that move every construction project — fill dirt, road base, crushed stone, sand, gravel, topsoil. <b>Our mission is simple: make moving dirt as fast and trustworthy as ordering anything else online.</b>
        </p>

        <section>
          <h2>Why this exists.</h2>
          <p>
            The aggregate materials industry moves a trillion-dollar economy of physical infrastructure, but the way contractors find suppliers and homeowners hire crews hasn&rsquo;t meaningfully changed in decades. It&rsquo;s still phone calls, faxed quotes, cash deposits, and &ldquo;trust me on this one.&rdquo; The result: too many bad outcomes for buyers, too many empty backhauls for drivers, and too much margin lost to inefficiency.
          </p>
          <div className="pull-quote">
            We&rsquo;re building the software the construction industry should have had a decade ago — and the trust layer it&rsquo;s never had at all.
          </div>
          <p>
            EarthMove launched out of Denver in 2026. We started with one operator, one yard, and a real conviction that the underlying problems — verification, dispatch, payment, trust — were software problems hiding in trade clothes. We&rsquo;re now building across ten launch markets, with Denver and Dallas-Fort Worth as our co-equal launch cities.
          </p>
        </section>

        <section>
          <h2>What we run.</h2>
          <p>
            EarthMove is two products that work together:
          </p>
          <p>
            <b>The marketplace</b> at <Link href="/">earthmove.io</Link> — order bulk materials with delivery, track loads in real time, dispatch through our driver network. Same operational quality as ordering a meal, except the &ldquo;meal&rdquo; is twenty tons of road base going to a job site.
          </p>
          <p>
            <b>Groundcheck</b> at <Link href="/trust">earthmove.io/trust</Link> — verification and trust scoring for the construction industry&rsquo;s contractor and supplier relationships. Run a check on any registered business entity in seconds before you sign a contract or issue a PO.
          </p>
        </section>

        <section>
          <h2>By the numbers.</h2>
          <div className="stats">
            <div className="cell">
              <span className="l">Operating across</span>
              <span className="v"><em>10</em> launch markets</span>
              <span className="sub">Denver and Dallas-Fort Worth lead, expanding through 2026</span>
            </div>
            <div className="cell">
              <span className="l">Construction industry</span>
              <span className="v"><em>$2.3T</em> US</span>
              <span className="sub">Every project starts with earthwork</span>
            </div>
            <div className="cell">
              <span className="l">Trucking miles</span>
              <span className="v"><em>20-35%</em> empty</span>
              <span className="sub">Backhaul is the hidden margin we close</span>
            </div>
          </div>
        </section>

        <section>
          <h2>How we operate.</h2>
          <div className="principles">
            <div className="p">
              <span className="num">01</span>
              <h3>Software, not paperwork</h3>
              <p>Quotes, dispatch, scale tickets, BOLs, payments — all digital, all auditable. The phone is a fallback, not the primary channel.</p>
            </div>
            <div className="p">
              <span className="num">02</span>
              <h3>Drivers earn more</h3>
              <p>Backhaul matching turns empty return miles into paid loads. Better economics for drivers means better availability for you.</p>
            </div>
            <div className="p">
              <span className="num">03</span>
              <h3>Trust is verifiable</h3>
              <p>Groundcheck makes contractor and supplier verification a 30-second decision instead of a 30-day liability. Standard for everyone, not just the enterprise buyers who can afford to pay $5,000/year for it.</p>
            </div>
            <div className="p">
              <span className="num">04</span>
              <h3>Local depth, national reach</h3>
              <p>Every market gets local supplier relationships, local pricing, local routing. We&rsquo;re not running a national platform on top of strangers — we&rsquo;re operating in your city.</p>
            </div>
          </div>
        </section>

        <section>
          <h2>Where we&rsquo;re headed.</h2>
          <p>
            We&rsquo;re focused on closing every step of the dirt economy&rsquo;s information gap: better pricing transparency, faster dispatch, real-time tracking, integrated billing, verified vendor relationships, and a fair payment loop for the drivers who make every project move.
          </p>
          <p>
            We move fast and we ship things. If you&rsquo;re a contractor, supplier, or driver who wants to be part of how this gets built, we want to hear from you.
          </p>
        </section>

        <div className="cta-band">
          <h2>Get started.</h2>
          <p>Place your first order, or run a free Groundcheck on any contractor before you sign.</p>
          <Link href="/material-match">Order materials →</Link>
        </div>
      </main>
      <footer className="page-footer">
        <div className="wrap">
          <div className="left">© 2026 EarthMove · Earth Pro Connect LLC</div>
          <nav className="right">
            <Link href="/legal/refunds">Refunds</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <a href="mailto:support@earthmove.io">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
