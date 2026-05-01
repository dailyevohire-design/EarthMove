'use client';

// src/app/(marketplace)/faq/FAQClient.tsx
// 19 items across 5 categories. Expand/collapse single-open accordion.

import { useState } from 'react';
import Link from 'next/link';

type FaqItem = { q: string; a: React.ReactNode };

const ORDERING: FaqItem[] = [
  {
    q: 'How do I order bulk materials?',
    a: (
      <>
        Use the <Link href="/material-match">Material Match</Link> wizard to tell us what your project is, and we&rsquo;ll route you to the right material and quantity. Then enter delivery address and contact, complete checkout via Stripe, and you&rsquo;re done. From start to confirmation typically takes about 2 minutes.
      </>
    ),
  },
  {
    q: 'What materials do you carry?',
    a: 'Fill dirt, road base (ABC), crushed stone (#57, #67, larger sizes), topsoil, screened topsoil, sand (concrete, mason, fill), gravel, decomposed granite, recycled aggregate, and lime rock in Florida markets. Specialty materials available by request — contact support.',
  },
  {
    q: 'How much material do I need?',
    a: 'Depends on your project, the area, and the depth. The Material Match wizard does the calculation for you based on the project type. As a rough rule: 1 ton of dirt covers about 100 square feet at 2-inch depth. Material density varies — when in doubt, order 10-15% over and use the surplus on grading or backfill.',
  },
  {
    q: 'Can I order materials for delivery to a different address than my billing address?',
    a: "Yes. Billing address comes from your payment method; delivery address is whatever you enter at checkout. Make sure the delivery address is accessible to a tandem or tri-axle dump truck — we can't deliver where the truck can't fit.",
  },
  {
    q: 'Do you have minimum order quantities?',
    a: 'Most loads are 10-22 tons depending on the truck. Below 10 tons, the per-ton economics get rough on transportation cost relative to material cost. We can quote partial loads for residential projects on request.',
  },
];

const DELIVERY: FaqItem[] = [
  {
    q: 'How fast can you deliver?',
    a: 'Standard window is next business day for orders placed before 4 PM local time. Same-day delivery available in some markets when capacity permits — check at checkout. Scheduled deliveries (specific date and time window) available for project planning.',
  },
  {
    q: 'How do I prepare my site for delivery?',
    a: (
      <>
        Make sure the truck has a clear path to the dump location, the dump area is on stable ground (not soft turf, not over septic lines, not under low branches), and someone is on-site or you&rsquo;ve left clear written instructions. The driver will not dump material in a location they consider unsafe. Detailed prep guide:{' '}
        <Link href="/learn">earthmove.io/learn</Link>.
      </>
    ),
  },
  {
    q: "What happens if I'm not home when the driver arrives?",
    a: "If you've left site instructions and the dump location is clear, the driver delivers and photographs the placement. If site instructions are unclear or access is blocked, the driver may attempt contact and, failing that, return to the yard — additional dispatch fees apply for redelivery.",
  },
  {
    q: "Can I reschedule a delivery after I've ordered?",
    a: (
      <>
        Yes, before the driver has been dispatched. Email{' '}
        <a href="mailto:support@earthmove.io">support@earthmove.io</a> with your order number. After dispatch, see the{' '}
        <Link href="/legal/refunds">Refund Policy</Link> for fee structure.
      </>
    ),
  },
];

const BILLING: FaqItem[] = [
  {
    q: 'What payment methods do you accept?',
    a: 'Credit and debit cards, Apple Pay, Google Pay, Link by Stripe, ACH bank transfer for orders $50 and up, and Klarna or Affirm for orders $50–$10,000. Contractors with established accounts can request net-30 terms after qualification.',
  },
  {
    q: 'When am I charged?',
    a: 'At order placement, in full. We hold the funds until delivery is confirmed. If the order is canceled before dispatch, the charge is fully refunded; partial-state cancellation rules in the Refund Policy.',
  },
  {
    q: 'Do you charge sales tax?',
    a: 'Yes, where required. Sales tax varies by jurisdiction and material type — we calculate and remit tax automatically based on your delivery address. Tax is shown as a separate line on your receipt.',
  },
  {
    q: 'How do refunds work?',
    a: (
      <>
        See the full <Link href="/legal/refunds">Refund Policy</Link>. Short version: cancel before dispatch for full refund; quality issues get refunded or re-delivered after investigation; bulk material delivered as ordered is generally non-refundable.
      </>
    ),
  },
];

const GROUNDCHECK: FaqItem[] = [
  {
    q: 'What is Groundcheck?',
    a: (
      <>
        Our verification and trust-scoring service for registered business entities — LLCs, corporations, partnerships, and trusts. Run a check before you sign a contract, issue a PO, or take on a vendor. Three tiers: Free (1 lookup/month), Pro ($49.99/mo, unlimited fresh lookups), Premium ($100/mo, enhanced depth + team workspace + API). See{' '}
        <Link href="/trust">earthmove.io/trust</Link>.
      </>
    ),
  },
  {
    q: 'Is Groundcheck a credit check or background check?',
    a: 'No. Groundcheck verifies registered business entities only. We do not pull personal credit, criminal history, SSN, or any consumer report data. For FCRA-regulated background checks on individual workers, we route through a licensed partner.',
  },
  {
    q: 'How accurate are Groundcheck reports?',
    a: 'Reports compile publicly available information about the entity and run our proprietary verification methodology. We stand behind the reports we publish, but they are informational — verify independently for high-stakes decisions, and never use them as a substitute for legal counsel.',
  },
];

