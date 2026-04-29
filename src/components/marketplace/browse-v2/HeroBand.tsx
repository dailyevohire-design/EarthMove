import type { ReactNode } from 'react'

export interface HeroBandProps {
  marketName: string
  materialCount: number
  categoryCount: number
}

const FRAUNCES = "'Fraunces', serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"

export function HeroBand({ marketName, materialCount, categoryCount }: HeroBandProps) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-12 items-end pt-10 pb-7">
      <div>
        <span
          className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2A332E] whitespace-nowrap"
          style={{ fontFamily: SANS }}
        >
          <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#2A332E]" />
          Materials &middot; {marketName}
        </span>

        <h1
          className="font-semibold text-[42px] sm:text-[52px] lg:text-[62px] leading-[0.96] tracking-[-0.02em] mt-3.5 mb-[18px] text-[#15201B] max-w-[18ch]"
          style={{ fontFamily: FRAUNCES }}
        >
          Every aggregate, <em className="italic font-medium">priced and delivered</em> in {marketName}.
        </h1>

        <p className="text-[16px] text-[#2A332E] leading-[1.55] max-w-[52ch] mb-[18px]" style={{ textWrap: 'pretty' }}>
          <b className="text-[#15201B] font-semibold">{materialCount} stocked materials</b> across {categoryCount} categories.
          Same-day or next-day delivery from local yards in your market.
        </p>

        <div className="flex flex-wrap gap-1.5 mt-2">
          <Lozenge>{materialCount} MATERIALS</Lozenge>
          <Lozenge>{categoryCount} CATEGORIES</Lozenge>
          <Lozenge variant="solid-emerald" dot>SAME-DAY DELIVERY</Lozenge>
        </div>
      </div>

      <div className="bg-white border border-[#D8D2C4] rounded-[18px] p-5 grid grid-cols-2 gap-y-3.5 gap-x-[22px]">
        <OpsCell label="Coverage" value="10 mi" suffix="radius from yard" meta="Out-of-radius? Quote in 24h" />
        <OpsCell label="Live yards" value="6" suffix="active today" meta="Updated every 5 min" />
        <OpsCell label="Drivers on shift" value="23" suffix="tri-axle / dump" meta="7am – 6pm Mon–Sat" />
        <OpsCell label="Avg dispatch" value="42" suffix="min from order" meta="Same-day, in-radius" />
      </div>
    </section>
  )
}

function Lozenge({
  children,
  variant = 'default',
  dot = false,
}: {
  children: ReactNode
  variant?: 'default' | 'solid-emerald' | 'solid-orange'
  dot?: boolean
}) {
  const palette =
    variant === 'solid-emerald'
      ? 'bg-[#1F8A5C] text-white border-transparent'
      : variant === 'solid-orange'
      ? 'bg-[#E5701B] text-white border-transparent'
      : 'bg-white text-[#15201B] border-[#D8D2C4]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] border rounded-[5px] px-[9px] py-[5px] whitespace-nowrap ${palette}`}
      style={{ fontFamily: MONO }}
    >
      {dot && <span aria-hidden className="w-[5px] h-[5px] rounded-full bg-[#2DB37A]" />}
      {children}
    </span>
  )
}

function OpsCell({
  label,
  value,
  suffix,
  meta,
}: {
  label: string
  value: string
  suffix?: string
  meta?: string
}) {
  return (
    <div>
      <span
        className="text-[10px] uppercase tracking-[0.10em] text-[#5C645F] font-semibold"
        style={{ fontFamily: MONO }}
      >
        {label}
      </span>
      <div
        className="font-semibold text-[22px] leading-[1.15] tracking-[-0.015em] text-[#15201B] mt-0.5"
        style={{ fontFamily: FRAUNCES }}
      >
        {value}
        {suffix && (
          <small
            className="text-[11px] font-medium text-[#5C645F] ml-1"
            style={{ fontFamily: SANS }}
          >
            {suffix}
          </small>
        )}
      </div>
      {meta && (
        <div
          className="text-[10.5px] text-[#5C645F] mt-px tracking-[0.04em]"
          style={{ fontFamily: MONO }}
        >
          {meta}
        </div>
      )}
    </div>
  )
}
