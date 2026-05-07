export function PricingEngine() {
  return (
    <section className="v3-pe">
      <div className="v3-pe-l">
        <div className="v3-pe-eyebrow">— 02 · Routing model</div>
        <h2 className="v3-pe-h">
          Closer yard.<br />
          <em>Lower delivered price.</em>
        </h2>
        <p className="v3-pe-sub">
          Conventional aggregate distribution stacks broker layers between you and the yard.
          Our routing engine compresses them at the network edge — your delivered price is
          computed live against the closest verified yard.
        </p>
      </div>

      <div className="v3-pe-r">
        <div className="v3-pe-anchor">
          <div className="row broker">
            <div className="who">
              <span className="dot" />
              <div>
                <div className="name">Conventional path</div>
                <div className="meta">2 calls · 24h firm-up · broker margin</div>
              </div>
            </div>
          </div>

          <div className="v3-pe-conn">
            <div className="line" />
            <div className="pill">Routed</div>
          </div>

          <div className="row em">
            <div className="who">
              <span className="dot" />
              <div>
                <div className="name">Routed allocation</div>
                <div className="meta">Locked · same-day · live calc by ZIP</div>
              </div>
            </div>
          </div>
        </div>

        <div className="v3-pe-stack">
          <div className="layer"><span>Yard intermediation</span><span>removed</span></div>
          <div className="layer"><span>Broker margin layer</span><span>removed</span></div>
          <div className="layer"><span>Routing inefficiency</span><span>compressed</span></div>
          <div className="layer"><span>Firm-up delay cost</span><span>eliminated</span></div>
        </div>

        <div className="v3-pe-foot">
          <span>LIVE CALC · ZIP REQUIRED</span>
          <span>NO FIXED LIST · MARKET RATE</span>
        </div>
      </div>
    </section>
  )
}
