import type { ReactNode } from 'react'
import type { MarketMaterialCard } from '@/types'
import { MaterialTileV2 } from './MaterialTileV2'

const FRAUNCES = "'Fraunces', serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"

export interface CategoryGroupProps {
  category: { slug: string; name: string }
  priceRange: { min: number; max: number; unit: string }
  cards: MarketMaterialCard[]
}

const TAGLINES: Record<string, ReactNode> = {
  base: <>Compaction-grade <em className="italic font-medium">load-bearing layers</em>.</>,
  fill: <>Bulk fill, topsoil, and <em className="italic font-medium">cover material</em>.</>,
  sand: <>Concrete, mason, and <em className="italic font-medium">bedding sand</em>.</>,
  gravel: <>Drainage rock and <em className="italic font-medium">concrete aggregate</em>.</>,
  rock: <>Armor stone for <em className="italic font-medium">slope and shoreline</em>.</>,
  decorative: <>Finish-grade stone for <em className="italic font-medium">visible surfaces</em>.</>,
  recycled: <>Crushed concrete, <em className="italic font-medium">graded for spec</em>.</>,
}

function fmtPrice(n: number): string {
  return `$${Math.round(n)}`
}

export function CategoryGroup({ category, priceRange, cards }: CategoryGroupProps) {
  const tagline = TAGLINES[category.slug] ?? category.name
  const count = cards.length
  const range =
    priceRange.min === priceRange.max
      ? `${fmtPrice(priceRange.min)} / ${priceRange.unit}`
      : `${fmtPrice(priceRange.min)} – ${fmtPrice(priceRange.max)} / ${priceRange.unit}`

  return (
    <section id={`cat-${category.slug}`} className="mt-9 scroll-mt-[80px]">
      <div className="flex justify-between items-end gap-3.5 mb-3.5">
        <div className="flex flex-col gap-2">
          <span
            className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2A332E] whitespace-nowrap"
            style={{ fontFamily: SANS }}
          >
            <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#2A332E]" />
            {category.name} &middot; {count} material{count === 1 ? '' : 's'}
          </span>
          <h3
            className="text-[24px] sm:text-[28px] lg:text-[32px] font-semibold tracking-[-0.02em] leading-[1.1] text-[#15201B] m-0"
            style={{ fontFamily: FRAUNCES }}
          >
            {tagline}
          </h3>
        </div>
        <span
          className="text-[11px] tracking-[0.04em] text-[#5C645F] whitespace-nowrap"
          style={{ fontFamily: MONO }}
        >
          {range}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[18px]">
        {cards.map((card) => (
          <MaterialTileV2 key={card.market_material_id} card={card} />
        ))}
      </div>
    </section>
  )
}
