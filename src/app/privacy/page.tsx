export const dynamic = 'force-dynamic'

// src/app/(marketplace)/privacy/page.tsx
//
// Privacy Policy. Static Server Component, prose-first.
// Same .lr-page CSS pattern as /legal/refunds and /terms.

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy · EarthMove',
  description:
    'How EarthMove collects, uses, and protects your information across the marketplace and Groundcheck verification service. Effective April 30, 2026.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'EarthMove Privacy Policy',
    description: 'How we handle your data at EarthMove.',
    url: '/privacy',
    type: 'article',
  },
  robots: { index: true, follow: true },
};

const PRIVACY_CSS = `
.lr-page {
  --paper:#F1ECE2; --paper-2:#E9E3D5; --card:#FFFFFF; --card-muted:#F6F2E8;
  --panel:#14322A;
  --ink:#15201B; --ink-2:#2A332E; --ink-3:#5C645F;
  --orange:#E5701B; --emerald:#2DB37A; --emerald-soft:#1F8A5C; --emerald-pale:#E6F1E9;
  --amber:#E0A52A; --amber-pale:#FBEFD0;
  --hair:#D8D2C4; --hair-strong:#C8C0AC;
  background: var(--paper); color: var(--ink);
  font-family: var(--font-inter), -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.lr-page main { max-width: 780px; margin: 0 auto; padding: 64px 32px 96px; }
.lr-page a { color: var(--ink-2); text-decoration: underline; text-decoration-color: var(--hair-strong); text-underline-offset: 3px; }
.lr-page a:hover { color: var(--ink); text-decoration-color: var(--ink); }
.lr-page .hero-strip { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 32px 36px; margin-bottom: 48px; display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: center; }
.lr-page .hero-strip .label { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3); display: inline-flex; align-items: center; gap: 10px; }
.lr-page .hero-strip .label::before { content: ""; width: 18px; height: 1.5px; background: var(--ink-3); }
.lr-page .hero-strip h1 { font-family: var(--font-fraunces), serif; font-weight: 600; font-size: 42px; line-height: 1.05; letter-spacing: -0.02em; margin: 8px 0 0; }
.lr-page .hero-strip h1 em { font-style: italic; font-weight: 500; }
.lr-page .hero-strip .stamp { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; font-size: 11.5px; color: var(--ink-3); text-align: right; letter-spacing: 0.04em; }
.lr-page .hero-strip .stamp b { display: block; color: var(--ink); font-weight: 600; font-size: 13px; margin-bottom: 2px; letter-spacing: 0; }
.lr-page .toc { background: var(--card-muted); border: 1px solid var(--hair); border-radius: 12px; padding: 20px 24px; margin-bottom: 40px; }
.lr-page .toc h2 { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3); margin: 0 0 12px; font-weight: 600; }
.lr-page .toc ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; counter-reset: toc; }
.lr-page .toc ol li { counter-increment: toc; font-size: 13.5px; display: flex; gap: 10px; align-items: baseline; }
.lr-page .toc ol li::before { content: counter(toc, decimal-leading-zero); font-family: var(--font-jetbrains-mono), ui-monospace, monospace; font-size: 10.5px; color: var(--ink-3); font-weight: 500; }
.lr-page .toc ol li a { text-decoration: none; color: var(--ink-2); }
.lr-page .toc ol li a:hover { color: var(--orange); }
.lr-page article h2 { font-family: var(--font-fraunces), serif; font-weight: 600; font-size: 28px; line-height: 1.15; letter-spacing: -0.015em; margin: 48px 0 14px; color: var(--ink); scroll-margin-top: 24px; }
.lr-page article h2:first-of-type { margin-top: 0; }
.lr-page article h2 em { font-style: italic; font-weight: 500; }
.lr-page article h3 { font-family: var(--font-fraunces), serif; font-weight: 600; font-size: 18px; letter-spacing: -0.01em; margin: 28px 0 8px; color: var(--ink); }
.lr-page article p { font-size: 15px; line-height: 1.65; color: var(--ink-2); margin: 0 0 16px; }
.lr-page article p b, .lr-page article li b { color: var(--ink); font-weight: 600; }
.lr-page article ul { margin: 0 0 16px; padding: 0 0 0 22px; display: flex; flex-direction: column; gap: 8px; }
.lr-page article ul li { font-size: 15px; line-height: 1.6; color: var(--ink-2); padding-left: 4px; }
.lr-page .timing-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: var(--card); border: 1px solid var(--hair); border-radius: 10px; overflow: hidden; }
.lr-page .timing-table th, .lr-page .timing-table td { padding: 12px 18px; text-align: left; font-size: 13.5px; line-height: 1.5; border-bottom: 1px solid var(--hair); }
.lr-page .timing-table thead th { background: var(--card-muted); font-family: var(--font-jetbrains-mono), ui-monospace, monospace; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); font-weight: 600; }
.lr-page .timing-table tbody tr:last-child td { border-bottom: 0; }
.lr-page .timing-table td:first-child { font-weight: 600; color: var(--ink); }
.lr-page .callout { background: var(--amber-pale); border-left: 3px solid var(--amber); padding: 16px 20px; border-radius: 8px; margin: 20px 0; font-size: 14px; line-height: 1.6; color: var(--ink-2); }
.lr-page .callout b { color: var(--ink); font-weight: 600; }
.lr-page .contact-block { background: var(--panel); color: #F1ECE2; border-radius: 14px; padding: 32px 36px; margin: 48px 0 0; }
.lr-page .contact-block h3 { font-family: var(--font-fraunces), serif; font-weight: 600; font-size: 22px; letter-spacing: -0.015em; margin: 0 0 8px; color: #fff; }
.lr-page .contact-block p { font-size: 14px; line-height: 1.6; color: #A9B4AC; margin: 0 0 14px; }
.lr-page .contact-block .email { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; font-size: 14px; color: #fff; background: rgba(255,255,255,0.08); padding: 10px 14px; border-radius: 8px; display: inline-block; }
.lr-page .contact-block .email b { color: var(--orange); font-weight: 500; }
.lr-page .contact-block a { color: #fff; }
@media (max-width: 760px) {
  .lr-page .hero-strip { grid-template-columns: 1fr; }
  .lr-page .hero-strip .stamp { text-align: left; }
  .lr-page .hero-strip h1 { font-size: 32px; }
  .lr-page main { padding: 40px 22px 64px; }
  .lr-page article h2 { font-size: 22px; margin-top: 36px; }
}

.lr-page .topnav { border-bottom: 1px solid var(--hair); background: var(--paper); }
.lr-page .topnav .wrap { max-width: 1100px; margin: 0 auto; padding: 18px 32px; display: flex; align-items: center; justify-content: space-between; }
.lr-page .topnav .brand { display: flex; align-items: center; gap: 10px; font-family: var(--font-fraunces), serif; font-weight: 700; font-size: 18px; letter-spacing: -0.01em; color: var(--ink); text-decoration: none; }
.lr-page .topnav .brand .logo { width: 30px; height: 30px; border-radius: 7px; background: var(--panel); color: #F1ECE2; display: flex; align-items: center; justify-content: center; }
.lr-page .topnav .links { display: flex; gap: 24px; font-size: 13.5px; color: var(--ink-2); }
.lr-page .topnav .links a { color: var(--ink-2); text-decoration: none; }
.lr-page .topnav .links a:hover { color: var(--ink); }

.lr-page .page-footer { background: var(--paper); border-top: 1px solid var(--hair); padding: 32px; margin-top: 48px; }
.lr-page .page-footer .wrap { max-width: 1100px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; }
.lr-page .page-footer .left { font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; color: var(--ink-3); letter-spacing: 0.04em; }
.lr-page .page-footer .right { display: flex; gap: 20px; font-size: 12.5px; color: var(--ink-3); }
.lr-page .page-footer .right a { color: var(--ink-3); text-decoration: none; }
.lr-page .page-footer .right a:hover { color: var(--ink); }

@media (max-width: 760px) {
  .lr-page .topnav .wrap { padding: 14px 22px; }
  .lr-page .topnav .links { gap: 14px; font-size: 12.5px; }
  .lr-page .topnav .links a:nth-child(3) { display: none; }
}
`;

