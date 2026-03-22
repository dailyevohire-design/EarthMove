'use client'

import { useState, useEffect } from 'react'

const MESSAGES = [
  '🌱 Spring busy season is here — prices rise in April. Order now and save.',
  '⚡ Same-day delivery available in your area until 2pm today',
  '💰 7,000+ suppliers means we always have stock — even on short notice',
  '🏗️ Contractor pricing available — create a business account for volume discounts',
  '📈 Material prices typically rise 12-18% in late spring — lock in current rates',
]

export function UrgencyBanner() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % MESSAGES.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="bg-gray-900 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-2 text-center transition-all duration-500">
          <span className="text-xs font-semibold text-white/90">
            {MESSAGES[index]}
          </span>
        </div>
      </div>
    </div>
  )
}
