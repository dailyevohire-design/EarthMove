import Link from 'next/link'

export function FootCTA() {
  return (
    <section className="v3-foot-cta">
      <div className="e">— For contractors</div>
      <h3>Custom spec? Send the takeoff.</h3>
      <p>We match yard, gradation, and truck class. One reply, not a sales tour. NET-30 available, MSA on request.</p>
      <div className="actions">
        <Link href="/order" className="v3-cta">Open dispatch →</Link>
        <a href="mailto:ops@earthmove.io" className="v3-cta ghost">Talk to ops</a>
      </div>
    </section>
  )
}
