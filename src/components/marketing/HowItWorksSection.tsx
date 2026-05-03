import { Target, Tag, Clock, Camera, type LucideIcon } from 'lucide-react'

const STEPS = [
  {
    n: '01',
    head: 'Order',
    body: 'Enter your ZIP. Delivered prices for your market in seconds.',
    tag: 'ZIP RESOLVED · ~3 SEC',
  },
  {
    n: '02',
    head: 'Match',
    body: 'Routed to the nearest verified yard. Cheapest delivered cost wins.',
    tag: '13 YARDS · DEN + DFW',
  },
  {
    n: '03',
    head: 'Dispatch',
    body: 'A driver accepts. Live ETA the moment the truck loads at the scale.',
    tag: 'GPS-TRACKED · PHOTO ON DROP',
  },
  {
    n: '04',
    head: 'Delivery',
    body: 'Truck arrives in your window. Photo-confirmed drop. BOL + ticket on your invoice.',
    tag: 'PAY ON DELIVERY · NET-30 · CARD',
  },
] as const

const CAPS: { Icon: LucideIcon; head: string; body: string }[] = [
  {
    Icon: Target,
    head: 'Right material, no guesswork.',
    body: "Tell us the job — driveway, drainage, fill, garden bed. We match the spec, the size, and the truck. You don't need to know the difference between #57 stone and road base.",
  },
  {
    Icon: Tag,
    head: 'One delivered price. No surprises.',
    body: 'Real quote at your ZIP in seconds — material, hauling, yard fee, tax. The number you see is the number on the invoice. No callbacks.',
  },
  {
    Icon: Clock,
    head: 'Delivery on your window, not theirs.',
    body: "Pick the day. Pick the time block. We dispatch when you're ready — not when the yard feels like sending a truck. Same-day in Denver and DFW.",
  },
  {
    Icon: Camera,
    head: 'Photo-confirmed at the drop.',
    body: 'Truck arrives, we photograph the load on your site, attach it to your order. Proof for your records, your client, your insurance, or your HOA — whichever shows up first.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="section hiw" id="how-it-works" aria-labelledby="hiw-heading">
      <div className="max">
        <div className="hiw-head">
          <p className="hiw-eyebrow">How it works</p>
          <h2 id="hiw-heading" className="hiw-h2">
            <span className="hiw-em">ZIP entered</span> to{' '}
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
                <div className="hiw-step-divider" aria-hidden="true" />
                <p className="hiw-step-tag">{s.tag}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="hiw-caps-head">
          <p className="hiw-eyebrow">Why earthmove</p>
          <h2 className="hiw-h2">Ordering aggregate shouldn&apos;t be a phone tag.</h2>
        </div>

        <div className="hiw-caps" role="list">
          {CAPS.map((c) => (
            <article key={c.head} className="hiw-cap" role="listitem">
              <c.Icon size={32} strokeWidth={1.75} aria-hidden="true" className="hiw-cap-icon-bare" />
              <h3 className="hiw-cap-h">{c.head}</h3>
              <p className="hiw-cap-p">{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
