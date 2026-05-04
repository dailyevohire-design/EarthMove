import Link from 'next/link'
import { Logo } from '@/components/logo'

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-[#14322A] text-[#F1ECE2]">
      <div className="container-main py-16 md:py-24">
        <Link href="/" aria-label="Earthmove home" className="inline-block">
          <Logo variant="wordmark" size={28} theme="reverse" />
        </Link>
        <p
          className="mt-3 italic text-[14px] text-[rgba(245,241,232,0.7)]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Intelligence behind each load.
        </p>

        <nav className="mt-12 flex flex-col gap-3.5" aria-label="Footer">
          <Link href="/material-match" className="text-[17px] font-medium hover:underline">Material Match</Link>
          <Link href="/trust" className="text-[17px] font-medium hover:underline">Ground Check</Link>
          <Link href="/learn" className="text-[17px] font-medium hover:underline">Learn</Link>
          <Link href="/join?role=gc" className="text-[17px] font-medium hover:underline">Contractor Sign Up</Link>
          <Link href="/join?role=driver" className="text-[17px] font-medium hover:underline">Driver Sign Up</Link>
        </nav>

        <div className="mt-12 h-px bg-[rgba(245,241,232,0.15)]" />

        <div className="mt-6 text-[12px] text-[rgba(245,241,232,0.6)] space-y-1">
          <p>&copy; {year} Earth Pro Connect LLC</p>
          <p>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            {' · '}
            <Link href="/terms" className="hover:underline">Terms</Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
