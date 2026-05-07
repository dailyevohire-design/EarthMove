import Link from 'next/link'

export function Header() {
  return (
    <header className="v3-hdr">
      <Link href="/" className="v3-hdr-brand" aria-label="Earthmove home">
        <svg className="v3-hdr-logo" viewBox="0 0 200 36" fill="none" aria-hidden>
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
      <nav className="v3-hdr-nav">
        <Link href="/login" className="v3-hdr-cta">Sign in</Link>
        <Link href="/order" className="pill">Open dispatch →</Link>
      </nav>
    </header>
  )
}
