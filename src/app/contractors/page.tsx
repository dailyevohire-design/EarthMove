import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Contractor Accounts · EarthMove',
  description:
    'Open a contractor account on EarthMove: saved drop sites, PO billing, FCRA-compliant trust reports, and a ticketing trail across every load.',
  alternates: { canonical: '/contractors' },
  openGraph: {
    title: 'Contractor accounts on EarthMove',
    description: 'Saved drop sites, PO billing, trust reports, one ticketing trail.',
    url: '/contractors',
    type: 'website',
  },
}

const CONTRACTORS_CSS = `
.co-page {
  --paper:#F1ECE2; --card:#FFFFFF; --panel:#14322A;
  --ink:#15201B; --ink-2:#2A332E; --ink-3:#5C645F;
  --orange:#E5701B; --emerald:#2DB37A;
  --hair:#D8D2C4;
  background: var(--paper); color: var(--ink);
  font-family: var(--font-inter), -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  min-height: 100vh;
}
.co-page main { max-width: 880px; margin: 0 auto; padding: 80px 32px 96px; }
.co-page .label {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
  display: inline-flex; align-items: center; gap: 10px; margin-bottom: 14px;
}
.co-page .label::before { content: ""; width: 18px; height: 1.5px; background: var(--ink-3); }
.co-page h1 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: clamp(40px, 6vw, 64px); line-height: 1.04; letter-spacing: -0.025em;
  margin: 0 0 24px;
}
.co-page h1 em { font-style: italic; font-weight: 500; color: var(--orange); }
.co-page h2 {
  font-family: var(--font-fraunces), serif; font-weight: 600;
  font-size: clamp(22px, 2.6vw, 28px); line-height: 1.15; margin: 0 0 12px;
}
.co-page .lede { font-size: 19px; line-height: 1.55; color: var(--ink-2); margin: 0 0 32px; max-width: 640px; }
.co-page .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 32px 0; }
@media (max-width: 720px) { .co-page .grid { grid-template-columns: 1fr; } }
.co-page .card {
  background: var(--card); border: 1px solid var(--hair); border-radius: 12px;
  padding: 24px;
}
.co-page .card p { font-size: 15px; line-height: 1.55; color: var(--ink-2); margin: 0; }
.co-page .cta-row { display: flex; gap: 12px; flex-wrap: wrap; margin: 32px 0 0; }
.co-page .btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 22px; border-radius: 8px;
  font-weight: 600; font-size: 15px; text-decoration: none;
  transition: transform 80ms ease;
}
.co-page .btn-primary { background: var(--orange); color: #fff; }
.co-page .btn-primary:hover { transform: translateY(-1px); }
.co-page .btn-ghost { background: transparent; color: var(--ink); border: 1.5px solid var(--hair); }
.co-page .btn-ghost:hover { border-color: var(--ink-2); }
`

const FEATURES = [
  {
    title: 'Saved drop sites',
    body: 'Pin every active project with delivery instructions, gate codes, and dump location. Reorder to the same site in two taps.',
  },
  {
    title: 'PO billing',
    body: 'Bill on PO with itemized invoices. Net-30 on approval. CSV export per project for your books.',
  },
  {
    title: 'Trust reports',
    body: 'FCRA-compliant background and entity checks on new subs. Powered by Groundcheck — free on every account.',
  },
  {
    title: 'One ticketing trail',
    body: 'Weight ticket, dispatch photo, and POD signature on every load. Searchable across all your projects.',
  },
  {
    title: 'Crew SMS dispatch',
    body: 'Add your foreman or PM. They get truck ETA pings without needing a login.',
  },
  {
    title: 'Reorder lists',
    body: 'Save your standard load — material, gradation, tonnage, drop window. Repeats with one click.',
  },
]

export default function ContractorsPage() {
  return (
    <div className="co-page">
      <style>{CONTRACTORS_CSS}</style>
      <main>
        <span className="label">For contractors</span>
        <h1>
          Open a contractor account,<br />
          <em>build a reorder list.</em>
        </h1>
        <p className="lede">
          Free to open. Saved drop sites, billing on PO, FCRA-compliant trust reports for new subs, and
          one ticketing trail across every load you order from any yard on the network.
        </p>

        <div className="grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <h2>{f.title}</h2>
              <p>{f.body}</p>
            </div>
          ))}
        </div>

        <div className="cta-row">
          <Link className="btn btn-primary" href="/signup?role=contractor">
            Open an account
          </Link>
          <Link className="btn btn-ghost" href="/">
            ← Back to EarthMove
          </Link>
        </div>
      </main>
    </div>
  )
}
