'use client'

import { useState, useEffect } from 'react'

const MESSAGES = [
  { emoji: '🔥', text: 'orders placed today in your area' },
  { emoji: '⚡', text: 'Same-day delivery available until 2pm' },
  { emoji: '💰', text: 'Free delivery on orders over $500' },
  { emoji: '🚛', text: 'tons delivered this month across 10 cities' },
]

export function UrgencyBanner() {
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(Math.floor(Math.random() * 30) + 15)
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % MESSAGES.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const msg = MESSAGES[index]
  const displayText = index === 0 ? `${count} ${msg.text}` :
                      index === 3 ? `${(count * 47).toLocaleString()} ${msg.text}` :
                      msg.text

  return (
    <div className="bg-gray-900 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-2 text-center transition-all duration-500">
          <span className="text-xs font-semibold text-white/90">
            {msg.emoji} {displayText}
          </span>
        </div>
      </div>
    </div>
  )
}
