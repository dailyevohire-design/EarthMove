const STEPS = [
  {
    n: '01',
    head: 'Order',
    body: 'Enter your ZIP. See available materials with delivered prices for your market.',
    sub: 'No call. No callback. No waiting on a fax.',
  },
  {
    n: '02',
    head: 'Match',
    body: 'We route your load to the nearest verified pit with the cheapest delivered cost.',
    sub: 'Multi-supplier sourcing across 13 yards in Denver and DFW.',
  },
  {
    n: '03',
    head: 'Dispatch',
    body: 'A driver accepts. You get a live ETA the moment the truck is loaded at the scale.',
    sub: 'GPS-tracked from pickup. Photo on delivery.',
  },
  {
    n: '04',
    head: 'Delivery',
    body: 'Truck arrives in your window. Drop is photo-confirmed. BOL and ticket attached to your order.',
    sub: 'Pay on delivery, on terms, or by card.',
  },
] as const

const CAPS = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 7l9-4 9 4-9 4-9-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M3 12l9 4 9-4M3 17l9 4 9-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    head: 'Multi-supplier sourcing',
    body: 'One order. We route to whoever has it cheapest delivered to your jobsite — not whoever picks up the phone first.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    head: 'Ticket + BOL on every load',
    body: 'Scale ticket and bill of lading captured at pickup, attached to the order. Forensic-grade paperwork without the paperwork.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 12h13M16 7l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 12H8M8 17l-5-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
      </svg>
    ),
    head: 'Backhaul-aware pricing',
    body: 'Trucks earn on the way out and the way back, so per-ton rates land lower. Empty miles are the enemy. We hunt them.',
  },
] as const

export function HowItWorksSection() {
  return (
    <section className="section hiw" id="how-it-works" aria-labelledby="hiw-heading">
      <div className="max">
        <div className="hiw-head">
          <p className="hiw-eyebrow">How it works</p>
          <h2 id="hiw-heading" className="hiw-h2">
            From <span className="hiw-em">ZIP entered</span> to{' '}
            <span className="hiw-em">drop confirmed</span>.
          </h2>
        </div>

        <ol className="hiw-steps" role="list">
          {STEPS.map((s, i) => (
            <li key={s.n} className="hiw-step" data-align={i % 2 === 0 ? 'left' : 'right'}>
              <span className="hiw-num" aria-hidden="true">{s.n}</span>
              <div className="hiw-step-body">
                <h3 className="hiw-step-h">{s.head}</h3>
                <p className="hiw-step-p">{s.body}</p>
                <p className="hiw-step-sub">{s.sub}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="hiw-caps" role="list">
          {CAPS.map((c) => (
            <article key={c.head} className="hiw-cap" role="listitem">
              <span className="hiw-cap-icon" aria-hidden="true">{c.icon}</span>
              <h3 className="hiw-cap-h">{c.head}</h3>
              <p className="hiw-cap-p">{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
