import Link from 'next/link'
import Image from 'next/image'
import type { MarketMaterialCard } from '@/types'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { Truck, Tag, Zap } from 'lucide-react'

export function MaterialCard({ card }: { card: MarketMaterialCard }) {
  return (
    <Link href={`/browse/${card.slug}`} className="group block">
      <div className="card-hover overflow-hidden">
        {/* Image */}
        <div className="aspect-[4/3] relative overflow-hidden">
          {card.image_url ? (
            <Image
              src={card.image_url}
              alt={card.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm">
                <Truck size={24} className="text-gray-400" />
              </div>
            </div>
          )}

          {/* Deal badge */}
          {card.badge_label && (
            <div className="absolute top-3 left-3">
              <span className="badge-deal text-[11px] flex items-center gap-1 px-3 py-1.5">
                <Zap size={10} />
                {card.badge_label}
              </span>
            </div>
          )}

          {/* Popular badge */}
          {card.is_featured && !card.badge_label && (
            <div className="absolute top-3 left-3">
              <span className="badge bg-white/90 backdrop-blur-sm text-gray-700 text-[10px] border border-white/50 shadow-sm">Popular</span>
            </div>
          )}

          {/* Price overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-4 pt-10">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-white/70 text-[10px] font-medium uppercase tracking-wider mb-0.5">
                  {card.category_name}
                </div>
                <h3 className="font-bold text-white text-base leading-snug">
                  {card.name}
                </h3>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-lg tabular-nums">
                  {formatCurrency(card.display_price)}
                </div>
                <div className="text-white/60 text-[10px]">/ {unitLabel(card.unit, 1)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100">
          {card.delivery_fee_base != null ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Truck size={12} className="text-emerald-500" />
              Delivery from {formatCurrency(card.delivery_fee_base)}
            </div>
          ) : (
            <div />
          )}
          <span className="text-xs font-semibold text-emerald-600 group-hover:text-emerald-700 transition-colors">
            Order →
          </span>
        </div>
      </div>
    </Link>
  )
}