export default function PrivacyPage() {
  return (
    <div className="lr-page">
      <style dangerouslySetInnerHTML={{ __html: PRIVACY_CSS }} />
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
        <section className="hero-strip">
          <div>
            <span className="label">Legal · Policies</span>
            <h1>Privacy <em>Policy.</em></h1>
          </div>
          <div className="stamp">
            <b>Effective</b>April 30, 2026<br/>
            <span style={{ color: 'var(--ink-3)' }}>Last updated: April 30, 2026</span>
          </div>
        </section>

        <nav className="toc" aria-label="Table of contents">
          <h2>On this page</h2>
          <ol>
            <li><a href="#scope">Scope &amp; summary</a></li>
            <li><a href="#collect">Information we collect</a></li>
            <li><a href="#use">How we use your information</a></li>
            <li><a href="#share">Sharing &amp; disclosure</a></li>
            <li><a href="#groundcheck">Groundcheck-specific data</a></li>
            <li><a href="#cookies">Cookies &amp; tracking</a></li>
            <li><a href="#security">Security</a></li>
            <li><a href="#retention">Retention</a></li>
            <li><a href="#rights">Your rights &amp; choices</a></li>
            <li><a href="#california">California residents (CCPA)</a></li>
            <li><a href="#children">Children&rsquo;s privacy</a></li>
            <li><a href="#changes">Changes to this policy</a></li>
            <li><a href="#contact">Contact</a></li>
          </ol>
        </nav>

        <article>
          <h2 id="scope">1. Scope &amp; summary</h2>
          <p>
            This Privacy Policy describes how Earth Pro Connect LLC (&ldquo;EarthMove,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, shares, and protects information when you use earthmove.io, the Groundcheck verification service, and related products.
          </p>
          <div className="callout">
            <b>Plain-language summary:</b> We collect what we need to deliver materials and run trust verifications. We don&rsquo;t sell your personal data. We use Stripe for payments, Supabase for our database, and standard analytics tools. You can request your data, correct it, or delete your account by emailing <a href="mailto:support@earthmove.io">support@earthmove.io</a>.
          </div>

          <h2 id="collect">2. Information we collect</h2>

          <h3>Information you provide directly</h3>
          <ul>
            <li><b>Account information</b> — name, email, phone, company name (for contractor accounts), role</li>
            <li><b>Order information</b> — delivery address, project notes, material specifications, quantity</li>
            <li><b>Payment information</b> — handled by Stripe; we do not store card numbers, only customer IDs and last-four/brand metadata for receipt rendering</li>
            <li><b>Communications</b> — emails, support chat messages, SMS replies to dispatch notifications</li>
            <li><b>Search queries</b> — what you search on Groundcheck (the entity name; not the searcher&rsquo;s identity beyond your account)</li>
          </ul>

          <h3>Information collected automatically</h3>
          <ul>
            <li><b>Device &amp; usage</b> — IP address, browser type, operating system, pages visited, referring URL</li>
            <li><b>Location</b> — approximate location from IP for market routing; precise location only for drivers using the dispatch app, with explicit consent</li>
            <li><b>Cookies &amp; identifiers</b> — see Section 6</li>
          </ul>

          <h3>Information from third parties</h3>
          <ul>
            <li><b>Groundcheck verification sources</b> — publicly available business information used to compose verification reports (see Section 5)</li>
            <li><b>Authentication providers</b> — if you sign in via Google, Apple, or another OAuth provider, we receive your name and email</li>
            <li><b>Payment processors</b> — Stripe shares transaction status and risk signals</li>
          </ul>

          <h2 id="use">3. How we use your information</h2>
          <p>We use information to:</p>
          <ul>
            <li>Provide, operate, and improve the Service</li>
            <li>Process orders and coordinate dispatch with suppliers and drivers</li>
            <li>Generate Groundcheck verification reports for entities you search</li>
            <li>Send transactional communications (order confirmations, receipts, delivery notifications, password resets)</li>
            <li>Send marketing communications you&rsquo;ve opted into; you can unsubscribe at any time</li>
            <li>Detect and prevent fraud, abuse, and security incidents</li>
            <li>Comply with legal obligations</li>
            <li>Aggregate and anonymize data for product analytics, business reporting, and research</li>
          </ul>

          <h2 id="share">4. Sharing &amp; disclosure</h2>
          <p>We do not sell your personal information. We share information only as follows:</p>
          <ul>
            <li><b>With suppliers and drivers</b> — only what&rsquo;s needed to fulfill your order (delivery address, contact phone, material specs)</li>
            <li><b>With service providers</b> — payment processing (Stripe), database (Supabase), email (transactional providers), SMS (Twilio), mapping (MapLibre/OpenFreeMap), error tracking, analytics. These providers process data on our behalf under contractual privacy and security obligations.</li>
            <li><b>For legal reasons</b> — to comply with subpoenas, court orders, or other legal process; to enforce our Terms; to protect our rights, property, or safety</li>
            <li><b>In a corporate transaction</b> — if EarthMove is involved in a merger, acquisition, or asset sale, your information may be transferred subject to standard confidentiality protections</li>
            <li><b>With your consent</b> — when you explicitly direct us to share with a third party</li>
          </ul>

          <h2 id="groundcheck">5. Groundcheck-specific data</h2>
          <p>
            Groundcheck reports are about <b>registered business entities</b> — LLCs, corporations, partnerships, and trusts — not individuals. Reports are composed from publicly available information about those entities. Sole proprietors operating under personal names fall outside Groundcheck&rsquo;s scope.
          </p>
          <p>
            Groundcheck is <b>not</b> a consumer reporting agency. Reports are not consumer reports under the Fair Credit Reporting Act and may not be used for FCRA-regulated purposes including employment screening, tenant screening, or consumer credit decisions.
          </p>
          <p>
            <b>Subjects of Groundcheck reports</b> may request a copy of the information we have compiled about their entity, dispute factual inaccuracies, or request that we cease maintaining a profile. Email <a href="mailto:support@earthmove.io?subject=Groundcheck%20subject%20request">support@earthmove.io</a> with subject line &ldquo;Groundcheck subject request&rdquo; to begin the process.
          </p>

          <h2 id="cookies">6. Cookies &amp; tracking</h2>
          <p>We use cookies and similar technologies for:</p>
          <ul>
            <li><b>Strictly necessary</b> — authentication, session management, security, payment processing</li>
            <li><b>Functional</b> — remembering your market preference, dashboard layout, recent searches</li>
            <li><b>Analytics</b> — measuring page performance and aggregate usage patterns</li>
          </ul>
          <p>
            We do not use cross-site advertising trackers. You can control cookies through your browser settings; blocking strictly-necessary cookies will prevent core functionality (you won&rsquo;t be able to sign in, place orders, or run Groundcheck lookups).
          </p>

          <h2 id="security">7. Security</h2>
          <p>
            We use industry-standard security practices including TLS encryption in transit, encryption at rest for sensitive fields, access controls, audit logging, and regular security reviews. Payment data is handled by Stripe under PCI-DSS Level 1 compliance.
          </p>
          <p>
            No security system is impenetrable. If we discover a security incident affecting your information, we will notify you in accordance with applicable law.
          </p>

          <h2 id="retention">8. Retention</h2>
          <table className="timing-table">
            <thead><tr><th>Data category</th><th>Retention period</th></tr></thead>
            <tbody>
              <tr><td>Account information</td><td>Lifetime of account + 90 days after deletion</td></tr>
              <tr><td>Order &amp; transaction records</td><td>7 years (tax &amp; financial compliance)</td></tr>
              <tr><td>Driver location pings</td><td>90 days hot, archived thereafter</td></tr>
              <tr><td>Groundcheck reports</td><td>7 years (audit retention)</td></tr>
              <tr><td>Support communications</td><td>3 years</td></tr>
              <tr><td>Marketing engagement data</td><td>Until you unsubscribe + 1 year</td></tr>
              <tr><td>Aggregated analytics</td><td>Indefinitely (anonymized)</td></tr>
            </tbody>
          </table>

          <h2 id="rights">9. Your rights &amp; choices</h2>
          <p>You have the right to:</p>
          <ul>
            <li><b>Access</b> — request a copy of personal information we hold about you</li>
            <li><b>Correct</b> — update inaccurate information</li>
            <li><b>Delete</b> — request deletion of your account and personal information (subject to retention obligations in Section 8)</li>
            <li><b>Port</b> — receive your data in a portable format</li>
            <li><b>Object &amp; restrict</b> — opt out of marketing communications, restrict certain processing</li>
          </ul>
          <p>
            To exercise these rights, email <a href="mailto:support@earthmove.io?subject=Privacy%20rights%20request">support@earthmove.io</a> with subject line &ldquo;Privacy rights request.&rdquo; We respond within 30 days; complex requests may take up to 45 days.
          </p>

          <h2 id="california">10. California residents (CCPA)</h2>
          <p>
            California residents have additional rights under the California Consumer Privacy Act including the right to know what personal information we have collected, the right to delete it, and the right to opt out of sale (we do not sell personal information). To exercise these rights, use the contact channel in Section 9 with subject line &ldquo;CCPA request.&rdquo;
          </p>
          <p>
            We will not discriminate against you for exercising your privacy rights.
          </p>

          <h2 id="children">11. Children&rsquo;s privacy</h2>
          <p>
            EarthMove is not directed at children under 13 (or 16 in jurisdictions where that is the applicable threshold). We do not knowingly collect personal information from children. If we become aware that we have collected information from a child without parental consent, we will delete it.
          </p>

          <h2 id="changes">12. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy. Material changes will be posted at this URL with a revised &ldquo;Last updated&rdquo; date and, where required by law, communicated to active users. Continued use of the Service after a change constitutes acceptance.
          </p>

          <h2 id="contact">13. Contact</h2>
          <p>For privacy questions or to exercise your rights:</p>
          <div className="contact-block">
            <h3>Privacy &amp; data requests</h3>
            <p>We respond within 30 days. Include relevant details in the email subject line for faster routing.</p>
            <span className="email">support@<b>earthmove.io</b></span>
          </div>
        </article>
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
