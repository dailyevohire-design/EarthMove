'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Zap, ArrowRight, Check, Users } from 'lucide-react'

interface DealSliderProps {
  deal: {
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
  marketName: string
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

export function DealSlider({ deal, marketName }: DealSliderProps) {
  const [timeLeft, setTimeLeft] = useState({ hours: '00', minutes: '00', seconds: '00' })
  const [sliderProgress, setSliderProgress] = useState(0)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [unlockCount, setUnlockCount] = useState(14)
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbSize = 48

  // Countdown timer to midnight local time
  useEffect(() => {
    function update() {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const diff = midnight.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft({ hours: '00', minutes: '00', seconds: '00' })
        return
      }

      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft({
        hours: String(h).padStart(2, '0'),
        minutes: String(m).padStart(2, '0'),
        seconds: String(s).padStart(2, '0'),
      })
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  const getProgressFromEvent = useCallback((clientX: number) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const trackWidth = rect.width - thumbSize
    const x = clientX - rect.left - thumbSize / 2
    return Math.min(1, Math.max(0, x / trackWidth))
  }, [])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isUnlocked) return
    e.preventDefault()
    setIsDragging(true)
  }, [isUnlocked])

  useEffect(() => {
    if (!isDragging) return

    function handleMouseMove(e: MouseEvent) {
      const progress = getProgressFromEvent(e.clientX)
      setSliderProgress(progress)
    }

    function handleMouseUp() {
      setIsDragging(false)
      if (sliderProgress >= 0.8) {
        setIsUnlocked(true)
        setSliderProgress(1)
        setUnlockCount(prev => prev + 1)
      } else {
        setSliderProgress(0)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, sliderProgress, getProgressFromEvent])

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isUnlocked) return
    setIsDragging(true)
  }, [isUnlocked])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || isUnlocked) return
    const touch = e.touches[0]
    const progress = getProgressFromEvent(touch.clientX)
    setSliderProgress(progress)
  }, [isDragging, isUnlocked, getProgressFromEvent])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    if (sliderProgress >= 0.8) {
      setIsUnlocked(true)
      setSliderProgress(1)
      setUnlockCount(prev => prev + 1)
    } else {
      setSliderProgress(0)
    }
  }, [isDragging, sliderProgress])

  const savings = deal.original_price - deal.deal_price
  const thumbOffset = sliderProgress * (100 - (thumbSize / 3.2))

  return (
    <section className="relative min-h-[60vh] md:min-h-[70vh] flex items-center justify-center overflow-hidden">
      {/* Background image - blurred and darkened */}
      {deal.image_url && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-3xl opacity-20 scale-110"
          style={{ backgroundImage: `url(${deal.image_url})` }}
        />
      )}
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[#0a0a0a]/80" />

      {/* Ambient glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#00ff88]/5 blur-3xl pointer-events-none" />

      {/* Countdown timer - top right */}
      <div className="absolute top-6 right-6 md:top-10 md:right-10 text-right z-10">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-1.5 font-medium">Deal expires in</p>
        <div className="font-mono text-[#00ff88] text-2xl md:text-3xl font-bold tracking-wider">
          <span>{timeLeft.hours}</span>
          <span className="animate-pulse mx-0.5">:</span>
          <span>{timeLeft.minutes}</span>
          <span className="animate-pulse mx-0.5">:</span>
          <span>{timeLeft.seconds}</span>
        </div>
      </div>

      {/* Center content */}
      <div className="relative z-10 text-center px-4 py-16 md:py-20 max-w-3xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 mb-6">
          <Zap size={14} className="text-[#00ff88] fill-[#00ff88]" />
          <span className="text-[#00ff88] text-xs font-black uppercase tracking-widest">
            {deal.badge_label ?? 'Deal of the Day'}
          </span>
        </div>

        {/* Material name */}
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-none tracking-tight">
          {deal.material_name}
        </h1>

        {/* Pricing */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <span className="font-mono text-xl md:text-2xl text-white/40 line-through decoration-red-500 decoration-2">
              {formatPrice(deal.original_price)}
            </span>
            <span className="text-xs text-white/30 uppercase">per {unitDisplay(deal.unit)}</span>
          </div>
          <div className="font-mono text-6xl md:text-8xl font-black text-[#00ff88] leading-none tracking-tight">
            {formatPrice(deal.deal_price)}
          </div>
          <p className="text-xs text-white/30 mt-2 uppercase tracking-wide">per {unitDisplay(deal.unit)}</p>
          {savings > 0 && (
            <p className="text-[#00ff88]/70 text-sm mt-3 font-semibold">
              You save {formatPrice(savings)} per {unitDisplay(deal.unit)}
            </p>
          )}
        </div>

        {/* THE SLIDER */}
        {!isUnlocked ? (
          <div className="inline-block w-full max-w-sm">
            <div
              ref={trackRef}
              className="relative h-14 rounded-full bg-white/5 border border-white/10 overflow-hidden select-none cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => {
                // Allow clicking anywhere on track to start drag
                const progress = getProgressFromEvent(e.clientX)
                if (progress < 0.15) {
                  handleMouseDown(e)
                }
              }}
            >
              {/* Track fill */}
              <div
                className="absolute inset-y-0 left-0 bg-[#00ff88]/5 transition-none"
                style={{ width: `${sliderProgress * 100}%` }}
              />

              {/* Track text */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-white/30 text-sm font-semibold tracking-wide">
                  Slide to unlock deal &rarr;
                </span>
              </div>

              {/* Draggable thumb */}
              <div
                className="absolute top-1 h-12 w-12 rounded-full bg-[#00ff88] flex items-center justify-center shadow-lg shadow-[#00ff88]/30 transition-none touch-none"
                style={{
                  left: `calc(${thumbOffset}% + 4px)`,
                  transition: isDragging ? 'none' : 'left 0.3s ease-out',
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <ArrowRight size={20} className="text-black" />
                {/* Pulsing glow */}
                <div className="absolute inset-0 rounded-full bg-[#00ff88]/40 animate-ping" />
              </div>
            </div>
          </div>
        ) : (
          <div className="inline-block w-full max-w-sm space-y-3">
            <div className="flex items-center justify-center gap-2 text-[#00ff88] text-sm font-bold mb-3">
              <Check size={16} className="text-[#00ff88]" />
              DEAL UNLOCKED
            </div>
            <Link
              href={`/browse/${deal.material_slug}`}
              className="block w-full py-4 rounded-full bg-[#00ff88] text-black font-black text-lg text-center hover:bg-[#00ff99] transition-colors shadow-lg shadow-[#00ff88]/20"
            >
              Order Now &rarr;
            </Link>
          </div>
        )}

        {/* Sub-text */}
        <p className="text-white/20 text-xs mt-5 tracking-wide">
          Only until midnight &middot; {marketName} exclusive
        </p>

        {/* Social proof */}
        <div className="mt-6 flex items-center justify-center gap-2 text-white/25 text-xs">
          <Users size={12} />
          <span className="tabular-nums">{unlockCount} people have unlocked this deal today</span>
        </div>
      </div>
    </section>
  )
}
