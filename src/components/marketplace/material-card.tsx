import Link from 'next/link'
import type { MarketMaterialCard } from '@/types'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { getMaterialImage } from '@/lib/material-images'
import { Truck, Zap, Clock, Star, ArrowRight } from 'lucide-react'

const KNOWN_CAT_SLUGS = new Set([
  'fill', 'sand', 'gravel', 'aggregate', 'rock', 'recycled', 'specialty',
])

function catTokens(slug: string): { color: string; bg: string } {
  const s = KNOWN_CAT_SLUGS.has(slug) ? slug : 'gravel'
  return {
    color: `var(--commerce-cat-${s})`,
    bg:    `var(--commerce-cat-${s}-bg)`,
  }
}

export function MaterialCard({ card }: { card: MarketMaterialCard }) {
  const { color: catColor, bg: fallbackBg } = catTokens(card.category_slug)
  const imageUrl = getMaterialImage(card.slug)

  return (
    <Link href={`/browse/${card.slug}`} className="material-card group block touch-manipulation select-none">
      <div className="relative rounded-2xl overflow-hidden bg-white border border-gray-200/80 transition-all duration-200 will-change-transform
        shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(15,23,42,0.04),0_14px_28px_-14px_rgba(15,23,42,0.14)]
        hover:shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_4px_12px_rgba(15,23,42,0.08),0_28px_56px_-20px_rgba(16,185,129,0.28)]
        hover:border-emerald-200 hover:-translate-y-1
        active:translate-y-0 active:scale-[0.985] active:duration-75
        active:shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(15,23,42,0.06)]">
        {/* Image */}
        <div className="material-card-photo relative overflow-hidden" style={{ height: 220, background: fallbackBg }}>
          <img
            src={imageUrl}
            alt={card.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />

          {/* Bottom gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

          {/* Category pill */}
          <div className="absolute top-3 left-3">
            <span
              className="material-card-category px-2.5 py-1 rounded-lg text-white text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: catColor }}
            >
              {card.category_name}
            </span>
          </div>

          {/* Featured star */}
          {card.is_featured && !card.badge_label && (
            <div className="absolute top-3 right-3">
              <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/30">
                <Star size={14} className="text-white fill-white" />
              </div>
            </div>
          )}

          {/* Deal badge */}
          {card.badge_label && (
            <div className="absolute top-3 right-3">
              <div className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-red-500/30 animate-pulse">
                <Zap size={11} className="fill-current" />
                <span className="text-[11px] font-black uppercase">{card.badge_label}</span>
              </div>
            </div>
          )}

          {/* Delivery badge */}
          {card.delivery_fee_base != null && (
            <div className="absolute bottom-3 left-3">
              <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-lg shadow-sm">
                <Truck size={11} className="text-emerald-600" />
                <span className="text-[11px] font-semibold text-gray-700">From {formatCurrency(card.delivery_fee_base)}</span>
              </div>
            </div>
          )}

          {/* Hover order button */}
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 p-3">
            <div className="bg-emerald-600 text-white rounded-xl py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5 shadow-lg">
              Order Now <ArrowRight size={14} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="material-card-content p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="material-card-name font-bold text-gray-900 text-[15px] leading-snug group-hover:text-emerald-600 transition-colors">
              {card.name}
            </h3>
            <div className="flex-shrink-0 text-right">
              <div className="material-card-price font-extrabold text-gray-900 text-lg">{formatCurrency(card.display_price)}</div>
              <div className="text-gray-400 text-[10px] font-medium">per {unitLabel(card.unit, 1)}</div>
            </div>
          </div>
          {card.minimum_order_quantity > 1 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
              <Clock size={10} />
              Min. {card.minimum_order_quantity} {unitLabel(card.unit, card.minimum_order_quantity)} · Same-day available
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export function DealCard({ card }: { card: MarketMaterialCard }) {
  const { bg: fallbackBg } = catTokens(card.category_slug)
  const imageUrl = getMaterialImage(card.slug)

  return (
    <Link href={`/browse/${card.slug}`} className="group block flex-shrink-0 w-full max-w-[360px] sm:w-[360px] touch-manipulation select-none">
      <div className="rounded-2xl overflow-hidden bg-white border border-gray-200/80 transition-all duration-200 will-change-transform
        shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(15,23,42,0.04),0_14px_28px_-14px_rgba(15,23,42,0.14)]
        hover:shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_4px_12px_rgba(15,23,42,0.08),0_28px_56px_-20px_rgba(239,68,68,0.3)]
        hover:border-red-200 hover:-translate-y-1
        active:translate-y-0 active:scale-[0.985] active:duration-75
        active:shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="relative overflow-hidden" style={{ height: 200, background: fallbackBg }}>
          <img
            src={imageUrl}
            alt={card.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          <div className="absolute top-3 left-3">
            <div className="flex items-center gap-1.5 bg-red-500 text-white px-3.5 py-2 rounded-xl shadow-lg shadow-red-500/30 animate-pulse">
              <Zap size={13} className="fill-current" />
              <span className="text-sm font-black">{card.badge_label ?? 'DEAL'}</span>
            </div>
          </div>

          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="font-bold text-white text-lg leading-snug mb-1">{card.name}</h3>
            <div className="flex items-center gap-2">
              <span className="text-white font-extrabold text-xl">{formatCurrency(card.display_price)}</span>
              <span className="text-white/60 text-xs">/ {unitLabel(card.unit, 1)}</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Truck size={12} className="text-emerald-500" />
            {card.delivery_fee_base ? `Delivery from ${formatCurrency(card.delivery_fee_base)}` : 'Delivery available'}
          </div>
          <span className="text-xs font-bold text-red-500">Limited time</span>
        </div>
      </div>
    </Link>
  )
}
