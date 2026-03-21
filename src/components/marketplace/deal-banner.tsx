'use client'
// src/components/marketplace/deal-banner.tsx
import Link from 'next/link'
import { Zap, ArrowRight } from 'lucide-react'

export function DealBanner({ promotion }: { promotion: any }) {
  const label =
    promotion.promotion_type === 'percentage' ? `${promotion.discount_value}% OFF` :
    promotion.promotion_type === 'flat_amount' ? `$${promotion.discount_value} OFF` :
    promotion.promotion_type === 'price_override' ? `NOW $${promotion.override_price}` : 'SPECIAL'

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-emerald-600 rounded-full">
          <Zap size={11} className="text-white" />
          <span className="text-[10px] font-black text-white uppercase tracking-wide">Deal</span>
        </div>
        <div className="min-w-0 flex items-center gap-2">
          <span className="font-bold text-emerald-700 text-sm shrink-0">{label}</span>
          <span className="text-gray-600 text-sm truncate">{promotion.title}</span>
        </div>
      </div>
      {promotion.ends_at && (
        <span className="flex-shrink-0 text-xs text-gray-400">
          Ends {new Date(promotion.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
      <Link
        href="/browse?deals=1"
        className="flex-shrink-0 flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
      >
        Shop <ArrowRight size={13} />
      </Link>
    </div>
  )
}
