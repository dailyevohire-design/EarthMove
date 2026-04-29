import Link from 'next/link'
import Image from 'next/image'
import type { MarketMaterialCard } from '@/types'
import { getMaterialImage } from '@/lib/material-images'

const FRAUNCES = "'Fraunces', serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

export interface MaterialTileV2Props {
  card: MarketMaterialCard
}

function unitLabelShort(unit: string): string {
  return unit === 'cubic_yard' ? 'YD³' : unit === 'load' ? 'LOAD' : 'TON'
}
function unitLabelLong(unit: string, qty: number): string {
  if (unit === 'cubic_yard') return qty === 1 ? 'yd³' : 'yd³'
  if (unit === 'load') return qty === 1 ? 'load' : 'loads'
  return qty === 1 ? 'ton' : 'tons'
}

export function MaterialTileV2({ card }: MaterialTileV2Props) {
  const img = getMaterialImage(card.slug)
  const priceDisplay = `$${Math.round(card.display_price)} / ${unitLabelShort(card.unit)}`
  const minOrderQty = card.minimum_order_quantity ?? 1
  const description =
    card.description ?? `Bulk ${card.name.toLowerCase()} — same-day or next-day delivery from local yards.`

  // followup #30: render solid-orange deal lozenge "{REASON} · ${dealPrice}" once
  // promotion data is joined into the card shape.

  return (
    <Link
      href={`/browse/${card.slug}`}
      className="group block bg-white border border-[#D8D2C4] rounded-[18px] overflow-hidden flex flex-col cursor-pointer transition-all hover:-translate-y-0.5 hover:border-[#C8C0AC] hover:shadow-[0_14px_32px_rgba(20,32,27,0.10)]"
    >
      <div className="relative aspect-[16/11] overflow-hidden">
        <Image
          src={img}
          alt={card.name}
          fill
          sizes="(min-width:1280px) 25vw, (min-width:640px) 50vw, 100vw"
          className="object-cover transition-transform duration-[350ms] group-hover:scale-[1.04]"
        />
        <div className="absolute top-3.5 left-3.5 flex flex-col items-start gap-1.5">
          <Lozenge variant="default">{(card.category_name || 'MATERIAL').toUpperCase()}</Lozenge>
          <Lozenge variant="solid-emerald">{priceDisplay}</Lozenge>
        </div>
      </div>

      <div className="px-5 pt-[18px] pb-5 flex flex-col gap-2 flex-1">
        <h4
          className="text-[22px] font-semibold tracking-[-0.015em] leading-[1.15] text-[#15201B] m-0"
          style={{ fontFamily: FRAUNCES }}
        >
          {card.name}
        </h4>
        <p
          className="text-[13.5px] text-[#2A332E] leading-[1.55] m-0 overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            textWrap: 'pretty',
          }}
        >
          {description}
        </p>
        <div
          className="mt-auto pt-3.5 flex justify-between items-center gap-3.5"
          style={{ borderTop: '1px solid #D8D2C4' }}
        >
          <span
            className="text-[10.5px] tracking-[0.06em] uppercase text-[#5C645F] font-semibold"
            style={{ fontFamily: MONO }}
          >
            Min order &middot; <b className="text-[#2A332E] font-semibold">{minOrderQty} {unitLabelLong(card.unit, minOrderQty)}</b>
          </span>
          <span
            className="text-[11px] tracking-[0.06em] uppercase text-[#2A332E] font-semibold inline-flex items-center gap-1.5 transition-colors group-hover:text-[#E5701B]"
            style={{ fontFamily: MONO }}
          >
            View details →
          </span>
        </div>
      </div>
    </Link>
  )
}

function Lozenge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: 'default' | 'solid-emerald' | 'solid-orange'
}) {
  const palette =
    variant === 'solid-emerald'
      ? 'bg-[#1F8A5C] text-white border-transparent'
      : variant === 'solid-orange'
      ? 'bg-[#E5701B] text-white border-transparent'
      : 'bg-white text-[#15201B] border-[#D8D2C4]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] border rounded-[5px] px-[9px] py-[5px] whitespace-nowrap ${palette}`}
      style={{ fontFamily: MONO }}
    >
      {children}
    </span>
  )
}
