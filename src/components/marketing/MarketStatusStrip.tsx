/**
 * MarketStatusStrip — full-width dark strip above the homepage hero.
 * "Network online" + green pulse dot + market list (DEN · DFW).
 * No phone (deferred — see C-CHROME followup). No interactivity.
 */
export function MarketStatusStrip() {
  return (
    <div className="mss" role="status" aria-label="earthmove.io network status">
      <div className="mss-inner">
        <span className="mss-status">
          <span className="mss-dot" aria-hidden="true" />
          Network online
        </span>
        <span className="mss-sep" aria-hidden="true">·</span>
        <span className="mss-markets">DEN · DFW</span>
      </div>
    </div>
  )
}
