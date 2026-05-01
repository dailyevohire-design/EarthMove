export const dynamic = 'force-dynamic'

// src/app/(marketplace)/terms/page.tsx
//
// Terms of Service. Static Server Component, prose-first.
// Same .lr-page CSS pattern as /legal/refunds for visual consistency.

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service · EarthMove',
  description:
    'EarthMove Terms of Service governing use of the marketplace, Groundcheck, and related services. Effective April 30, 2026.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'EarthMove Terms of Service',
    description: 'Terms governing use of the EarthMove marketplace and Groundcheck.',
    url: '/terms',
    type: 'article',
  },
  robots: { index: true, follow: true },
};

const TERMS_CSS = `
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

export default function TermsPage() {
  return (
    <div className="lr-page">
      <style dangerouslySetInnerHTML={{ __html: TERMS_CSS }} />
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
            <h1>Terms of <em>Service.</em></h1>
          </div>
          <div className="stamp">
            <b>Effective</b>April 30, 2026<br/>
            <span style={{ color: 'var(--ink-3)' }}>Last updated: April 30, 2026</span>
          </div>
        </section>

        <nav className="toc" aria-label="Table of contents">
          <h2>On this page</h2>
          <ol>
            <li><a href="#agreement">Agreement to terms</a></li>
            <li><a href="#service">Description of service</a></li>
            <li><a href="#accounts">Accounts &amp; eligibility</a></li>
            <li><a href="#orders">Orders &amp; marketplace transactions</a></li>
            <li><a href="#groundcheck">Groundcheck subscription terms</a></li>
            <li><a href="#payment">Payment, billing &amp; taxes</a></li>
            <li><a href="#conduct">Acceptable use</a></li>
            <li><a href="#ip">Intellectual property</a></li>
            <li><a href="#disclaimer">Disclaimers &amp; limitation of liability</a></li>
            <li><a href="#indemnity">Indemnification</a></li>
            <li><a href="#governing">Governing law &amp; disputes</a></li>
            <li><a href="#contact">Contact</a></li>
          </ol>
        </nav>

        <article>
          <h2 id="agreement">1. Agreement to terms</h2>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the EarthMove marketplace, Groundcheck verification service, and related websites, mobile applications, and APIs (collectively, the &ldquo;Service&rdquo;) operated by Earth Pro Connect LLC (&ldquo;EarthMove,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). By creating an account, placing an order, subscribing, or otherwise using the Service, you agree to these Terms.
          </p>
          <p>
            If you do not agree to these Terms, do not use the Service. If you are using the Service on behalf of a company or other legal entity, you represent that you have authority to bind that entity to these Terms.
          </p>

          <h2 id="service">2. Description of service</h2>
          <p>
            EarthMove operates a two-sided marketplace connecting customers (homeowners, contractors, and businesses) with suppliers and drivers for bulk aggregate materials including but not limited to fill dirt, road base, crushed stone, topsoil, sand, gravel, and recycled aggregate. EarthMove also operates Groundcheck, a verification and trust-scoring service for registered business entities used to inform contracting and procurement decisions.
          </p>
          <p>
            EarthMove is a marketplace facilitator. We do not own the materials supplied through the marketplace. Suppliers and drivers are independent third parties.
          </p>

          <h2 id="accounts">3. Accounts &amp; eligibility</h2>
          <p>
            To access certain features you must create an account. You agree to:
          </p>
          <ul>
            <li>Provide accurate, current, and complete information during registration</li>
            <li>Maintain and promptly update your account information</li>
            <li>Be at least 18 years of age and legally competent to enter into binding contracts</li>
            <li>Maintain the confidentiality of your password and account credentials</li>
            <li>Be solely responsible for all activities under your account</li>
          </ul>
          <p>
            We may suspend or terminate accounts that violate these Terms, contain inaccurate information, or pose risk to the Service or other users.
          </p>

          <h2 id="orders">4. Orders &amp; marketplace transactions</h2>
          <p>
            When you place an order through the Service, you are entering into an agreement with the supplier providing the materials. EarthMove acts as facilitator, processes payment, and coordinates dispatch. The supplier is responsible for the materials sold; the driver is responsible for delivery.
          </p>
          <p>
            By placing an order, you represent that:
          </p>
          <ul>
            <li>You have authority to receive delivery at the address provided</li>
            <li>The delivery site is accessible to the type of equipment required (typically a tandem or tri-axle dump truck)</li>
            <li>You will be available or have an authorized representative present during the delivery window</li>
            <li>The information you provide regarding quantity, material type, and delivery instructions is accurate</li>
          </ul>
          <p>
            Refunds and cancellations are governed by our <Link href="/legal/refunds">Refund Policy</Link>, which is incorporated into these Terms by reference.
          </p>

          <h2 id="groundcheck">5. Groundcheck subscription terms</h2>
          <p>
            Groundcheck is a verification and trust-scoring service for registered business entities (LLCs, corporations, partnerships, trusts). Groundcheck does not provide consumer reports under the Fair Credit Reporting Act. Groundcheck reports are based on publicly available information and our proprietary verification methodology.
          </p>
          <p>
            By using Groundcheck you acknowledge:
          </p>
          <ul>
            <li>Groundcheck reports are informational and not a substitute for independent verification or legal counsel</li>
            <li>Trust scores are algorithmic computations and represent our best-effort assessment, not guarantees</li>
            <li>You will not use Groundcheck reports for purposes governed by the FCRA, including employment screening, tenant screening, or consumer credit decisions</li>
            <li>You will not redistribute, resell, or republish Groundcheck reports beyond reasonable business use</li>
          </ul>
          <p>
            Subscription billing terms are described in Section 6 below and in our Refund Policy.
          </p>

          <h2 id="payment">6. Payment, billing &amp; taxes</h2>
          <p>
            Payment is processed by Stripe. By providing payment information you authorize EarthMove and Stripe to charge your selected payment method for orders, subscriptions, and applicable taxes.
          </p>
          <p>
            Subscriptions automatically renew at the end of each billing period (monthly or annual) until canceled. You may cancel any time through your account billing settings or by emailing <a href="mailto:support@earthmove.io">support@earthmove.io</a>. Cancellation takes effect at the end of the current billing period.
          </p>
          <p>
            You are responsible for any sales, use, value-added, or other taxes applicable to your transactions. Where required, EarthMove will calculate and remit taxes on your behalf.
          </p>

          <h2 id="conduct">7. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for unlawful purposes or in violation of any applicable law or regulation</li>
            <li>Misrepresent your identity, affiliation, or the truth of any information you provide</li>
            <li>Interfere with or disrupt the Service or servers, including by introducing malware or attempting to circumvent rate limits</li>
            <li>Scrape, copy, or systematically extract content from the Service without our written permission</li>
            <li>Reverse-engineer the Service or attempt to derive its source code or methodology</li>
            <li>Use automated tools to create accounts, place orders, or run lookups beyond reasonable manual use</li>
            <li>Use the Service to harass, defame, or harm any other person or business</li>
          </ul>

          <h2 id="ip">8. Intellectual property</h2>
          <p>
            The Service, including all software, designs, brand elements (including the Groundcheck wordmark and tagline), trust-scoring methodology, copy, and curated content, is owned by EarthMove and protected by copyright, trademark, and other laws. We grant you a limited, non-exclusive, non-transferable license to use the Service for your personal or internal business purposes in accordance with these Terms.
          </p>
          <p>
            Content you submit (including order information, delivery photos, and reviews) remains yours, but you grant EarthMove a license to use it in connection with operating and improving the Service.
          </p>

          <h2 id="disclaimer">9. Disclaimers &amp; limitation of liability</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; EarthMove makes no warranties, express or implied, regarding the Service, including warranties of merchantability, fitness for a particular purpose, or non-infringement, except as required by applicable law.
          </p>
          <p>
            EarthMove is a marketplace facilitator. We do not guarantee the quality, quantity, or fitness of materials supplied by third-party suppliers, the conduct of drivers, or the outcomes of construction projects using delivered materials. Quality disputes are governed by our Refund Policy.
          </p>
          <p>
            <b>To the fullest extent permitted by law, EarthMove&rsquo;s total liability for any claims arising out of these Terms or the Service shall not exceed the greater of (a) the amount you paid to EarthMove in the three months preceding the claim, or (b) one hundred dollars ($100).</b>
          </p>
          <p>
            EarthMove shall not be liable for indirect, incidental, special, consequential, or punitive damages, including but not limited to lost profits, business interruption, project delays, or damages arising from supplier or driver conduct.
          </p>

          <h2 id="indemnity">10. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless EarthMove, its officers, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable attorneys&rsquo; fees) arising out of (a) your use of the Service, (b) your violation of these Terms, (c) your violation of any third-party right, including intellectual property or privacy rights, or (d) any content you submit to the Service.
          </p>

          <h2 id="governing">11. Governing law &amp; disputes</h2>
          <p>
            These Terms are governed by the laws of the State of Colorado, without regard to conflict of law principles. Any disputes arising out of or relating to these Terms or the Service shall be resolved through binding arbitration administered by the American Arbitration Association in Denver, Colorado, except that either party may seek injunctive relief in court for intellectual property infringement or violations of confidentiality.
          </p>
          <p>
            <b>You and EarthMove waive the right to a jury trial and to participate in any class action.</b>
          </p>
          <div className="callout">
            <b>30-day opt-out.</b> You may opt out of the arbitration agreement by sending written notice to <a href="mailto:support@earthmove.io">support@earthmove.io</a> within 30 days of first agreeing to these Terms. Opting out does not affect any other terms.
          </div>

          <h2 id="contact">12. Contact</h2>
          <p>For questions about these Terms:</p>
          <div className="contact-block">
            <h3>Earth Pro Connect LLC</h3>
            <p>Operating EarthMove and Groundcheck. We respond to legal questions within 3 business days.</p>
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
