// src/app/(marketplace)/legal/refunds/page.tsx
//
// Refund Policy page. Static Server Component, prose-first.
// Wired to Stripe-defense posture: documented refund terms reduce
// chargeback liability vs. mailto-only fallback.
//
// CSS: scoped .lr-page wrapper to avoid collision with global styles.

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Refund Policy · EarthMove',
  description:
    'Refund policy for EarthMove orders, Groundcheck subscriptions, and disputed deliveries. Effective April 30, 2026.',
  alternates: { canonical: '/legal/refunds' },
  openGraph: {
    title: 'EarthMove Refund Policy',
    description: 'How refunds, cancellations, and disputes work at EarthMove.',
    url: '/legal/refunds',
    type: 'article',
  },
  robots: { index: true, follow: true },
};

const REFUNDS_CSS = `
.lr-page {
  --paper:#F1ECE2; --paper-2:#E9E3D5; --card:#FFFFFF; --card-muted:#F6F2E8;
  --panel:#14322A;
  --ink:#15201B; --ink-2:#2A332E; --ink-3:#5C645F;
  --orange:#E5701B; --emerald:#2DB37A; --emerald-soft:#1F8A5C; --emerald-pale:#E6F1E9;
  --amber:#E0A52A; --amber-pale:#FBEFD0;
  --hair:#D8D2C4; --hair-strong:#C8C0AC;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-inter), -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.lr-page main { max-width: 780px; margin: 0 auto; padding: 64px 32px 96px; }
.lr-page a { color: var(--ink-2); text-decoration: underline; text-decoration-color: var(--hair-strong); text-underline-offset: 3px; }
.lr-page a:hover { color: var(--ink); text-decoration-color: var(--ink); }

.lr-page .hero-strip {
  background: var(--card); border: 1px solid var(--hair); border-radius: 14px;
  padding: 32px 36px; margin-bottom: 48px;
  display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: center;
}
.lr-page .hero-strip .label {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
  display: inline-flex; align-items: center; gap: 10px;
}
.lr-page .hero-strip .label::before { content: ""; width: 18px; height: 1.5px; background: var(--ink-3); }
.lr-page .hero-strip h1 {
  font-family: var(--font-fraunces), serif;
  font-weight: 600; font-size: 42px; line-height: 1.05; letter-spacing: -0.02em;
  margin: 8px 0 0;
}
.lr-page .hero-strip h1 em { font-style: italic; font-weight: 500; }
.lr-page .hero-strip .stamp {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 11.5px; color: var(--ink-3); text-align: right; letter-spacing: 0.04em;
}
.lr-page .hero-strip .stamp b { display: block; color: var(--ink); font-weight: 600; font-size: 13px; margin-bottom: 2px; letter-spacing: 0; }

.lr-page .toc {
  background: var(--card-muted); border: 1px solid var(--hair); border-radius: 12px;
  padding: 20px 24px; margin-bottom: 40px;
}
.lr-page .toc h2 {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3);
  margin: 0 0 12px; font-weight: 600;
}
.lr-page .toc ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; counter-reset: toc; }
.lr-page .toc ol li { counter-increment: toc; font-size: 13.5px; display: flex; gap: 10px; align-items: baseline; }
.lr-page .toc ol li::before {
  content: counter(toc, decimal-leading-zero);
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 10.5px; color: var(--ink-3); font-weight: 500;
}
.lr-page .toc ol li a { text-decoration: none; color: var(--ink-2); }
.lr-page .toc ol li a:hover { color: var(--orange); }

.lr-page article h2 {
  font-family: var(--font-fraunces), serif;
  font-weight: 600; font-size: 28px; line-height: 1.15; letter-spacing: -0.015em;
  margin: 48px 0 14px; color: var(--ink); scroll-margin-top: 24px;
}
.lr-page article h2:first-of-type { margin-top: 0; }
.lr-page article h2 em { font-style: italic; font-weight: 500; }
.lr-page article h3 {
  font-family: var(--font-fraunces), serif;
  font-weight: 600; font-size: 18px; letter-spacing: -0.01em;
  margin: 28px 0 8px; color: var(--ink);
}
.lr-page article p { font-size: 15px; line-height: 1.65; color: var(--ink-2); margin: 0 0 16px; }
.lr-page article p b, .lr-page article li b { color: var(--ink); font-weight: 600; }
.lr-page article ul { margin: 0 0 16px; padding: 0 0 0 22px; display: flex; flex-direction: column; gap: 8px; }
.lr-page article ul li { font-size: 15px; line-height: 1.6; color: var(--ink-2); padding-left: 4px; }

.lr-page .callout {
  background: var(--amber-pale); border-left: 3px solid var(--amber);
  padding: 16px 20px; border-radius: 8px; margin: 20px 0;
  font-size: 14px; line-height: 1.6; color: var(--ink-2);
}
.lr-page .callout b { color: var(--ink); font-weight: 600; }
.lr-page .callout-info { background: var(--emerald-pale); border-left-color: var(--emerald-soft); }

.lr-page .timing-table {
  width: 100%; border-collapse: collapse; margin: 20px 0;
  background: var(--card); border: 1px solid var(--hair); border-radius: 10px; overflow: hidden;
}
.lr-page .timing-table th, .lr-page .timing-table td {
  padding: 12px 18px; text-align: left; font-size: 13.5px; line-height: 1.5;
  border-bottom: 1px solid var(--hair);
}
.lr-page .timing-table thead th {
  background: var(--card-muted);
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); font-weight: 600;
}
.lr-page .timing-table tbody tr:last-child td { border-bottom: 0; }
.lr-page .timing-table td:first-child { font-weight: 600; color: var(--ink); }

.lr-page .contact-block {
  background: var(--panel); color: #F1ECE2; border-radius: 14px;
  padding: 32px 36px; margin: 48px 0 0;
}
.lr-page .contact-block h3 {
  font-family: var(--font-fraunces), serif;
  font-weight: 600; font-size: 22px; letter-spacing: -0.015em;
  margin: 0 0 8px; color: #fff;
}
.lr-page .contact-block p { font-size: 14px; line-height: 1.6; color: #A9B4AC; margin: 0 0 14px; }
.lr-page .contact-block .email {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 14px; color: #fff;
  background: rgba(255,255,255,0.08); padding: 10px 14px; border-radius: 8px; display: inline-block;
}
.lr-page .contact-block .email b { color: var(--orange); font-weight: 500; }
.lr-page .contact-block a { color: #fff; }

@media (max-width: 760px) {
  .lr-page .hero-strip { grid-template-columns: 1fr; }
  .lr-page .hero-strip .stamp { text-align: left; }
  .lr-page .hero-strip h1 { font-size: 32px; }
  .lr-page main { padding: 40px 22px 64px; }
  .lr-page article h2 { font-size: 22px; margin-top: 36px; }
  .lr-page .timing-table { font-size: 12.5px; }
  .lr-page .timing-table th, .lr-page .timing-table td { padding: 10px 12px; }
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

export default function RefundsPage() {
  return (
    <div className="lr-page">
      <style dangerouslySetInnerHTML={{ __html: REFUNDS_CSS }} />
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
            <h1>
              Refund <em>Policy.</em>
            </h1>
          </div>
          <div className="stamp">
            <b>Effective</b>April 30, 2026
            <br />
            <span style={{ color: 'var(--ink-3)' }}>Last updated: April 30, 2026</span>
          </div>
        </section>

        <nav className="toc" aria-label="Table of contents">
          <h2>On this page</h2>
          <ol>
            <li><a href="#overview">Overview &amp; scope</a></li>
            <li><a href="#cancellation">Order cancellation window</a></li>
            <li><a href="#delivered">Materials already delivered</a></li>
            <li><a href="#quality">Quality issues &amp; disputes</a></li>
            <li><a href="#promo">Promotional credits &amp; discounts</a></li>
            <li><a href="#timing">Refund processing times</a></li>
            <li><a href="#chargebacks">Chargebacks &amp; payment disputes</a></li>
            <li><a href="#groundcheck">Groundcheck subscriptions</a></li>
            <li><a href="#changes">Changes to this policy</a></li>
            <li><a href="#contact">How to request a refund</a></li>
          </ol>
        </nav>

        <article>
          <h2 id="overview">1. Overview &amp; scope</h2>
          <p>
            EarthMove operates a marketplace connecting customers with suppliers and drivers for bulk
            aggregate materials (fill dirt, road base, crushed stone, topsoil, sand, gravel, and similar).
            Because we ship physical bulk materials with significant logistical commitments — driver dispatch,
            supplier hauling, route planning — our refund policy reflects when costs become unrecoverable for
            our partners and us.
          </p>
          <p>
            This policy covers refunds for orders placed at <a href="https://earthmove.io">earthmove.io</a> and
            through our marketplace partners. Separate refund terms apply to{' '}
            <a href="#groundcheck">Groundcheck subscriptions</a>.
          </p>
          <p>
            This policy applies to orders placed by both registered account holders and guest checkout users.
            Where this policy is silent, our <Link href="/terms">Terms of Service</Link> govern.
          </p>

          <h2 id="cancellation">2. Order cancellation window</h2>
          <p>
            You may cancel an order and receive a <b>full refund</b> at any time before the order has been
            dispatched to a driver. An order is considered dispatched when a driver has accepted the assignment
            and begun travel to the supplier yard.
          </p>
          <p>Once an order has been dispatched, partial refunds may apply depending on order state:</p>
          <ul>
            <li>
              <b>Dispatched but not picked up</b> — driver dispatch fee retained ($45 minimum); balance refunded.
            </li>
            <li>
              <b>Picked up but not delivered</b> — driver pay, supplier load cost, and dispatch fee retained;
              balance refunded only if quality issue documented (see Section 4).
            </li>
            <li>
              <b>In transit or arrived at delivery site</b> — full charge stands except in cases of demonstrated
              quality issue (see Section 4).
            </li>
          </ul>
          <div className="callout">
            <b>How to cancel.</b> Cancellation requests submitted before dispatch are processed automatically by
            replying to your order confirmation email or contacting{' '}
            <a href="mailto:support@earthmove.io?subject=Order%20cancellation">support@earthmove.io</a> with
            your order number. We monitor support requests during business hours; for time-sensitive
            cancellations, including the order ID in the email subject line accelerates processing.
          </div>

          <h2 id="delivered">3. Materials already delivered</h2>
          <p>
            Once bulk aggregate material has been delivered to your job site, the order is considered fulfilled
            and is generally not refundable. Bulk aggregate is a physical commodity that cannot be returned to
            inventory after delivery — it has been measured, dumped, and integrated with the site.
          </p>
          <p>Exceptions to this rule are limited to:</p>
          <ul>
            <li>Material delivered in materially the wrong type (e.g., topsoil delivered when fill dirt was ordered)</li>
            <li>
              Material delivered in a quantity materially below the ordered tonnage as recorded on the supplier
              scale ticket
            </li>
            <li>Material delivered with documented contamination or quality defects (see Section 4)</li>
          </ul>
          <p>
            If any of these conditions apply, contact us within <b>48 hours</b> of delivery with photographs,
            the supplier scale ticket, and a written description. We will investigate with the supplier and
            driver and may issue a full or partial refund, replacement load, or credit at our discretion.
          </p>

          <h2 id="quality">4. Quality issues &amp; disputes</h2>
          <p>
            If delivered material does not meet ordered specifications, you may dispute the order. To open a
            quality dispute:
          </p>
          <ul>
            <li>
              Email <a href="mailto:support@earthmove.io?subject=Quality%20dispute">support@earthmove.io</a> with
              subject line &ldquo;Quality dispute&rdquo; within 48 hours of delivery
            </li>
            <li>
              Include your order number, photographs of the delivered material, the supplier scale ticket photo,
              and a written description of the issue
            </li>
            <li>Do not move, integrate, or further process the material until the dispute is resolved when possible</li>
          </ul>
          <p>
            Disputes are typically resolved within 5–7 business days. Resolution may include a full refund,
            partial refund, replacement load at no additional charge, or order credit toward a future purchase.
            The resolution form depends on the nature of the issue, the supplier&rsquo;s investigation, and your
            preference among available remedies.
          </p>

          <h2 id="promo">5. Promotional credits &amp; discounts</h2>
          <p>
            Promotional credits and discount codes (including but not limited to WELCOME5) reduce the order
            subtotal at checkout. If an order is refunded:
          </p>
          <ul>
            <li>The refund amount equals what you actually paid, not the pre-discount subtotal</li>
            <li>
              One-time promotional codes consumed during a refunded order are <b>not</b> automatically restored
            </li>
            <li>
              Restoration of a one-time promo code may be granted at our discretion when the cancellation reason
              is on our side or the supplier&rsquo;s
            </li>
          </ul>
          <p>
            This applies even if the order is fully refunded. The promo code redemption is treated as consumed
            at checkout and does not transfer to a future order automatically.
          </p>

          <h2 id="timing">6. Refund processing times</h2>
          <p>Once a refund is approved, processing time varies by original payment method:</p>
          <table className="timing-table">
            <thead>
              <tr>
                <th>Payment method</th>
                <th>Approval to bank credit</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Credit / debit card</td>
                <td>5–10 business days</td>
                <td>Visible on statement; some banks delay posting</td>
              </tr>
              <tr>
                <td>Apple Pay / Google Pay</td>
                <td>5–10 business days</td>
                <td>Routes back to underlying card</td>
              </tr>
              <tr>
                <td>Link by Stripe</td>
                <td>5–10 business days</td>
                <td>Routes back to original card</td>
              </tr>
              <tr>
                <td>ACH bank transfer</td>
                <td>7–14 business days</td>
                <td>Slower clearing; varies by bank</td>
              </tr>
              <tr>
                <td>Klarna / Affirm (BNPL)</td>
                <td>5–10 business days</td>
                <td>Refunded to BNPL provider; they manage your installments</td>
              </tr>
            </tbody>
          </table>
          <p>
            If the original payment method is no longer available (closed account, expired card), we will work
            with you to arrange an alternative refund path. EarthMove cannot expedite the bank-side processing
            time once a refund is approved — that timing is controlled by your card issuer or bank.
          </p>

          <h2 id="chargebacks">7. Chargebacks &amp; payment disputes</h2>
          <p>
            If you have an issue with an order, please contact{' '}
            <a href="mailto:support@earthmove.io?subject=Order%20issue">support@earthmove.io</a> first. We can
            almost always resolve issues directly faster than a chargeback process can.
          </p>
          <p>
            Initiating a chargeback with your card issuer before contacting us may result in your account being
            temporarily restricted from placing new orders pending resolution. Chargebacks initiated for orders
            that have been delivered as ordered are typically disputed by EarthMove with supporting documentation
            including delivery photos, scale tickets, GPS records, and signed delivery confirmations where
            applicable.
          </p>
          <div className="callout callout-info">
            <b>Good faith resolution.</b> The vast majority of order issues are resolved within 48 hours of
            first contact. Email us before involving your card issuer — we want the same outcome you do.
          </div>

          <h2 id="groundcheck">8. Groundcheck subscriptions</h2>
          <p>
            Groundcheck Pro and Premium subscriptions are billed in advance, monthly or annually. Subscription
            refund terms differ from materials orders:
          </p>
          <ul>
            <li>
              <b>Monthly subscriptions</b> — cancel any time. Cancellation takes effect at the end of the
              current billing period. No partial-month refunds.
            </li>
            <li>
              <b>Annual subscriptions</b> — cancel any time. Pro-rated refund of unused months available within
              the first 30 days of the annual term. After 30 days, no refund of remaining months.
            </li>
            <li>
              <b>Reports already generated</b> — non-refundable. Once a fresh trust report is generated, the
              underlying lookup cost has been incurred and the report is yours to keep regardless of subscription
              state.
            </li>
          </ul>
          <p>
            To cancel a subscription, sign in and visit your billing settings, or email{' '}
            <a href="mailto:support@earthmove.io?subject=Subscription%20cancellation">support@earthmove.io</a>.
          </p>

          <h2 id="changes">9. Changes to this policy</h2>
          <p>
            We may update this refund policy. Material changes will be posted at this URL with a revised &ldquo;Last
            updated&rdquo; date and, where required by law, communicated to active customers via email. Continued use
            of EarthMove after a policy update constitutes acceptance of the revised terms. Orders placed under
            a previous version of this policy are governed by the version in effect at the time of the order.
          </p>

          <h2 id="contact">10. How to request a refund</h2>
          <p>The fastest path is email:</p>
          <div className="contact-block">
            <h3>Refund &amp; support</h3>
            <p>
              Include your order number, the issue, and any supporting photographs or documentation. We respond
              to refund requests within 1 business day during normal hours.
            </p>
            <span className="email">
              support@<b>earthmove.io</b>
            </span>
          </div>
          <p style={{ marginTop: '24px' }}>
            For account or billing questions unrelated to a specific order, please use the same email with a
            clear subject line so it routes correctly.
          </p>
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
