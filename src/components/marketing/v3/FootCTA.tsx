import Link from 'next/link'

interface Props {
  yardsCount: number
  liveMarkets: number
}

export function FootCTA({ yardsCount, liveMarkets }: Props) {
  return (
    <section className="v3-foot-cta">
      <div className="v3-foot-cta-l">
        <div className="e">— For contractors</div>
        <h3>Custom spec? Send the takeoff.</h3>
        <p>We match yard, gradation, and truck class. One reply, not a sales tour. NET-30 available, MSA on request.</p>
      </div>
      <div className="v3-foot-cta-r">
        <div className="v3-foot-stats">
          <div className="fs"><div className="k">Verified yards</div><div className="v">{yardsCount}</div></div>
          <div className="fs"><div className="k">Live markets</div><div className="v">{liveMarkets}</div></div>
          <div className="fs"><div className="k">Operating</div><div className="v">M–F · 5a–8p</div></div>
        </div>
        <div className="actions">
          <Link href="/order" className="v3-cta">Open dispatch →</Link>
          <a href="mailto:ops@earthmove.io" className="v3-cta ghost">Talk to ops</a>
        </div>
      </div>
    </section>
  )
}
