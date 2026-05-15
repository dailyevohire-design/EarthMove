import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'FCRA Limits · Groundcheck · EarthMove',
  description:
    'How the Fair Credit Reporting Act (FCRA) applies to EarthMove Groundcheck reports. Entity standing data is not FCRA-regulated; individual background checks pass through a licensed CRA.',
  alternates: { canonical: '/trust/fcra' },
  openGraph: {
    title: 'FCRA Limits — what EarthMove Groundcheck does and does not cover',
    description: 'Entity verification vs FCRA-regulated background checks. The line, drawn plainly.',
    url: '/trust/fcra',
    type: 'website',
  },
}

const FCRA_CSS = `
.fc-page {
  --paper:#F1ECE2; --card:#FFFFFF; --panel:#14322A;
  --ink:#15201B; --ink-2:#2A332E; --ink-3:#5C645F;
  --orange:#E5701B; --emerald:#2DB37A;
  --hair:#D8D2C4;
  background: var(--paper); color: var(--ink);
  font-family: var(--font-inter), -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  min-height: 100vh;
}
.fc-page main { max-width: 760px; margin: 0 auto; padding: 80px 32px 96px; }
.fc-page .label {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
  display: inline-flex; align-items: center; gap: 10px; margin-bottom: 14px;
}
.fc-page .label::before { content: ""; width: 18px; height: 1.5px; background: var(--ink-3); }
.fc-page h1 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: clamp(36px, 5vw, 56px); line-height: 1.05; letter-spacing: -0.022em;
  margin: 0 0 20px;
}
.fc-page h1 em { font-style: italic; font-weight: 500; color: var(--orange); }
.fc-page h2 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: clamp(22px, 2.6vw, 28px); line-height: 1.2; margin: 40px 0 12px;
}
.fc-page .lede { font-size: 19px; line-height: 1.55; color: var(--ink-2); margin: 0 0 28px; }
.fc-page p { font-size: 16px; line-height: 1.65; color: var(--ink-2); margin: 0 0 14px; }
.fc-page .pull {
  background: var(--card); border: 1px solid var(--hair); border-radius: 12px;
  padding: 20px 24px; margin: 24px 0;
}
.fc-page .pull strong { color: var(--ink); font-weight: 700; }
.fc-page .cta { display: inline-flex; gap: 8px; padding: 12px 20px; border-radius: 8px;
  background: var(--orange); color: #fff; font-weight: 600; font-size: 15px;
  text-decoration: none; margin-top: 16px; }
`

export default function FcraPage() {
  return (
    <div className="fc-page">
      <style>{FCRA_CSS}</style>
      <main>
        <span className="label">Trust · Compliance</span>
        <h1>
          What FCRA covers <em>(and what we don&rsquo;t).</em>
        </h1>
        <p className="lede">
          The Fair Credit Reporting Act regulates consumer reports about individuals — credit history,
          criminal records, employment screening. It does <em>not</em> regulate verification of business
          entities. Groundcheck draws this line cleanly.
        </p>

        <h2>Entity reports are not FCRA-regulated</h2>
        <p>
          A Groundcheck report on a contractor entity (LLC, corporation, partnership, trust) pulls
          public-record data: secretary-of-state standing, license status, insurance lapses, lien filings,
          OFAC, and aggregated operational signals. This is business intelligence on a registered entity,
          not a consumer report on a person. The FCRA does not apply.
        </p>
        <p>
          That&rsquo;s why we can return entity standing in under 60 seconds without an adverse-action workflow,
          dispute window, or pre-employment disclosure.
        </p>

        <h2>Individual background checks pass through a licensed CRA</h2>
        <p>
          When the use case requires checks on a <em>person</em> (a driver applying to haul, an individual
          subcontractor named in your scope of work), we route those requests through Checkr — a licensed
          consumer reporting agency. Checkr is FCRA-compliant by design: written disclosure, signed
          authorization, adverse-action notices, and dispute resolution all happen inside their flow.
        </p>

        <div className="pull">
          <strong>Plain version.</strong> If you&rsquo;re vetting an LLC, we run it directly — fast,
          unregulated, evidence-backed. If you&rsquo;re vetting a human, the request gets handed off to a
          licensed partner who handles the consent and dispute machinery FCRA requires.
        </div>

        <h2>What this means for you</h2>
        <p>
          You can use Groundcheck entity reports for any business decision — vendor selection, PO
          approval, deposit risk — without legal exposure. For individual background checks, plan an
          extra 1–3 business days for the FCRA consent workflow.
        </p>

        <Link className="cta" href="/trust">
          ← Back to Trust
        </Link>
      </main>
    </div>
  )
}
