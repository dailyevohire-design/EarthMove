import Link from 'next/link'
import Image from 'next/image'
import type { MarketMaterialCard } from '@/types'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { Truck, Zap, Clock, Star, ArrowRight } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  'Fill': 'bg-amber-600', 'Sand': 'bg-yellow-600', 'Gravel': 'bg-gray-600',
  'Aggregate': 'bg-orange-600', 'Rock': 'bg-slate-600', 'Recycled': 'bg-emerald-600',
  'Specialty': 'bg-purple-600',
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  'Fill': 'from-amber-100 to-amber-50', 'Sand': 'from-yellow-100 to-yellow-50',
  'Gravel': 'from-gray-200 to-gray-100', 'Aggregate': 'from-orange-100 to-orange-50',
  'Rock': 'from-slate-200 to-slate-100', 'Recycled': 'from-emerald-100 to-emerald-50',
  'Specialty': 'from-purple-100 to-purple-50',
}

export function MaterialCard({ card, size = 'default' }: { card: MarketMaterialCard; size?: 'default' | 'large' }) {
  const catColor = CATEGORY_COLORS[card.category_name] ?? 'bg-gray-600'
  const catGradient = CATEGORY_GRADIENTS[card.category_name] ?? 'from-gray-100 to-gray-50'

  return (
    <Link href={`/browse/${card.slug}`} className="group block">
      <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02]">
        {/* Image — 2:3 aspect ratio */}
        <div className="relative aspect-[3/2] overflow-hidden">
          {card.image_url ? (
            <Image
              src={card.image_url}
              alt={card.name}
              fill
              className="object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              unoptimized
            />
          ) : null}

          {/* Fallback gradient if no image or image fails */}
          <div className={`absolute inset-0 bg-gradient-to-br ${catGradient} -z-10`} />

          {/* Bottom gradient for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          {/* Category pill — top left */}
          <div className="absolute top-3 left-3">
            <span className={`px-2.5 py-1 rounded-lg ${catColor} text-white text-[10px] font-bold uppercase tracking-wide`}>
              {card.category_name}
            </span>
          </div>

          {/* Featured star — top right */}
          {card.is_featured && !card.badge_label && (
            <div className="absolute top-3 right-3">
              <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/30">
                <Star size={14} className="text-white fill-white" />
              </div>
            </div>
          )}

          {/* Deal badge — top right, pulsing */}
          {card.badge_label && (
            <div className="absolute top-3 right-3">
              <div className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-red-500/30 animate-pulse">
                <Zap size={11} className="fill-current" />
                <span className="text-[11px] font-black uppercase">{card.badge_label}</span>
              </div>
            </div>
          )}

          {/* Delivery badge — bottom left on image */}
          {card.delivery_fee_base != null && (
            <div className="absolute bottom-3 left-3">
              <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-lg shadow-sm">
                <Truck size={11} className="text-emerald-600" />
                <span className="text-[11px] font-semibold text-gray-700">From {formatCurrency(card.delivery_fee_base)}</span>
              </div>
            </div>
          )}

          {/* Hover overlay with Order button */}
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 p-3">
            <div className="bg-emerald-600 text-white rounded-xl py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5 shadow-lg">
              Order Now <ArrowRight size={14} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-[15px] leading-snug group-hover:text-emerald-600 transition-colors">
                {card.name}
              </h3>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="font-extrabold text-gray-900 text-lg">{formatCurrency(card.display_price)}</div>
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

/** Deal card for horizontal carousels */
export function DealCard({ card }: { card: MarketMaterialCard }) {
  const catGradient = CATEGORY_GRADIENTS[card.category_name] ?? 'from-gray-100 to-gray-50'

  return (
    <Link href={`/browse/${card.slug}`} className="group block flex-shrink-0 w-[320px] sm:w-[360px]">
      <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        <div className="relative aspect-[16/10] overflow-hidden">
          {card.image_url ? (
            <Image
              src={card.image_url}
              alt={card.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              sizes="360px"
            />
          ) : null}
          <div className={`absolute inset-0 bg-gradient-to-br ${catGradient} -z-10`} />
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
