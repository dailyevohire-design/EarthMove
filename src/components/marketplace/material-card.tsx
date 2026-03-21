import Link from 'next/link'
import type { MarketMaterialCard } from '@/types'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { Package, Truck, Tag } from 'lucide-react'

export function MaterialCard({ card }: { card: MarketMaterialCard }) {
  return (
    <Link href={`/browse/${card.slug}`} className="card-hover group flex flex-col">
      {/* Image */}
      <div className="aspect-[16/11] bg-gray-100 rounded-t-xl overflow-hidden relative">
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package size={32} className="text-gray-300" />
          </div>
        )}

        {card.badge_label && (
          <div className="absolute top-2.5 left-2.5">
            <span className="badge-green text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
              <Tag size={9} />
              {card.badge_label}
            </span>
          </div>
        )}
        {card.is_featured && !card.badge_label && (
          <div className="absolute top-2.5 left-2.5">
            <span className="badge-stone text-[10px]">Popular</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
            {card.category_name}
          </div>
          <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-emerald-600 transition-colors">
            {card.name}
          </h3>
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex items-baseline gap-1.5">
            <span className="price-display text-lg">
              {formatCurrency(card.display_price)}
            </span>
            <span className="text-gray-400 text-xs">/ {unitLabel(card.unit, 1)}</span>
          </div>

          {card.delivery_fee_base != null && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Truck size={11} className="text-gray-300" />
              Delivery from {formatCurrency(card.delivery_fee_base)}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
