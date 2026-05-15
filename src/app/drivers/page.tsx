import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Drive for EarthMove · Weekly Pay, Real Dispatch',
  description:
    'Tri-axle, tandem, and end-dump operators in Denver and Dallas–Fort Worth. Steady local runs, dispatch by SMS, settled at end of week.',
  alternates: { canonical: '/drivers' },
  openGraph: {
    title: 'Drive for EarthMove',
    description: 'Weekly pay. Real dispatch. Local runs from verified yards.',
    url: '/drivers',
    type: 'website',
  },
}

const DRIVERS_CSS = `
.dr-page {
  --paper:#F1ECE2; --card:#FFFFFF; --panel:#14322A;
  --ink:#15201B; --ink-2:#2A332E; --ink-3:#5C645F;
  --orange:#E5701B; --emerald:#2DB37A;
  --hair:#D8D2C4;
  background: var(--paper); color: var(--ink);
  font-family: var(--font-inter), -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  min-height: 100vh;
}
.dr-page main { max-width: 820px; margin: 0 auto; padding: 80px 32px 96px; }
.dr-page .label {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
  display: inline-flex; align-items: center; gap: 10px; margin-bottom: 14px;
}
.dr-page .label::before { content: ""; width: 18px; height: 1.5px; background: var(--ink-3); }
.dr-page h1 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: clamp(40px, 6vw, 64px); line-height: 1.04; letter-spacing: -0.025em;
  margin: 0 0 24px;
}
.dr-page h1 em { font-style: italic; font-weight: 500; color: var(--orange); }
.dr-page h2 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: clamp(24px, 3vw, 32px); line-height: 1.15; margin: 48px 0 16px;
}
.dr-page .lede { font-size: 19px; line-height: 1.55; color: var(--ink-2); margin: 0 0 32px; max-width: 640px; }
.dr-page p { font-size: 16px; line-height: 1.6; color: var(--ink-2); margin: 0 0 16px; }
.dr-page ul { margin: 0 0 24px; padding: 0 0 0 20px; }
.dr-page li { font-size: 16px; line-height: 1.7; color: var(--ink-2); }
.dr-page .cta-row { display: flex; gap: 12px; flex-wrap: wrap; margin: 32px 0 0; }
.dr-page .btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 22px; border-radius: 8px;
  font-weight: 600; font-size: 15px; text-decoration: none;
  transition: transform 80ms ease;
}
.dr-page .btn-primary { background: var(--orange); color: #fff; }
.dr-page .btn-primary:hover { transform: translateY(-1px); }
.dr-page .btn-ghost { background: transparent; color: var(--ink); border: 1.5px solid var(--hair); }
.dr-page .btn-ghost:hover { border-color: var(--ink-2); }
.dr-page .pull {
  background: var(--card); border: 1px solid var(--hair); border-radius: 12px;
  padding: 24px 28px; margin: 24px 0;
}
.dr-page .pull strong { color: var(--ink); font-weight: 700; }
`

export default function DriversPage() {
  return (
    <div className="dr-page">
      <style>{DRIVERS_CSS}</style>
      <main>
        <span className="label">For drivers</span>
        <h1>
          Hauling for EarthMove pays <em>weekly</em>,<br />not on net-30.
        </h1>
        <p className="lede">
          Steady local runs from verified yards in Denver and Dallas–Fort Worth. Dispatched by SMS,
          settled at end of week. Real ops — no chasing checks, no broker games.
        </p>

        <div className="pull">
          <strong>What you'll do.</strong> Pick up aggregate at one of our yards (gravel, road base,
          topsoil, stone), deliver to a contractor or homeowner site, dump and go. Most runs are 30–60
          minutes one-way. Dispatch routes you efficiently.
        </div>

        <h2 id="requirements">Requirements</h2>
        <ul>
          <li>Tri-axle, tandem, end-dump, or super-dump (10–24 ton capacity).</li>
          <li>Class A or B CDL, current medical card.</li>
          <li>Valid DOT number on truck. MC if interstate.</li>
          <li>$1M auto liability minimum, EarthMove listed as certificate holder.</li>
          <li>Smartphone for dispatch SMS and proof-of-delivery photo.</li>
          <li>Insurable driving record (no DUI in last 5 years).</li>
        </ul>

        <h2>How pay works</h2>
        <ul>
          <li>Per-load rate based on tonnage and miles, set at dispatch.</li>
          <li>Weekly ACH every Friday. No invoicing, no net-30.</li>
          <li>Fuel surcharge auto-applied when diesel index moves.</li>
          <li>Demurrage paid after 30 minutes on either end.</li>
        </ul>

        <div className="cta-row">
          <a className="btn btn-primary" href="mailto:drivers@earthmove.io?subject=Driver%20application&body=Name%3A%20%0ACDL%20class%3A%20%0ATruck%20type%20%2B%20capacity%3A%20%0ABase%20market%20(DEN%20or%20DFW)%3A%20%0ADOT%20%23%3A%20%0AYears%20driving%3A%20">
            Apply to drive
          </a>
          <Link className="btn btn-ghost" href="/">
            ← Back to EarthMove
          </Link>
        </div>
      </main>
    </div>
  )
}
