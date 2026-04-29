import Link from 'next/link'

const FRAUNCES = "'Fraunces', serif"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

export interface StubPageProps {
  title: string
  eyebrow: string
  blurb?: string
}

const DEFAULT_BLURB = "Coming this week. We'll let you know when it's live."

// Followup #40: as each stub becomes a real page, replace this scaffold
// with the actual content. Nav config flag (isStub) flips to false.
export function StubPage({ title, eyebrow, blurb = DEFAULT_BLURB }: StubPageProps) {
  return (
    <section className="max-w-[640px] py-8">
      <span
        className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2A332E]"
        style={{ fontFamily: SANS }}
      >
        <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#2A332E]" />
        {eyebrow}
      </span>
      <h1
        className="font-semibold text-[42px] sm:text-[52px] leading-[0.96] tracking-[-0.02em] mt-3.5 mb-4 text-[#15201B] max-w-[18ch]"
        style={{ fontFamily: FRAUNCES }}
      >
        {title}
      </h1>
      <p className="text-[16px] text-[#2A332E] leading-[1.55] max-w-[52ch]">{blurb}</p>
      <Link
        href="/dashboard/driver"
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-[#5C645F] hover:text-[#E5701B] font-semibold mt-8"
        style={{ fontFamily: MONO }}
      >
        ← Back to dashboard
      </Link>
    </section>
  )
}