const ACCOUNT: FaqItem[] = [
  {
    q: 'Do I need an account to order?',
    a: (
      <>
        No. Guest checkout is supported for one-off orders. Creating a free account gives you order history, faster repeat checkout, project tracking, and access to features like Groundcheck and team management. Sign up at{' '}
        <Link href="/signup">earthmove.io/signup</Link>.
      </>
    ),
  },
  {
    q: 'I forgot my password.',
    a: (
      <>
        Use the password reset link on the <Link href="/login">login page</Link>. The reset email arrives within a minute; check spam if it doesn&rsquo;t. Still stuck, email{' '}
        <a href="mailto:support@earthmove.io">support@earthmove.io</a>.
      </>
    ),
  },
  {
    q: 'How do I delete my account?',
    a: (
      <>
        Email <a href="mailto:support@earthmove.io?subject=Account%20deletion">support@earthmove.io</a> with subject line &ldquo;Account deletion&rdquo; from the email associated with your account. We process deletions within 5 business days. Some records (transactions, audit logs) are retained for tax and compliance reasons per the{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </>
    ),
  },
];

const SECTIONS: { name: string; items: FaqItem[] }[] = [
  { name: 'Ordering', items: ORDERING },
  { name: 'Delivery', items: DELIVERY },
  { name: 'Billing', items: BILLING },
  { name: 'Groundcheck', items: GROUNDCHECK },
  { name: 'Account', items: ACCOUNT },
];

const FAQ_CSS = `
.fq-page {
  --paper:#F1ECE2; --paper-2:#E9E3D5; --card:#FFFFFF; --card-muted:#F6F2E8;
  --panel:#14322A;
  --ink:#15201B; --ink-2:#2A332E; --ink-3:#5C645F;
  --orange:#E5701B; --emerald:#2DB37A; --emerald-soft:#1F8A5C;
  --hair:#D8D2C4; --hair-strong:#C8C0AC;
  background: var(--paper); color: var(--ink);
  font-family: var(--font-inter), -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.fq-page main { max-width: 880px; margin: 0 auto; padding: 80px 32px 96px; }
.fq-page a { color: var(--ink-2); text-decoration: underline; text-decoration-color: var(--orange); text-underline-offset: 3px; }
.fq-page a:hover { color: var(--ink); }

.fq-page .label {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
  display: inline-flex; align-items: center; gap: 10px; margin-bottom: 14px;
}
.fq-page .label::before { content: ""; width: 18px; height: 1.5px; background: var(--ink-3); }

.fq-page h1 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: 48px; line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 16px;
}
.fq-page h1 em { font-style: italic; font-weight: 500; }
.fq-page .lede { font-size: 16px; color: var(--ink-2); max-width: 640px; line-height: 1.55; margin: 0 0 56px; }

.fq-page .section-block { margin-bottom: 48px; }
.fq-page .section-block h2 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: 26px; letter-spacing: -0.015em; margin: 0 0 16px;
}

.fq-page .faq-list { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; overflow: hidden; }
.fq-page .faq-item { border-top: 1px solid var(--hair); padding: 18px 24px; }
.fq-page .faq-item:first-child { border-top: 0; }
.fq-page .faq-item button.q {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  width: 100%; background: none; border: 0; padding: 0; cursor: pointer; text-align: left;
  font-family: inherit; font-weight: 600; font-size: 15px; letter-spacing: -0.005em; color: var(--ink);
}
.fq-page .faq-item button.q:hover { color: var(--orange); }
.fq-page .faq-item button.q .chev { color: var(--ink-3); transition: transform 0.2s; flex-shrink: 0; }
.fq-page .faq-item.open button.q .chev { transform: rotate(180deg); }
.fq-page .faq-item .a { display: none; margin-top: 12px; font-size: 14.5px; line-height: 1.65; color: var(--ink-2); max-width: 720px; }
.fq-page .faq-item.open .a { display: block; }

.fq-page .contact-block {
  background: var(--panel); color: #F1ECE2; border-radius: 14px;
  padding: 32px 36px; margin-top: 48px;
}
.fq-page .contact-block h3 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: 22px; letter-spacing: -0.015em; margin: 0 0 8px; color: #fff;
}
.fq-page .contact-block p { font-size: 14px; line-height: 1.6; color: #A9B4AC; margin: 0 0 14px; }
.fq-page .contact-block a { color: #fff; }

@media (max-width: 760px) {
  .fq-page main { padding: 48px 22px 64px; }
  .fq-page h1 { font-size: 36px; }
}
`;

export function FAQClient() {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="fq-page">
      <style dangerouslySetInnerHTML={{ __html: FAQ_CSS }} />
      <main>
        <span className="label">Help &amp; Support</span>
        <h1>Frequently Asked <em>Questions.</em></h1>
        <p className="lede">
          Direct answers to common questions about ordering, delivery, billing, Groundcheck, and your account. Don&rsquo;t see your question? Email <a href="mailto:support@earthmove.io">support@earthmove.io</a>.
        </p>

        {SECTIONS.map((section) => (
          <div className="section-block" key={section.name}>
            <h2>{section.name}</h2>
            <div className="faq-list">
              {section.items.map((item, i) => {
                const key = `${section.name}-${i}`;
                const isOpen = openKey === key;
                return (
                  <div key={key} className={`faq-item ${isOpen ? 'open' : ''}`}>
                    <button
                      type="button"
                      className="q"
                      aria-expanded={isOpen}
                      onClick={() => setOpenKey(isOpen ? null : key)}
                    >
                      {item.q}
                      <span className="chev">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M4 6 L8 10 L12 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                    <div className="a">{item.a}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="contact-block">
          <h3>Still have a question?</h3>
          <p>We answer every email. Include your order number if relevant — it speeds things up considerably.</p>
          <a href="mailto:support@earthmove.io">support@earthmove.io →</a>
        </div>
      </main>
    </div>
  );
}
