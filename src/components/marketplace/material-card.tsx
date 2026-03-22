import Link from 'next/link'
import Image from 'next/image'
import type { MarketMaterialCard } from '@/types'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { Truck, Zap, Clock, Star } from 'lucide-react'

export function MaterialCard({ card, size = 'default' }: { card: MarketMaterialCard; size?: 'default' | 'large' }) {
  const isLarge = size === 'large'

  return (
    <Link href={`/browse/${card.slug}`} className="group block">
      <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 hover:-translate-y-1">
        {/* Image container */}
        <div className={`relative overflow-hidden ${isLarge ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}>
          {card.image_url ? (
            <Image
              src={card.image_url}
              alt={card.name}
              fill
              className="object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
              sizes={isLarge
                ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              }
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-50 via-gray-50 to-emerald-100" />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Deal badge - DoorDash style */}
          {card.badge_label && (
            <div className="absolute top-3 left-3">
              <div className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-red-500/30">
                <Zap size={11} className="fill-current" />
                <span className="text-[11px] font-black uppercase tracking-wide">{card.badge_label}</span>
              </div>
            </div>
          )}

          {/* Popular tag */}
          {card.is_featured && !card.badge_label && (
            <div className="absolute top-3 left-3">
              <div className="flex items-center gap-1 bg-white text-gray-800 px-2.5 py-1 rounded-lg shadow-md text-[11px] font-bold">
                <Star size={10} className="text-amber-400 fill-amber-400" />
                Popular
              </div>
            </div>
          )}

          {/* Delivery estimate */}
          {card.delivery_fee_base != null && (
            <div className="absolute bottom-3 left-3">
              <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-lg shadow-sm">
                <Truck size={11} className="text-emerald-600" />
                <span className="text-[11px] font-semibold text-gray-700">From {formatCurrency(card.delivery_fee_base)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className={`font-bold text-gray-900 leading-snug group-hover:text-emerald-600 transition-colors ${isLarge ? 'text-lg' : 'text-[15px]'}`}>
                {card.name}
              </h3>
              <p className="text-gray-500 text-xs mt-1">{card.category_name}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className={`font-extrabold text-gray-900 ${isLarge ? 'text-xl' : 'text-lg'}`}>
                {formatCurrency(card.display_price)}
              </div>
              <div className="text-gray-400 text-[10px] font-medium">per {unitLabel(card.unit, 1)}</div>
            </div>
          </div>

          {/* Min order */}
          {card.minimum_order_quantity > 1 && (
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-gray-400">
              <Clock size={10} />
              Min. {card.minimum_order_quantity} {unitLabel(card.unit, card.minimum_order_quantity)}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

/** Large featured card for deals/promos */
export function DealCard({ card }: { card: MarketMaterialCard }) {
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
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-50 to-orange-50" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Deal badge */}
          <div className="absolute top-3 left-3">
            <div className="flex items-center gap-1.5 bg-red-500 text-white px-3.5 py-2 rounded-xl shadow-lg shadow-red-500/30">
              <Zap size={13} className="fill-current" />
              <span className="text-sm font-black">{card.badge_label ?? 'DEAL'}</span>
            </div>
          </div>

          {/* Price on image */}
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
