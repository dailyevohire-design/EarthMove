import Link from 'next/link'

export function FootCTA() {
  return (
    <>
      <section className="v3-foot-cta">
        <div className="v3-foot-cta-l">
          <div className="v3-eyebrow">— FOR EVERYONE</div>
          <h2 className="v3-h2">
            30-second decision.
            <br />
            <em>Not 30-day liability.</em>
          </h2>
          <p className="v3-lede">
            Run a check on any registered business entity in seconds before
            you sign a contract or issue a PO. Standard for everyone &mdash;
            not just enterprise buyers who can afford $5,000/year for it.
          </p>
          <div className="v3-foot-actions">
            <Link href="/trust" className="v3-cta">Open Groundcheck →</Link>
            <Link href="/about" className="v3-cta ghost">How it works</Link>
          </div>
        </div>
        <div className="v3-foot-cta-r">
          <div className="v3-foot-stats">
            <div>
              <div className="k">PUBLIC RECORDS</div>
              <div className="v">Free</div>
            </div>
            <div>
              <div className="k">ENTITY CHECKS</div>
              <div className="v">Live</div>
            </div>
            <div>
              <div className="k">ACCESS</div>
              <div className="v">Open</div>
            </div>
          </div>
        </div>
      </section>

      <section className="v3-mission">
        <div className="v3-mission-inner">
          <div className="v3-eyebrow">— MISSION</div>
          <h2 className="v3-h2">
            1.5 million <em>meals.</em>
          </h2>
          <p className="v3-lede">
            EarthMove is committed to providing 1.5 million meals through our
            partnership with Feeding America®. Our commitment helps support
            neighbors facing food insecurity.
          </p>
          <p className="v3-mission-foot">
            *$1 helps provide at least 10 meals secured by Feeding America®
            on behalf of local partner food banks.
          </p>
          <div className="v3-foot-actions">
            <Link href="/about" className="v3-cta ghost">About the partnership</Link>
          </div>
        </div>
      </section>
    </>
  )
}
