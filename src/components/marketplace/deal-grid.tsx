'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Zap, Clock, ArrowRight, Check } from 'lucide-react'

interface Deal {
  id: string
  title: string
  badge_label: string | null
  material_name: string
  material_slug: string
  unit: string
  original_price: number
  deal_price: number
  image_url: string | null
  ends_at: string | null
  promotion_type: string
  discount_value: number
  delivery_fee: number | null
}

interface DealGridProps {
  deals: Deal[]
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function unitDisplay(unit: string): string {
  const map: Record<string, string> = {
    ton: 'ton',
    cubic_yard: 'cu yd',
    load: 'load',
    each: 'unit',
  }
  return map[unit] ?? unit
}

function discountLabel(deal: Deal): string {
  if (deal.promotion_type === 'percentage') return `${deal.discount_value}% OFF`
  if (deal.promotion_type === 'flat_amount') return `$${deal.discount_value} OFF`
  if (deal.promotion_type === 'price_override') return 'SPECIAL PRICE'
  return 'DEAL'
}

function useTimeProgress(): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function update() {
      const now = new Date()
      const startOfDay = new Date(now)
      startOfDay.setHours(0, 0, 0, 0)
      const elapsed = now.getTime() - startOfDay.getTime()
      const total = 24 * 60 * 60 * 1000
      // Progress represents how much time has PASSED (bar drains from right to left)
      setProgress(elapsed / total)
    }

    update()
    const interval = setInterval(update, 60000) // update every minute
    return () => clearInterval(interval)
  }, [])

  return progress
}

function DealCard({ deal }: { deal: Deal }) {
  const [unlocked, setUnlocked] = useState(false)
  const timeProgress = useTimeProgress()
  const timeRemaining = 1 - timeProgress
  const savings = deal.original_price - deal.deal_price

  return (
    <div
      className="group relative rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden transition-all duration-200 will-change-transform touch-manipulation hover:bg-white/[0.05] hover:border-[#00ff88]/40 hover:-translate-y-1 active:translate-y-0 active:scale-[0.985] active:duration-75"
      style={{
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.4), 0 16px 32px -16px rgba(0,0,0,0.6), 0 0 24px -8px rgba(0,255,136,0.15)',
      }}
    >
      {/* Image area */}
      <div className="relative h-44 bg-gradient-to-br from-white/5 to-white/[0.02] overflow-hidden">
        {deal.image_url ? (
          <img
            src={deal.image_url}
            alt={deal.material_name}
            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap size={32} className="text-white/10" />
          </div>
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />

        {/* Badge */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#00ff88] text-black animate-[deal-pulse_2s_ease-in-out_infinite]">
            <Zap size={10} className="fill-current" />
            {deal.badge_label ?? discountLabel(deal)}
          </span>
        </div>

        {/* Savings chip */}
        {savings > 0 && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-500/90 text-white">
              Save {formatPrice(savings)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Material name */}
        <h3 className="text-white font-bold text-lg leading-tight truncate">
          {deal.material_name}
        </h3>

        {/* Pricing */}
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-2xl font-black text-[#00ff88]">
            {formatPrice(deal.deal_price)}
          </span>
          <span className="font-mono text-sm text-white/30 line-through decoration-red-500">
            {formatPrice(deal.original_price)}
          </span>
          <span className="text-white/20 text-xs">/{unitDisplay(deal.unit)}</span>
        </div>

        {/* Time remaining bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-white/30">
            <span className="flex items-center gap-1">
              <Clock size={9} />
              Time remaining
            </span>
            <span className="font-mono">{Math.round(timeRemaining * 24)}h left</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00ff88] to-[#00ff88]/60 transition-all duration-1000"
              style={{ width: `${timeRemaining * 100}%` }}
            />
          </div>
        </div>

        {/* Action */}
        {!unlocked ? (
          <button
            onClick={() => setUnlocked(true)}
            className="w-full py-2.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm font-bold hover:bg-[#00ff88]/10 hover:border-[#00ff88]/30 hover:text-[#00ff88] transition-all"
          >
            Unlock Deal
          </button>
        ) : (
          <Link
            href={`/browse/${deal.material_slug}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full bg-[#00ff88] text-black text-sm font-black hover:bg-[#00ff99] transition-colors shadow-md shadow-[#00ff88]/20"
          >
            <Check size={14} />
            Order Now
            <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {/* Keyframes for badge pulse */}
      <style jsx>{`
        @keyframes deal-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.4); }
          50% { box-shadow: 0 0 12px 4px rgba(0, 255, 136, 0.15); }
        }
      `}</style>
    </div>
  )
}

export function DealGrid({ deals }: DealGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} />
      ))}
    </div>
  )
}
