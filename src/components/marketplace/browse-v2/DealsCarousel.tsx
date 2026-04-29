import Link from 'next/link'

const FRAUNCES = "'Fraunces', serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"

export interface DealsCarouselProps {
  marketName: string
}

// Hardcoded deal data for this commit. Followup #30 wires to real /deals data.
type Deal = {
  reason: string
  name: string
  price: string
  cents: string
  unit: string
  strike?: string
  meta1: string
  meta2: string
}

const DEALS: Deal[] = [
  {
    reason: 'STOCKPILE CLEAR',
    name: 'Flex Base',
    price: '$22',
    cents: '.00',
    unit: '/ ton',
    strike: '$24',
    meta1: 'ABC Stone · Singleton Yard',
    meta2: '14 t tri-axle · 6.4 mi to drop · expires 6 PM today',
  },
  {
    reason: 'QUARRY OVERRUN',
    name: '#57 Stone',
    price: '$27',
    cents: '.00',
    unit: '/ ton',
    meta1: 'Trinity Materials · Mountain Creek',
    meta2: '22 t tandem · 9.1 mi to drop · 4 loads available',
  },
  {
    reason: 'WEEKEND WINDOW',
    name: 'Concrete Sand',
    price: '$19',
    cents: '.00',
    unit: '/ ton',
    meta1: 'Trinity Materials · Eagle Ford Yard',
    meta2: '14 t tri-axle · Sat 7am–4pm only · 8 loads',
  },
  {
    reason: 'RAIL CAR ARRIVAL',
    name: 'Rip Rap',
    price: '$34',
    cents: '.00',
    unit: '/ ton',
    meta1: 'Hanson Aggregates · Forney Yard',
    meta2: '22 t tandem · 18.4 mi to drop · D50 6"–12"',
  },
]

export function DealsCarousel({ marketName }: DealsCarouselProps) {
  return (
    <section
      className="mt-9 rounded-[24px] px-8 py-7 text-[#F1ECE2]"
      style={{
        background: '#14322A',
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <div className="flex justify-between items-end gap-3.5 mb-5">
        <div>
          <span
            className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2DB37A] whitespace-nowrap"
            style={{ fontFamily: SANS }}
          >
            <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#2DB37A]" />
            Today&apos;s deals &middot; {marketName}
          </span>
          <h2
            className="text-[24px] sm:text-[28px] lg:text-[32px] font-semibold tracking-[-0.02em] mt-2 leading-[1.1] text-white max-w-[24ch]"
            style={{ fontFamily: FRAUNCES }}
          >
            Four loads <em className="italic font-medium text-[#E5701B]">moving today</em>, priced under spread.
          </h2>
        </div>
        <Link
          href="/deals"
          className="text-[11.5px] tracking-[0.06em] font-semibold uppercase text-[#E5701B] hover:text-white transition-colors whitespace-nowrap"
          style={{ fontFamily: MONO }}
        >
          View all deals →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {DEALS.map((d) => (
          <DealCard key={d.name} deal={d} />
        ))}
      </div>
    </section>
  )
}

function DealCard({ deal }: { deal: Deal }) {
  return (
    <article
      className="rounded-[14px] p-[18px] flex flex-col gap-2 cursor-pointer transition-colors"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <span
        className="text-[9.5px] font-bold uppercase tracking-[0.10em] text-[#E5701B] rounded-[4px] px-[7px] py-[3px] self-start"
        style={{
          fontFamily: MONO,
          background: 'rgba(229,112,27,0.10)',
          border: '1px solid rgba(229,112,27,0.30)',
        }}
      >
        {deal.reason}
      </span>

      <span
        className="text-[22px] font-semibold tracking-[-0.015em] leading-[1.1] text-white mt-1.5"
        style={{ fontFamily: FRAUNCES }}
      >
        {deal.name}
      </span>

      <div className="flex items-baseline gap-2 mt-1.5">
        <span
          className="text-[30px] font-semibold text-white tracking-[-0.02em] leading-none"
          style={{ fontFamily: FRAUNCES }}
        >
          {deal.price}
          <span className="text-[16.5px] tracking-[-0.01em]">{deal.cents}</span>
        </span>
        <span
          className="text-[11px] text-[#A9B4AC] tracking-[0.04em]"
          style={{ fontFamily: MONO }}
        >
          {deal.unit}
        </span>
        {deal.strike && (
          <span
            className="text-[14px] line-through text-[#A9B4AC] ml-auto"
            style={{
              fontFamily: FRAUNCES,
              textDecorationColor: 'rgba(255,255,255,0.30)',
            }}
          >
            {deal.strike}
          </span>
        )}
      </div>

      <div
        className="text-[10.5px] text-[#A9B4AC] tracking-[0.04em] mt-1.5 pt-2.5 leading-[1.5]"
        style={{
          fontFamily: MONO,
          borderTop: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <b className="text-white font-semibold">{deal.meta1}</b>
        <br />
        {deal.meta2}
      </div>

      <span
        className="mt-1 text-[11px] text-[#E5701B] tracking-[0.04em] font-semibold uppercase inline-flex items-center gap-1.5"
        style={{ fontFamily: MONO }}
      >
        Order this load →
      </span>
    </article>
  )
}
