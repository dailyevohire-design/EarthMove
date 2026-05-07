import Link from 'next/link'

export function V3Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="v3-footer" aria-label="Site footer">
      <div className="v3-footer-top">
        <Link href="/" className="v3-footer-brand" aria-label="Earthmove home">
          <svg width="160" height="26" viewBox="0 0 200 36" fill="none" aria-hidden>
            <rect x="0" y="6" width="22" height="3.4" fill="currentColor" />
            <rect x="0" y="16.3" width="18" height="3.4" fill="currentColor" />
            <rect x="0" y="26.6" width="22" height="3.4" fill="currentColor" />
            <text
              x="28"
              y="28"
              fontFamily='"Inter", system-ui, sans-serif'
              fontSize="26"
              fontWeight="600"
              letterSpacing="-0.02em"
              fill="currentColor"
            >
              arthmove
            </text>
          </svg>
        </Link>
        <p className="v3-footer-tag">Aggregate routing infrastructure for the dirt economy.</p>
      </div>

      <nav className="v3-footer-nav" aria-label="Footer navigation">
        <div className="v3-footer-col">
          <div className="v3-footer-h">Product</div>
          <Link href="/browse">Browse materials</Link>
          <Link href="/projects">Project routing</Link>
          <Link href="/collections">Collections</Link>
          <Link href="/deals">Live deals</Link>
        </div>

        <div className="v3-footer-col">
          <div className="v3-footer-h">For drivers</div>
          <Link href="/join?role=driver">Driver signup</Link>
          <Link href="/dashboard/driver">Driver dashboard</Link>
          <Link href="/dashboard/driver/trust">Driver Groundcheck</Link>
        </div>

        <div className="v3-footer-col">
          <div className="v3-footer-h">For contractors</div>
          <Link href="/join?role=gc">Contractor signup</Link>
          <Link href="/dashboard/gc/contractors">Contractor dashboard</Link>
          <a href="mailto:ops@earthmove.io?subject=Project%20pricing%20inquiry">Project pricing</a>
          <a href="mailto:ops@earthmove.io?subject=Bulk%20%2B%20recurring%20delivery">Bulk + recurring</a>
        </div>

        <div className="v3-footer-col">
          <div className="v3-footer-h">Company</div>
          <Link href="/about">About</Link>
          <Link href="/trust">Groundcheck</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact us</Link>
        </div>
      </nav>

      <div className="v3-footer-rule" />

      <div className="v3-footer-legal">
        <div className="v3-footer-meta">
          <span>© {year} Earth Pro Connect LLC · Earthmove™</span>
          <span>DEN · DFW launching today · Portland next</span>
        </div>
        <nav className="v3-footer-legal-links" aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/legal/refunds">Refunds</Link>
        </nav>
      </div>
    </footer>
  )
}
