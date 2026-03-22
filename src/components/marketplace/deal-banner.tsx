'use client'
import Link from 'next/link'
import { Zap, ArrowRight, Clock } from 'lucide-react'

export function DealBanner({ promotion }: { promotion: any }) {
  const label =
    promotion.promotion_type === 'percentage' ? `${promotion.discount_value}% OFF` :
    promotion.promotion_type === 'flat_amount' ? `$${promotion.discount_value} OFF` :
    promotion.promotion_type === 'price_override' ? `NOW $${promotion.override_price}` : 'SPECIAL'

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-full">
          <Zap size={12} className="text-white" />
          <span className="text-[11px] font-black text-white uppercase tracking-wide">Deal of the Day</span>
        </div>
        <div className="min-w-0 flex items-center gap-2">
          <span className="font-black text-white text-sm shrink-0">{label}</span>
          <span className="text-white/80 text-sm truncate font-medium">{promotion.title}</span>
        </div>
      </div>
      {promotion.ends_at && (
        <span className="flex-shrink-0 text-xs text-white/60 flex items-center gap-1">
          <Clock size={10} />
          Ends {new Date(promotion.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
      <Link
        href="/browse?deals=1"
        className="flex-shrink-0 flex items-center gap-1 text-sm font-bold text-white hover:text-white/90 transition-colors bg-white/15 px-4 py-1.5 rounded-full"
      >
        Shop Now <ArrowRight size={13} />
      </Link>
    </div>
  )
}
